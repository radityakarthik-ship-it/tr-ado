import type { Ticket, WorkItemType, Priority } from "@/lib/db";

const TYPE_STYLE: Record<WorkItemType, { color: string; symbol: string }> = {
  Bug: { color: "text-red-600 bg-red-50 border-red-200", symbol: "●" },
  Task: { color: "text-amber-700 bg-amber-50 border-amber-200", symbol: "✓" },
  "User Story": { color: "text-sky-700 bg-sky-50 border-sky-200", symbol: "★" },
  Feature: { color: "text-violet-700 bg-violet-50 border-violet-200", symbol: "♦" },
};

const PRIORITY_LABEL: Record<Priority, string> = {
  1: "P1",
  2: "P2",
  3: "P3",
  4: "P4",
};

const PRIORITY_COLOR: Record<Priority, string> = {
  1: "bg-red-100 text-red-700 border-red-200",
  2: "bg-orange-100 text-orange-700 border-orange-200",
  3: "bg-yellow-100 text-yellow-700 border-yellow-200",
  4: "bg-gray-100 text-gray-700 border-gray-200",
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function TicketCard({
  ticket,
  onOpen,
}: {
  ticket: Ticket;
  onOpen: () => void;
}) {
  const ts = TYPE_STYLE[ticket.type];
  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-white border border-gray-200 rounded p-3 hover:border-tr-orange hover:shadow-md transition"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={
            "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border " +
            ts.color
          }
        >
          <span className="mr-1">{ts.symbol}</span>
          {ticket.type}
        </span>
        <span className="text-xs text-tr-slate-2">#{ticket.id}</span>
      </div>
      <div className="text-sm font-medium text-tr-navy leading-snug mb-2">
        {ticket.title}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className={
              "text-[10px] font-semibold px-1.5 py-0.5 rounded border " +
              PRIORITY_COLOR[ticket.priority]
            }
          >
            {PRIORITY_LABEL[ticket.priority]}
          </span>
          {ticket.tag && (
            <span className="text-[10px] text-tr-slate-2 bg-gray-100 px-1.5 py-0.5 rounded">
              {ticket.tag}
            </span>
          )}
        </div>
        <div
          className="h-6 w-6 rounded-full bg-tr-navy text-white text-[10px] flex items-center justify-center font-semibold"
          title={ticket.assignee}
        >
          {initials(ticket.assignee)}
        </div>
      </div>
    </button>
  );
}
