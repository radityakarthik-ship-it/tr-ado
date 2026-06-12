"use client";

import { useState } from "react";
import type { Ticket, WorkItemState } from "@/lib/db";
import TicketCard from "./TicketCard";
import TicketDetail from "./TicketDetail";

interface Props {
  columns: WorkItemState[];
  grouped: Record<WorkItemState, Ticket[]>;
}

const COLUMN_META: Record<WorkItemState, { accent: string; sub: string }> = {
  Backlog: { accent: "border-tr-slate-2", sub: "Not started" },
  "In Progress": { accent: "border-tr-orange", sub: "Active" },
  Done: { accent: "border-emerald-500", sub: "Closed" },
};

export default function Board({ columns, grouped }: Props) {
  const [selected, setSelected] = useState<Ticket | null>(null);

  return (
    <>
      <div className="flex gap-4 items-start">
        {columns.map((col) => {
          const items = grouped[col] ?? [];
          const meta = COLUMN_META[col];
          return (
            <div
              key={col}
              className="w-80 shrink-0 bg-white rounded shadow-sm border border-gray-200"
            >
              <div
                className={
                  "px-4 py-3 border-t-4 rounded-t flex items-baseline justify-between " +
                  meta.accent
                }
              >
                <div>
                  <div className="font-semibold text-tr-navy">{col}</div>
                  <div className="text-xs text-tr-slate-2">{meta.sub}</div>
                </div>
                <div className="text-sm font-semibold text-tr-slate-2">
                  {items.length}
                </div>
              </div>
              <div className="p-3 space-y-2 min-h-[200px]">
                {items.length === 0 ? (
                  <div className="text-xs text-tr-slate-2 text-center py-6">
                    No work items
                  </div>
                ) : (
                  items.map((t) => (
                    <TicketCard
                      key={t.id}
                      ticket={t}
                      onOpen={() => setSelected(t)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      {selected && (
        <TicketDetail ticket={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
