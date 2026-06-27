import {
  listTimesheetEntries,
  PROJECTS,
  TEAM_MEMBERS,
} from "@/lib/db";
import {
  addDays,
  mondayOf,
  parseISODate,
  toISODate,
} from "@/lib/week";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Timesheet from "@/components/Timesheet";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { user?: string; week?: string };
}

export default async function TimesheetPage({ searchParams }: Props) {
  const user =
    searchParams.user && (TEAM_MEMBERS as readonly string[]).includes(searchParams.user)
      ? searchParams.user
      : "Pooja Iyer";

  const weekStart = searchParams.week
    ? mondayOf(parseISODate(searchParams.week))
    : mondayOf(new Date());
  const weekEnd = addDays(weekStart, 6);
  const from = toISODate(weekStart);
  const to = toISODate(weekEnd);

  let entries = [] as Awaited<ReturnType<typeof listTimesheetEntries>>;
  let error: string | null = null;
  try {
    entries = await listTimesheetEntries(user, from, to);
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f3f5f8]">
      <Header activeProject="Platform" />
      <div className="flex-1 flex">
        <Sidebar activeProject="Platform" activeSection="timesheet" />
        <main className="flex-1 px-8 py-6 overflow-x-auto">
          <div className="mb-6">
            <div className="text-xs uppercase tracking-wider text-tr-slate-2">
              Timesheet
            </div>
            <h1 className="text-2xl font-semibold text-tr-navy mt-1">
              Weekly time entry
            </h1>
            <p className="text-sm text-tr-slate-2 mt-1">
              Log up to 8 hours per weekday. Click Submit week when finished.
            </p>
          </div>
          {error && (
            <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="font-semibold mb-1">Storage warming up</div>
              <div className="text-xs">{error}</div>
            </div>
          )}
          <Timesheet
            initialUser={user}
            initialWeekStart={from}
            initialEntries={entries}
            users={TEAM_MEMBERS as unknown as string[]}
            projects={PROJECTS}
          />
        </main>
      </div>
      <footer className="border-t border-gray-200 bg-white px-8 py-3 text-xs text-tr-slate-2">
        &copy; 2026 TR ADO. All rights reserved.
      </footer>
    </div>
  );
}
