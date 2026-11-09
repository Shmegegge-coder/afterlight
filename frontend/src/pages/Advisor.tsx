import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Loader2, Sparkles, Trash2, Square } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiDelete, apiGet, apiStream, errorMessage } from "@/lib/api";
import type { Plan, PlanRequest, PlanStreamEvent } from "@/lib/types";
import { usd } from "@/data/business";
import { cn } from "@/lib/utils";

const EMPTY: PlanRequest = {
  city: "",
  budget: 25000,
  goals: "Launch in 3 months with a rent-first model, partner with 3 local funeral homes, and reach 4 services a month.",
  experience: "",
};

export default function Advisor() {
  const qc = useQueryClient();
  const [form, setForm] = useState<PlanRequest>(EMPTY);
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const plans = useQuery({ queryKey: ["plans"], queryFn: () => apiGet<Plan[]>("/advisor/plans") });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/advisor/plans/${id}`),
    onSuccess: (_d, id) => {
      if (id === selectedId) { setSelectedId(null); setOutput(""); }
      qc.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Plan deleted");
    },
  });

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.city.trim() || !form.goals.trim() || form.budget <= 0) {
      toast.error("Please enter a city, a budget and your goals.");
      return;
    }
    setOutput("");
    setSelectedId(null);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await apiStream<PlanStreamEvent>("/advisor/plans/stream", form, (ev) => {
        if (ev.type === "delta") setOutput((o) => o + ev.content);
        else if (ev.type === "done") { setSelectedId(ev.id); toast.success("Plan saved"); }
        else if (ev.type === "error") toast.error(ev.message);
      }, ctrl.signal);
      qc.invalidateQueries({ queryKey: ["plans"] });
    } catch (err) {
      if (!ctrl.signal.aborted) toast.error(errorMessage(err, "The advisor is unavailable right now."));
    } finally {
      setStreaming(false);
    }
  };

  const open = (p: Plan) => {
    if (streaming) return;
    setSelectedId(p.id);
    setOutput(p.content);
  };

  return (
    <div>
      <PageHeader
        eyebrow="AI business advisor · Claude Sonnet 5.5"
        title="A launch plan for your city and budget"
        intro="Enter your market, budget and goals. The advisor writes a plan covering software and hardware, a budget table, pricing, break-even, who to pitch locally, a 90-day roadmap and a 60-second pitch script."
      />
      <section className="mx-auto max-w-7xl px-5 md:px-8 py-12 grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <form onSubmit={generate} className="rounded-xl backdrop-blur-xl bg-slate-900/80 border border-slate-700/50 shadow-2xl p-6 space-y-4" data-testid="advisor-form">
            <div className="space-y-1.5">
              <Label htmlFor="city">City / market</Label>
              <Input id="city" placeholder="e.g. Atlanta, GA" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="bg-[#0B0D12] border-slate-700" data-testid="advisor-city-input" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget">Starting budget (USD)</Label>
              <Input id="budget" type="number" min={1} step={1000} value={form.budget} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} className="bg-[#0B0D12] border-slate-700 font-mono" data-testid="advisor-budget-input" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goals">Goals</Label>
              <Textarea id="goals" rows={4} value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} className="bg-[#0B0D12] border-slate-700" data-testid="advisor-goals-input" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp">Your background <span className="text-slate-500">(optional)</span></Label>
              <Input id="exp" placeholder="e.g. 10 years in event AV" value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} className="bg-[#0B0D12] border-slate-700" data-testid="advisor-experience-input" />
            </div>
            {streaming ? (
              <Button type="button" variant="outline" className="w-full border-slate-600" onClick={() => abortRef.current?.abort()} data-testid="advisor-stop-button">
                <Square className="size-4" /> Stop
              </Button>
            ) : (
              <Button type="submit" className="w-full bg-sky-500 hover:bg-sky-400 text-white" data-testid="advisor-generate-button">
                <Sparkles className="size-4" /> Generate my plan
              </Button>
            )}
          </form>

          <div>
            <p className="mono-label mb-3">Saved plans</p>
            <div className="space-y-2" data-testid="advisor-saved-plans">
              {plans.isError && <p className="text-sm text-slate-500">Saved plans are unavailable right now.</p>}
              {plans.data?.length === 0 && <p className="text-sm text-slate-500">No plans yet. Your first one will appear here.</p>}
              {!plans.isError && plans.data?.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    "group flex items-center justify-between gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors duration-200",
                    selectedId === p.id ? "border-sky-500/50 bg-sky-500/5" : "border-slate-800 bg-[#131722] hover:border-slate-600",
                  )}
                  onClick={() => open(p)}
                  data-testid={`advisor-plan-item-${p.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm text-slate-100 truncate">{p.city}</p>
                    <p className="text-xs text-slate-500 font-mono">{usd(p.budget)} · {new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); del.mutate(p.id); }}
                    className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200"
                    aria-label="Delete plan"
                    data-testid={`advisor-plan-delete-${p.id}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="relative rounded-xl border border-slate-800 bg-[#131722] min-h-[520px] p-6 md:p-10 overflow-hidden" data-testid="advisor-output">
            <div className="absolute inset-0 holo-scanlines pointer-events-none" />
            {!output && !streaming && (
              <div className="relative h-full min-h-[440px] grid place-items-center text-center">
                <div>
                  <Sparkles className="size-8 text-sky-400 mx-auto animate-glow-pulse" />
                  <p className="mt-4 font-serif text-2xl text-slate-200">Your plan will appear here</p>
                  <p className="mt-2 text-sm text-slate-500 max-w-sm">It takes 30–60 seconds. Plans are saved automatically so you can come back to them.</p>
                </div>
              </div>
            )}
            {streaming && !output && (
              <div className="relative flex items-center gap-3 text-slate-400"><Loader2 className="size-4 animate-spin" /> Thinking through your market…</div>
            )}
            {output && (
              <article className="relative prose-afterlight" data-testid="advisor-output-content">
                <ReactMarkdown>{output}</ReactMarkdown>
                {streaming && <span className="inline-block w-2 h-5 bg-sky-400 animate-pulse align-middle" />}
              </article>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
