import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogIn, LogOut, Menu, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { logout, useSession } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/technology", label: "Technology" },
  { to: "/budget", label: "Budget" },
  { to: "/pricing", label: "Pricing" },
  { to: "/pitch", label: "Pitch List" },
];
// Staff-only pages: shown once logged in (the routes are guarded either way).
const STAFF_NAV = [
  { to: "/advisor", label: "AI Advisor" },
  { to: "/memorials", label: "Memorials" },
  { to: "/orders", label: "Orders" },
];

const linkCls = ({ isActive }: { isActive: boolean }) =>
  cn(
    "text-sm transition-colors duration-200",
    isActive ? "text-sky-300" : "text-slate-400 hover:text-slate-100",
  );

export default function SiteLayout() {
  const [open, setOpen] = useState(false);
  const session = useSession();
  const nav = useNavigate();
  const loggedIn = !!session.data;
  const links = loggedIn ? [...NAV, ...STAFF_NAV] : NAV;
  const doLogout = async () => {
    setOpen(false);
    try {
      await logout();
      toast.success("Logged out");
      nav("/");
    } catch {
      toast.error("Couldn't log out. Try again.");
    }
  };
  const authLink = loggedIn ? (
    <button type="button" onClick={doLogout} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 transition-colors duration-200" data-testid="nav-logout-button">
      <LogOut className="size-3.5" /> Log out
    </button>
  ) : (
    <NavLink to="/login" onClick={() => setOpen(false)} className={(a) => cn(linkCls(a), "inline-flex items-center gap-1.5")} data-testid="nav-login-link">
      <LogIn className="size-3.5" /> Staff login
    </NavLink>
  );
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-800/70 bg-[#0B0D12]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-5 md:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group" data-testid="nav-logo-link">
            <span className="relative grid place-items-center size-8 rounded-full border border-sky-500/40 bg-sky-500/10 holo-glow">
              <Sparkles className="size-4 text-sky-300 transition-transform duration-300 group-hover:rotate-12" />
            </span>
            <span className="font-serif text-xl tracking-tight text-slate-100">Afterlight</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-7">
            {links.map((n) => (
              <NavLink key={n.to} to={n.to} className={linkCls} data-testid={`nav-link-${n.to.slice(1)}`}>
                {n.label}
              </NavLink>
            ))}
            {authLink}
          </nav>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className="lg:hidden p-2 rounded-md text-slate-300 hover:bg-slate-800"
              data-testid="nav-mobile-menu-button"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="bg-[#0B0D12] border-slate-800">
              <SheetTitle className="font-serif text-slate-100 px-4 pt-4">Afterlight</SheetTitle>
              <div className="flex flex-col gap-4 p-4">
                {links.map((n) => (
                  <NavLink key={n.to} to={n.to} className={linkCls} onClick={() => setOpen(false)} data-testid={`mobile-nav-link-${n.to.slice(1)}`}>
                    {n.label}
                  </NavLink>
                ))}
                {authLink}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-800/70 mt-24">
        <div className="mx-auto max-w-7xl px-5 md:px-8 py-10 flex flex-col md:flex-row gap-4 md:items-center justify-between">
          <div>
            <p className="font-serif text-lg text-slate-200">Afterlight</p>
            <p className="text-sm text-slate-500">Holographic memorial services. Their memories fill the room.</p>
          </div>
          <p className="mono-label !text-slate-500">Estimates in USD · 2025–2026 US market</p>
        </div>
      </footer>
      <Toaster richColors />
    </div>
  );
}

export function PageHeader({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children?: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-slate-800/70">
      <div className="absolute inset-0 holo-scanlines pointer-events-none" />
      <div className="absolute -top-40 -left-20 size-[480px] rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
      <div className="relative mx-auto max-w-7xl px-5 md:px-8 pt-16 pb-12 md:pt-20 md:pb-14">
        <p className="mono-label mb-4" data-testid="page-eyebrow">{eyebrow}</p>
        <h1 className="text-4xl md:text-5xl tracking-tight text-slate-100 max-w-3xl leading-[1.08]" data-testid="page-title">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-slate-400 leading-relaxed text-base md:text-lg">{intro}</p>
        {children}
      </div>
    </section>
  );
}
