"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProjectKey, TimesheetEntry, TimesheetStatus } from "@/lib/db";
import {
  DAY_LABELS,
  addDays,
  formatRange,
  isWeekend,
  isoWeekNumber,
  parseISODate,
  toISODate,
  weekDates,
} from "@/lib/week";

interface RowDraft {
  project: ProjectKey;
  task: string;
  hours: number[];
  ids: (number | null)[];
}

interface Props {
  initialUser: string;
  initialWeekStart: string;
  initialEntries: TimesheetEntry[];
  users: string[];
  projects: ProjectKey[];
}

const WEEKDAY_CAP = 8;

function groupIntoRows(
  entries: TimesheetEntry[],
  weekStart: Date,
  projects: ProjectKey[],
): RowDraft[] {
  const dates = weekDates(weekStart).map(toISODate);
  const map = new Map<string, RowDraft>();
  for (const e of entries) {
    const key = `${e.project}::${e.task}`;
    if (!map.has(key)) {
      map.set(key, {
        project: e.project,
        task: e.task,
        hours: Array(7).fill(0),
        ids: Array(7).fill(null),
      });
    }
    const row = map.get(key)!;
    const idx = dates.indexOf(e.work_date);
    if (idx >= 0) {
      row.hours[idx] = e.hours;
      row.ids[idx] = e.id;
    }
  }
  const rows = Array.from(map.values());
  if (rows.length === 0) {
    rows.push({
      project: projects[0],
      task: "",
      hours: Array(7).fill(0),
      ids: Array(7).fill(null),
    });
  }
  return rows;
}

function rowStatus(entries: TimesheetEntry[]): TimesheetStatus {
  if (entries.length === 0) return "Draft";
  if (entries.every((e) => e.status === "Approved")) return "Approved";
  if (entries.every((e) => e.status === "Submitted" || e.status === "Approved"))
    return "Submitted";
  return "Draft";
}

export default function Timesheet({
  initialUser,
  initialWeekStart,
  initialEntries,
  users,
  projects,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const weekStart = parseISODate(initialWeekStart);
  const weekEnd = addDays(weekStart, 6);
  const dates = weekDates(weekStart);
  const dateStrs = dates.map(toISODate);

  const [user, setUser] = useState(initialUser);
  const [rows, setRows] = useState<RowDraft[]>(() =>
    groupIntoRows(initialEntries, weekStart, projects),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const status = useMemo(() => rowStatus(initialEntries), [initialEntries]);
  const locked = status === "Submitted" || status === "Approved";

  const dailyTotals = useMemo(() => {
    const totals = Array(7).fill(0);
    for (const r of rows) {
      for (let i = 0; i < 7; i++) totals[i] += Number(r.hours[i]) || 0;
    }
    return totals;
  }, [rows]);

  const weekTotal = dailyTotals.reduce((a, b) => a + b, 0);

  const navigate = (newUser: string, newWeekStart: string) => {
    const qs = new URLSearchParams({ user: newUser, week: newWeekStart });
    startTransition(() => router.push(`/timesheet?${qs.toString()}`));
  };

  const changeWeek = (deltaDays: number) => {
    navigate(user, toISODate(addDays(weekStart, deltaDays)));
  };

  const goToday = () => navigate(user, toISODate(new Date()));

  const updateRow = (idx: number, patch: Partial<RowDraft>) => {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const updateHours = (rowIdx: number, dayIdx: number, value: string) => {
    const num = Math.max(0, Math.min(24, Number(value) || 0));
    setRows((rs) =>
      rs.map((r, i) => {
        if (i !== rowIdx) return r;
        const hours = [...r.hours];
        hours[dayIdx] = num;
        return { ...r, hours };
      }),
    );
  };

  const addRow = () => {
    setRows((rs) => [
      ...rs,
      {
        project: projects[0],
        task: "",
        hours: Array(7).fill(0),
        ids: Array(7).fill(null),
      },
    ]);
  };

  const removeRow = async (idx: number) => {
    const row = rows[idx];
    const toDelete = row.ids.filter((id): id is number => id !== null);
    for (const id of toDelete) {
      await fetch(`/api/timesheets?id=${id}`, { method: "DELETE" });
    }
    setRows((rs) => rs.filter((_, i) => i !== idx));
  };

  const save = async (submitting = false) => {
    if (submitting && weekTotal <= 0) {
      setMessage("Enter at least one hour before submitting the week.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const updatedRows: RowDraft[] = [];
      for (const row of rows) {
        const newIds: (number | null)[] = [...row.ids];
        for (let i = 0; i < 7; i++) {
          const hours = Number(row.hours[i]) || 0;
          const id = row.ids[i];
          if (id) {
            const res = await fetch("/api/timesheets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id,
                project: row.project,
                task: row.task,
                hours,
              }),
            });
            if (!res.ok) {
              const body = await res.text();
              throw new Error(`Update failed (HTTP ${res.status}): ${body}`);
            }
          } else if (hours > 0) {
            const res = await fetch("/api/timesheets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_name: user,
                work_date: dateStrs[i],
                project: row.project,
                task: row.task,
                hours,
              }),
            });
            if (!res.ok) {
              const body = await res.text();
              throw new Error(`Create failed (HTTP ${res.status}): ${body}`);
            }
            const data = (await res.json()) as { entry?: { id: number } };
            newIds[i] = data.entry?.id ?? null;
          }
        }
        updatedRows.push({ ...row, ids: newIds });
      }
      setRows(updatedRows);
      if (submitting) {
        const res = await fetch("/api/timesheets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user,
            from: dateStrs[0],
            to: dateStrs[6],
            status: "Submitted",
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Submit failed (HTTP ${res.status}): ${body}`);
        }
      }
      setMessage(submitting ? "Week submitted." : "Saved.");
      startTransition(() => router.refresh());
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : String(e);
      setMessage(`Save failed: ${m}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded shadow-sm border border-gray-200 p-5">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-tr-slate-2 mb-1">
              Resource
            </div>
            <select
              value={user}
              onChange={(e) => navigate(e.target.value, dateStrs[0])}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
              disabled={pending}
            >
              {users.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="ml-2">
            <div className="text-xs uppercase tracking-wider text-tr-slate-2 mb-1">
              Week
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeWeek(-7)}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                disabled={pending}
                title="Previous week"
              >
                ◀
              </button>
              <div className="text-sm font-medium text-tr-navy min-w-[260px] text-center">
                {formatRange(weekStart, weekEnd)} &middot; W{isoWeekNumber(weekStart)}
              </div>
              <button
                onClick={() => changeWeek(7)}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                disabled={pending}
                title="Next week"
              >
                ▶
              </button>
              <button
                onClick={() => changeWeek(28)}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                disabled={pending}
                title="Next month"
              >
                Next month »
              </button>
              <button
                onClick={goToday}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                disabled={pending}
              >
                Today
              </button>
            </div>
          </div>
          <div className="flex-1" />
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-tr-slate-2">
              Status
            </div>
            <div
              className={
                "text-sm font-semibold mt-0.5 " +
                (status === "Approved"
                  ? "text-emerald-700"
                  : status === "Submitted"
                  ? "text-tr-orange"
                  : "text-tr-slate-2")
              }
            >
              {status}
            </div>
          </div>
          <div className="text-right ml-4">
            <div className="text-xs uppercase tracking-wider text-tr-slate-2">
              Week total
            </div>
            <div className="text-2xl font-semibold text-tr-navy">
              {weekTotal.toFixed(2)}
              <span className="text-sm font-normal text-tr-slate-2"> hrs</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left font-semibold text-tr-slate-2 uppercase text-xs tracking-wider py-2 px-2">
                  Project
                </th>
                <th className="text-left font-semibold text-tr-slate-2 uppercase text-xs tracking-wider py-2 px-2">
                  Task
                </th>
                {dates.map((d, i) => (
                  <th
                    key={i}
                    className={
                      "text-center font-semibold uppercase text-xs tracking-wider py-2 px-1 w-20 " +
                      (isWeekend(d)
                        ? "text-tr-slate-2/60 bg-gray-50"
                        : "text-tr-slate-2")
                    }
                  >
                    <div>{DAY_LABELS[i]}</div>
                    <div className="font-normal">{d.getDate()}</div>
                  </th>
                ))}
                <th className="text-right font-semibold text-tr-slate-2 uppercase text-xs tracking-wider py-2 px-2 w-16">
                  Total
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => {
                const rowTotal = row.hours.reduce(
                  (a, b) => a + (Number(b) || 0),
                  0,
                );
                return (
                  <tr key={rIdx} className="border-b border-gray-100">
                    <td className="py-2 px-2">
                      <select
                        value={row.project}
                        onChange={(e) =>
                          updateRow(rIdx, {
                            project: e.target.value as ProjectKey,
                          })
                        }
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                        disabled={locked}
                      >
                        {projects.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={row.task}
                        onChange={(e) =>
                          updateRow(rIdx, { task: e.target.value })
                        }
                        placeholder="e.g. #123 Login bug fix"
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                        disabled={locked}
                      />
                    </td>
                    {row.hours.map((h, dIdx) => {
                      const dayTotal = dailyTotals[dIdx];
                      const overCap = !isWeekend(dates[dIdx]) && dayTotal > WEEKDAY_CAP;
                      return (
                        <td
                          key={dIdx}
                          className={
                            "py-2 px-1 text-center " +
                            (isWeekend(dates[dIdx]) ? "bg-gray-50" : "")
                          }
                        >
                          <input
                            type="number"
                            min="0"
                            max="24"
                            step="0.25"
                            value={h || ""}
                            onChange={(e) =>
                              updateHours(rIdx, dIdx, e.target.value)
                            }
                            placeholder="0"
                            className={
                              "w-16 text-center border rounded px-1 py-1 text-sm " +
                              (overCap
                                ? "border-red-300 bg-red-50 text-red-700"
                                : "border-gray-300")
                            }
                            disabled={locked}
                          />
                        </td>
                      );
                    })}
                    <td className="py-2 px-2 text-right font-semibold text-tr-navy">
                      {rowTotal.toFixed(2)}
                    </td>
                    <td className="py-2 px-1 text-center">
                      <button
                        onClick={() => removeRow(rIdx)}
                        className="text-tr-slate-2 hover:text-red-600 text-lg leading-none"
                        title="Remove row"
                        disabled={locked}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td colSpan={2} className="py-2 px-2 text-right text-xs uppercase tracking-wider text-tr-slate-2 font-semibold">
                  Daily total
                </td>
                {dailyTotals.map((t, i) => {
                  const overCap = !isWeekend(dates[i]) && t > WEEKDAY_CAP;
                  return (
                    <td
                      key={i}
                      className={
                        "py-2 px-1 text-center text-sm font-semibold " +
                        (overCap
                          ? "text-red-700"
                          : isWeekend(dates[i])
                          ? "text-tr-slate-2"
                          : "text-tr-navy")
                      }
                    >
                      {t.toFixed(2)}
                      {overCap && (
                        <div className="text-[10px] font-normal text-red-600">
                          over 8h
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="py-2 px-2 text-right text-tr-navy font-bold">
                  {weekTotal.toFixed(2)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {!locked && (
          <div className="mt-3">
            <button
              onClick={addRow}
              className="text-sm text-tr-orange hover:underline"
            >
              + Add row
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {!locked && (
          <>
            <button
              onClick={() => save(false)}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold border border-gray-300 rounded hover:bg-gray-50"
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              onClick={() => save(true)}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-tr-orange text-white rounded hover:bg-tr-orange-dark"
            >
              {saving ? "Submitting…" : "Submit week"}
            </button>
          </>
        )}
        {locked && (
          <button
            onClick={async () => {
              await fetch("/api/timesheets", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  user,
                  from: dateStrs[0],
                  to: dateStrs[6],
                  status: "Draft",
                }),
              });
              startTransition(() => router.refresh());
            }}
            className="px-4 py-2 text-sm font-semibold border border-gray-300 rounded hover:bg-gray-50"
          >
            Reopen for editing
          </button>
        )}
        {message && (
          <span className="text-sm text-tr-slate-2">{message}</span>
        )}
      </div>

      <div className="text-xs text-tr-slate-2">
        Tip: weekdays are capped at 8 hours total. Cells turn red if the daily
        total exceeds the cap. Weekends are allowed but flagged separately.
      </div>
    </div>
  );
}
