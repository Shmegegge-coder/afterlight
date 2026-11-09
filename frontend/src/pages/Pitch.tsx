import { useState } from "react";
import { motion } from "motion/react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PITCH_GROUPS, type PitchGroup } from "@/data/business";
import { cn } from "@/lib/utils";

const FILTERS = ["All", "High", "Medium", "Long-term"] as const;

function pitchText(g: PitchGroup) {
  return `Afterlight — pitch for ${g.name}\n\nWhy you: ${g.angle}\n\nNext steps:\n${g.nextSteps.map((s) => `• ${s}`).join("\n")}`;
}

export default function Pitch() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const groups = PITCH_GROUPS.filter((g) => filter === "All" || g.priority === filter);

  const copy = async (g: PitchGroup) => {
    try {
      await navigator.clipboard.writeText(pitchText(g));
      toast.success(`Pitch for ${g.name} copied`);
    } catch {
      toast.error("Couldn't copy. Please select the text manually.");
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Pitch list"
        title="Who to pitch, and what to say"
        intro="Eight groups of buyers, partners and investors. Start with the high-priority groups: they can book services or lend you equipment this quarter."
      >
        <div className="mt-8 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm border transition-colors duration-200",
                filter === f ? "bg-sky-500/15 border-sky-500/60 text-sky-200" : "border-slate-700 text-slate-400 hover:text-slate-100",
              )}
              data-testid={`pitch-filter-${f.toLowerCase()}`}
            >
              {f}
            </button>
          ))}
        </div>
      </PageHeader>

      <section className="mx-auto max-w-7xl px-5 md:px-8 py-12 grid md:grid-cols-2 gap-5">
        {groups.map((g, i) => (
          <motion.article
            key={g.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.04 }}
            className="rounded-xl border border-slate-800 bg-[#131722] p-6 md:p-7 transition-colors duration-300 hover:border-sky-500/40"
            data-testid={`pitch-group-${g.id}`}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-2xl text-slate-100">{g.name}</h2>
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 font-mono text-[10px] uppercase tracking-widest",
                  g.priority === "High" ? "border-emerald-500/50 text-emerald-300" : g.priority === "Medium" ? "border-sky-500/50 text-sky-300" : "border-amber-500/50 text-amber-300",
                )}
              >
                {g.priority}
              </Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {g.examples.map((e) => (
                <span key={e} className="text-xs rounded-md bg-slate-800/70 text-slate-300 px-2 py-1">{e}</span>
              ))}
            </div>
            <p className="mt-5 mono-label !text-slate-500">Pitch angle</p>
            <p className="mt-1.5 text-slate-300 leading-relaxed">{g.angle}</p>
            <p className="mt-5 mono-label !text-slate-500">Next steps</p>
            <ol className="mt-2 space-y-1.5 text-sm text-slate-400 list-decimal list-inside">
              {g.nextSteps.map((s) => <li key={s}>{s}</li>)}
            </ol>
            <Button variant="ghost" size="sm" className="mt-5 text-sky-300 hover:text-sky-200 -ml-2" onClick={() => copy(g)} data-testid={`pitch-copy-button-${g.id}`}>
              <Copy className="size-3.5" /> Copy pitch
            </Button>
          </motion.article>
        ))}
      </section>
    </div>
  );
}
