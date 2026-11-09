import { Outlet } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

// Minimal shell for family-facing pages (intake, review): no business nav, no pricing links.
export default function FamilyLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800/70 bg-[#0B0D12]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-5 md:px-8 h-16 flex items-center gap-2.5">
          <span className="grid place-items-center size-8 rounded-full border border-sky-500/40 bg-sky-500/10 holo-glow">
            <Sparkles className="size-4 text-sky-300" />
          </span>
          <span className="font-serif text-xl tracking-tight text-slate-100">Afterlight</span>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-800/70 py-6 text-center text-xs text-slate-500">
        Your photos and stories are used only to create this memorial. Questions? Reply to the message that sent you this link.
      </footer>
      <Toaster richColors />
    </div>
  );
}
