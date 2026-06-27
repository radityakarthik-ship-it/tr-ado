import type { ProjectKey, Ticket } from "@/lib/db";

const PROJECT_BLURB: Record<ProjectKey, string> = {
  Platform:
    "Core platform services: identity, content APIs, publishing pipeline, and developer tooling.",
  Editorial:
    "Editorial CMS, draft workflows, and integrations with newsroom tools.",
  Compliance:
    "Sanctions screening, PEP, audit log retention, and regulatory reporting.",
  Infrastructure:
    "Kubernetes platform, batch workflows, observability stack, and developer infra.",
};

const PROJECT_LEAD: Record<ProjectKey, { name: string; role: string }> = {
  Platform: { name: "Priya Menon", role: "Engineering Manager" },
  Editorial: { name: "James O'Connor", role: "Product Lead" },
  Compliance: { name: "Anna Kowalski", role: "Compliance Tech Lead" },
  Infrastructure: { name: "Ravi Subramanian", role: "SRE Lead" },
};

const TEAM_BY_PROJECT: Record<ProjectKey, string[]> = {
  Platform: [
    "Priya Menon",
    "Mei Lin",
    "Devon Walsh",
    "James O'Connor",
    "Ravi Subramanian",
    "Pooja Iyer",
    "Sharath Krishnan",
    "Greeshma JS",
  ],
  Editorial: [
    "James O'Connor",
    "Mei Lin",
    "Anna Kowalski",
    "Ravi Subramanian",
    "Pooja Iyer",
    "Sharath Krishnan",
    "Greeshma JS",
  ],
  Compliance: [
    "Anna Kowalski",
    "Devon Walsh",
    "Priya Menon",
    "Mei Lin",
    "Pooja Iyer",
    "Sharath Krishnan",
    "Greeshma JS",
  ],
  Infrastructure: [
    "Ravi Subramanian",
    "Devon Walsh",
    "Priya Menon",
    "Anna Kowalski",
    "Pooja Iyer",
    "Sharath Krishnan",
    "Greeshma JS",
  ],
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Overview({
  project,
  tickets,
}: {
  project: ProjectKey;
  tickets: Ticket[];
}) {
  const done = tickets.filter((t) => t.state === "Done").length;
  const inProgress = tickets.filter((t) => t.state === "In Progress").length;
  const backlog = tickets.filter((t) => t.state === "Backlog").length;
  const total = tickets.length || 1;
  const donePct = Math.round((done / total) * 100);
  const inProgressPct = Math.round((inProgress / total) * 100);
  const backlogPct = 100 - donePct - inProgressPct;

  const p1Open = tickets.filter(
    (t) => t.priority === 1 && t.state !== "Done",
  ).length;
  const bugsOpen = tickets.filter(
    (t) => t.type === "Bug" && t.state !== "Done",
  ).length;

  const lead = PROJECT_LEAD[project];
  const team = TEAM_BY_PROJECT[project];
  const recent = [...tickets]
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 5);

  return (
    <div className="grid grid-cols-3 gap-5">
      <Card span={2} title="Sprint 142 progress">
        <div className="flex items-center gap-4 mb-3">
          <div className="text-3xl font-semibold text-tr-navy">{donePct}%</div>
          <div className="text-sm text-tr-slate-2">
            {done} of {tickets.length} work items closed
          </div>
        </div>
        <div className="h-3 w-full bg-gray-100 rounded overflow-hidden flex">
          <div
            className="bg-emerald-500"
            style={{ width: `${donePct}%` }}
            title={`Done ${done}`}
          />
          <div
            className="bg-tr-orange"
            style={{ width: `${inProgressPct}%` }}
            title={`In Progress ${inProgress}`}
          />
          <div
            className="bg-gray-300"
            style={{ width: `${backlogPct}%` }}
            title={`Backlog ${backlog}`}
          />
        </div>
        <div className="mt-3 flex gap-5 text-xs text-tr-slate-2">
          <Legend color="bg-emerald-500" label={`Done ${done}`} />
          <Legend color="bg-tr-orange" label={`In Progress ${inProgress}`} />
          <Legend color="bg-gray-300" label={`Backlog ${backlog}`} />
        </div>
      </Card>

      <Card title="At a glance">
        <Stat label="Open P1 work items" value={p1Open} accent="text-red-600" />
        <Stat label="Open bugs" value={bugsOpen} accent="text-amber-600" />
        <Stat label="Days left in sprint" value={14} accent="text-tr-navy" />
        <Stat label="Velocity (last 3 sprints)" value="32 pts" accent="text-tr-navy" />
      </Card>

      <Card span={2} title="About this project">
        <p className="text-sm text-tr-navy-2 mb-4">
          {PROJECT_BLURB[project]}
        </p>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-tr-navy text-white flex items-center justify-center font-semibold">
            {initials(lead.name)}
          </div>
          <div>
            <div className="text-sm font-medium text-tr-navy">{lead.name}</div>
            <div className="text-xs text-tr-slate-2">{lead.role}</div>
          </div>
        </div>
      </Card>

      <Card title="Team">
        <ul className="space-y-2.5">
          {team.map((name) => (
            <li key={name} className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-full bg-tr-orange text-tr-navy text-xs flex items-center justify-center font-semibold">
                {initials(name)}
              </span>
              <span className="text-sm text-tr-navy">{name}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card span={3} title="Recent activity">
        {recent.length === 0 ? (
          <div className="text-sm text-tr-slate-2">No recent activity.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recent.map((t) => (
              <li key={t.id} className="py-2.5 flex items-center gap-3">
                <span className="text-xs text-tr-slate-2 w-12 shrink-0">
                  #{t.id}
                </span>
                <span className="text-xs uppercase tracking-wider text-tr-slate-2 w-24 shrink-0">
                  {t.type}
                </span>
                <span className="text-sm text-tr-navy flex-1 truncate">
                  {t.title}
                </span>
                <span className="text-xs text-tr-slate-2 w-32 text-right truncate">
                  {t.assignee}
                </span>
                <StatePill state={t.state} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Card({
  title,
  children,
  span = 1,
}: {
  title: string;
  children: React.ReactNode;
  span?: 1 | 2 | 3;
}) {
  const cls =
    span === 3 ? "col-span-3" : span === 2 ? "col-span-2" : "col-span-1";
  return (
    <div
      className={
        "bg-white rounded shadow-sm border border-gray-200 p-5 " + cls
      }
    >
      <div className="text-xs uppercase tracking-wider text-tr-slate-2 mb-3">
        {title}
      </div>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b last:border-0 border-gray-100">
      <span className="text-sm text-tr-slate-2">{label}</span>
      <span className={"text-lg font-semibold " + accent}>{value}</span>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={"h-2 w-2 rounded-full " + color} />
      {label}
    </span>
  );
}

function StatePill({ state }: { state: string }) {
  const style =
    state === "Done"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : state === "In Progress"
      ? "bg-orange-50 text-orange-700 border-orange-200"
      : "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span
      className={
        "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border " +
        style
      }
    >
      {state}
    </span>
  );
}
