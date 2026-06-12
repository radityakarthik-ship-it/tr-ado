import Link from "next/link";
import { PROJECTS, ProjectKey } from "@/lib/db";

export default function Header({
  activeProject,
}: {
  activeProject: ProjectKey;
}) {
  return (
    <header className="bg-tr-navy text-white border-b border-black/30">
      <div className="flex items-center h-12 px-4 gap-4">
        <Link href={`/${activeProject}`} className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-sm bg-tr-orange flex items-center justify-center font-bold text-tr-navy">
            TR
          </div>
          <div className="font-semibold tracking-wide">TR ADO</div>
        </Link>
        <div className="flex items-center gap-1 ml-6 text-sm">
          {PROJECTS.map((p) => (
            <NavTab key={p} label={p} project={p} active={p === activeProject} />
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-sm">
          <input
            placeholder="Search work items"
            className="bg-white/10 placeholder-white/50 text-white text-sm rounded px-3 py-1.5 w-72 outline-none focus:bg-white/20"
            readOnly
          />
          <div className="h-8 w-8 rounded-full bg-tr-orange text-tr-navy flex items-center justify-center font-semibold">
            AN
          </div>
        </div>
      </div>
    </header>
  );
}

function NavTab({
  label,
  project,
  active,
}: {
  label: string;
  project: ProjectKey;
  active: boolean;
}) {
  return (
    <Link
      href={`/${project}`}
      className={
        "px-3 py-1.5 text-sm rounded " +
        (active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10")
      }
    >
      {label}
    </Link>
  );
}
