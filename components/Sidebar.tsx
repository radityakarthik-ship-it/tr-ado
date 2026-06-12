import Link from "next/link";
import type { ProjectKey } from "@/lib/db";

export type SidebarSection =
  | "overview"
  | "boards"
  | "repos"
  | "pipelines"
  | "testplans"
  | "settings";

interface NavItem {
  icon: string;
  label: string;
  section: SidebarSection;
  href?: (project: ProjectKey) => string;
  children?: string[];
}

const nav: NavItem[] = [
  {
    icon: "▤",
    label: "Overview",
    section: "overview",
    href: (p) => `/${p}/overview`,
  },
  {
    icon: "▦",
    label: "Boards",
    section: "boards",
    href: (p) => `/${p}`,
    children: ["Work items", "Boards", "Backlogs", "Sprints", "Queries"],
  },
  {
    icon: "≡",
    label: "Repos",
    section: "repos",
    children: ["Files", "Commits", "Pull requests", "Branches"],
  },
  {
    icon: "▷",
    label: "Pipelines",
    section: "pipelines",
    children: ["Pipelines", "Environments", "Releases", "Library"],
  },
  { icon: "✓", label: "Test Plans", section: "testplans" },
  { icon: "⚙", label: "Project settings", section: "settings" },
];

export default function Sidebar({
  activeProject,
  activeSection,
}: {
  activeProject: ProjectKey;
  activeSection: SidebarSection;
}) {
  return (
    <aside className="w-60 bg-white border-r border-gray-200 py-4 text-sm">
      <div className="px-4 pb-3 mb-2 border-b border-gray-100">
        <div className="text-xs uppercase tracking-wider text-tr-slate-2">
          Project
        </div>
        <div className="font-semibold text-tr-navy mt-0.5">{activeProject}</div>
      </div>
      <nav className="px-2">
        {nav.map((item) => {
          const isActive = item.section === activeSection;
          const rowClass =
            "flex items-center gap-2 px-3 py-1.5 rounded " +
            (isActive
              ? "bg-tr-orange/10 text-tr-navy font-medium"
              : "text-tr-navy-2 hover:bg-gray-100");
          const row = (
            <div className={rowClass}>
              <span className="w-4 text-center text-tr-orange">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          );
          return (
            <div key={item.label} className="mb-1">
              {item.href ? (
                <Link href={item.href(activeProject)} className="block">
                  {row}
                </Link>
              ) : (
                <div className="cursor-default">{row}</div>
              )}
              {isActive && item.children && (
                <div className="ml-7 mt-1">
                  {item.children.map((c, i) => (
                    <div
                      key={c}
                      className={
                        "px-3 py-1 rounded text-sm " +
                        (i === 1
                          ? "text-tr-navy font-semibold"
                          : "text-tr-slate-2 hover:bg-gray-100 cursor-default")
                      }
                    >
                      {c}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
