interface NavItem {
  icon: string;
  label: string;
  active?: boolean;
  children?: string[];
}

const nav: NavItem[] = [
  { icon: "▤", label: "Overview" },
  {
    icon: "▦",
    label: "Boards",
    active: true,
    children: ["Work items", "Boards", "Backlogs", "Sprints", "Queries"],
  },
  { icon: "≡", label: "Repos", children: ["Files", "Commits", "Pull requests", "Branches"] },
  { icon: "▷", label: "Pipelines", children: ["Pipelines", "Environments", "Releases", "Library"] },
  { icon: "✓", label: "Test Plans" },
  { icon: "⚙", label: "Project settings" },
];

export default function Sidebar() {
  return (
    <aside className="w-60 bg-white border-r border-gray-200 py-4 text-sm">
      <div className="px-4 pb-3 mb-2 border-b border-gray-100">
        <div className="text-xs uppercase tracking-wider text-tr-slate-2">
          Project
        </div>
        <div className="font-semibold text-tr-navy mt-0.5">Platform</div>
      </div>
      <nav className="px-2">
        {nav.map((item) => (
          <div key={item.label} className="mb-1">
            <div
              className={
                "flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer " +
                (item.active
                  ? "bg-tr-orange/10 text-tr-navy font-medium"
                  : "text-tr-navy-2 hover:bg-gray-100")
              }
            >
              <span className="w-4 text-center text-tr-orange">{item.icon}</span>
              <span>{item.label}</span>
            </div>
            {item.active && item.children && (
              <div className="ml-7 mt-1">
                {item.children.map((c) => (
                  <div
                    key={c}
                    className={
                      "px-3 py-1 rounded text-sm cursor-pointer " +
                      (c === "Boards"
                        ? "text-tr-navy font-semibold"
                        : "text-tr-slate-2 hover:bg-gray-100")
                    }
                  >
                    {c}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
