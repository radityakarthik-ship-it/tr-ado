import { listTickets, seedIfEmpty, Ticket, WorkItemState } from "@/lib/db";
import Board from "@/components/Board";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await seedIfEmpty();
  const tickets = await listTickets();

  const columns: WorkItemState[] = ["Backlog", "In Progress", "Done"];
  const grouped: Record<WorkItemState, Ticket[]> = {
    Backlog: [],
    "In Progress": [],
    Done: [],
  };
  for (const t of tickets) grouped[t.state]?.push(t);

  return (
    <div className="min-h-screen flex flex-col bg-[#f3f5f8]">
      <Header />
      <div className="flex-1 flex">
        <Sidebar />
        <main className="flex-1 px-8 py-6 overflow-x-auto">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-tr-slate-2">
                Boards / Sprint 142
              </div>
              <h1 className="text-2xl font-semibold text-tr-navy mt-1">
                Platform — Active Sprint
              </h1>
            </div>
            <div className="flex items-center gap-3 text-sm text-tr-slate-2">
              <span>{tickets.length} work items</span>
              <span className="h-4 w-px bg-gray-300" />
              <span>Sprint ends 2026-06-26</span>
            </div>
          </div>
          <Board columns={columns} grouped={grouped} />
        </main>
      </div>
      <footer className="border-t border-gray-200 bg-white px-8 py-3 text-xs text-tr-slate-2">
        &copy; 2026 TR ADO. All rights reserved.
      </footer>
    </div>
  );
}
