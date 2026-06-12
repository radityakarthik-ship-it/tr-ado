"use client";

import type { Ticket } from "@/lib/db";

export default function TicketDetail({
  ticket,
  onClose,
}: {
  ticket: Ticket;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 flex items-stretch justify-end"
      onClick={onClose}
    >
      <div
        className="bg-white w-[640px] max-w-full h-full overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-tr-navy text-white px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-tr-orange">
              {ticket.type} &middot; #{ticket.id}
            </div>
            <div className="font-semibold mt-1">{ticket.title}</div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <Section label="Description">
            <p className="text-sm text-tr-navy-2 whitespace-pre-line">
              {ticket.description || "No description provided."}
            </p>
          </Section>
          <div className="grid grid-cols-2 gap-4">
            <Field label="State" value={ticket.state} />
            <Field label="Priority" value={`P${ticket.priority}`} />
            <Field label="Assigned to" value={ticket.assignee} />
            <Field label="Area" value={ticket.tag || "—"} />
            <Field
              label="Created"
              value={new Date(ticket.created_at).toLocaleString()}
            />
            <Field
              label="Updated"
              value={new Date(ticket.updated_at).toLocaleString()}
            />
          </div>
          <Section label="History">
            <ol className="text-sm text-tr-slate-2 space-y-1.5">
              <li>
                <span className="text-tr-navy font-medium">
                  {ticket.assignee}
                </span>{" "}
                created this work item.
              </li>
              {ticket.state !== "Backlog" && (
                <li>
                  State changed to{" "}
                  <span className="text-tr-navy font-medium">{ticket.state}</span>.
                </li>
              )}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-tr-slate-2 mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-tr-slate-2 mb-0.5">
        {label}
      </div>
      <div className="text-sm text-tr-navy">{value}</div>
    </div>
  );
}
