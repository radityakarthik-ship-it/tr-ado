export default function Header() {
  return (
    <header className="bg-tr-navy text-white border-b border-black/30">
      <div className="flex items-center h-12 px-4 gap-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-sm bg-tr-orange flex items-center justify-center font-bold text-tr-navy">
            TR
          </div>
          <div className="font-semibold tracking-wide">TR ADO</div>
        </div>
        <div className="flex items-center gap-1 ml-6 text-sm">
          <NavTab label="Platform" active />
          <NavTab label="Editorial" />
          <NavTab label="Compliance" />
          <NavTab label="Infrastructure" />
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-sm">
          <div className="relative">
            <input
              placeholder="Search work items"
              className="bg-white/10 placeholder-white/50 text-white text-sm rounded px-3 py-1.5 w-72 outline-none focus:bg-white/20"
              readOnly
            />
          </div>
          <div className="h-8 w-8 rounded-full bg-tr-orange text-tr-navy flex items-center justify-center font-semibold">
            AN
          </div>
        </div>
      </div>
    </header>
  );
}

function NavTab({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <div
      className={
        "px-3 py-1.5 text-sm rounded cursor-pointer " +
        (active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10")
      }
    >
      {label}
    </div>
  );
}
