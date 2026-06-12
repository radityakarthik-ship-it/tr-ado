import { notFound } from "next/navigation";
import {
  listTickets,
  PROJECTS,
  ProjectKey,
  seedIfEmpty,
  Ticket,
} from "@/lib/db";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Overview from "@/components/Overview";

export const dynamic = "force-dynamic";

interface Props {
  params: { project: string };
}

function parseProject(value: string): ProjectKey | null {
  const decoded = decodeURIComponent(value);
  return (PROJECTS as string[]).includes(decoded) ? (decoded as ProjectKey) : null;
}

async function loadTickets(project: ProjectKey): Promise<{
  tickets: Ticket[];
  error: string | null;
}> {
  try {
    await seedIfEmpty();
    const tickets = await listTickets(project);
    return { tickets, error: null };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { tickets: [], error: message };
  }
}

export default async function OverviewPage({ params }: Props) {
  const project = parseProject(params.project);
  if (!project) notFound();

  const { tickets, error } = await loadTickets(project);

  return (
    <div className="min-h-screen flex flex-col bg-[#f3f5f8]">
      <Header activeProject={project} />
      <div className="flex-1 flex">
        <Sidebar activeProject={project} activeSection="overview" />
        <main className="flex-1 px-8 py-6 overflow-x-auto">
          <div className="mb-6">
            <div className="text-xs uppercase tracking-wider text-tr-slate-2">
              Overview
            </div>
            <h1 className="text-2xl font-semibold text-tr-navy mt-1">
              {project}
            </h1>
          </div>
          {error && (
            <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="font-semibold mb-1">Storage warming up</div>
              <div className="text-xs">{error}</div>
            </div>
          )}
          <Overview project={project} tickets={tickets} />
        </main>
      </div>
      <footer className="border-t border-gray-200 bg-white px-8 py-3 text-xs text-tr-slate-2">
        &copy; 2026 TR ADO. All rights reserved.
      </footer>
    </div>
  );
}
