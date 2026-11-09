import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BUDGET_DEFAULTS, type BudgetItem, type PlanKey, usd } from "@/data/business";
import { cn } from "@/lib/utils";

function sum(items: BudgetItem[], kind: BudgetItem["kind"], plan: PlanKey) {
  return items.filter((i) => i.kind === kind).reduce((a, i) => a + (Number(i[plan]) || 0), 0);
}

function ItemTable({ items, kind, onChange }: { items: BudgetItem[]; kind: BudgetItem["kind"]; onChange: (id: string, plan: PlanKey, v: number) => void }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#131722] overflow-hidden">
      <div className="grid grid-cols-[1fr_110px_110px] md:grid-cols-[1fr_130px_130px] gap-3 px-5 py-3 border-b border-slate-800 mono-label !text-slate-500">
        <span>Item</span><span className="text-right">Rent-first</span><span className="text-right">Buy</span>
      </div>
      {items.filter((i) => i.kind === kind).map((i) => (
        <div key={i.id} className="grid grid-cols-[1fr_110px_110px] md:grid-cols-[1fr_130px_130px] gap-3 px-5 py-3 border-b border-slate-800/60 last:border-0 items-center">
          <div>
            <p className="text-slate-100 text-sm">{i.label}</p>
            <p className="text-xs text-slate-500">{i.note}</p>
          </div>
          {(["rent", "buy"] as const).map((p) => (
            <Input
              key={p}
              type="number"
              min={0}
              step={50}
              value={i[p]}
              onChange={(e) => onChange(i.id, p, Number(e.target.value))}
              className="font-mono text-right bg-[#0B0D12] border-slate-700"
              data-testid={`budget-input-${i.id}-${p}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Budget() {
  const [items, setItems] = useState<BudgetItem[]>(BUDGET_DEFAULTS);
  const [eventsPerMonth, setEventsPerMonth] = useState(3);

  const update = (id: string, plan: PlanKey, v: number) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [plan]: Math.max(0, v) } : i)));

  const t = useMemo(() => {
    const startRent = sum(items, "startup", "rent");
    const startBuy = sum(items, "startup", "buy");
    const evRent = sum(items, "event", "rent");
    const evBuy = sum(items, "event", "buy");
    const savings = evRent - evBuy;
    const crossoverEvents = savings > 0 ? Math.ceil((startBuy - startRent) / savings) : null;
    const chart = Array.from({ length: 25 }, (_, m) => ({
      month: m,
      "Rent-first": startRent + evRent * eventsPerMonth * m,
      "Buy equipment": startBuy + evBuy * eventsPerMonth * m,
    }));
    return { startRent, startBuy, evRent, evBuy, crossoverEvents, chart };
  }, [items, eventsPerMonth]);

  const crossoverMonths = t.crossoverEvents !== null && eventsPerMonth > 0 ? Math.ceil(t.crossoverEvents / eventsPerMonth) : null;

  return (
    <div>
      <PageHeader
        eyebrow="Budget calculator"
        title="What it costs to launch, and to run each service"
        intro="The numbers below are researched US estimates. Edit any of them. Compare renting hardware for each event, which costs little to start, with buying your own, which costs more upfront but less per event."
      >
        <Button variant="outline" className="mt-8 border-slate-700" onClick={() => setItems(BUDGET_DEFAULTS)} data-testid="budget-reset-button">
          <RotateCcw className="size-4" /> Reset to defaults
        </Button>
      </PageHeader>

      <section className="mx-auto max-w-7xl px-5 md:px-8 py-12 grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <div>
            <h2 className="text-2xl text-slate-100 mb-4">One-time startup costs</h2>
            <ItemTable items={items} kind="startup" onChange={update} />
          </div>
          <div>
            <h2 className="text-2xl text-slate-100 mb-1">Cost per event</h2>
            <p className="text-sm text-slate-500 mb-4">Average across the package mix on the Pricing page. Funeral-home share and card fees are a % of price, so they live on the Pricing page.</p>
            <ItemTable items={items} kind="event" onChange={update} />
          </div>
        </div>

        <aside className="lg:col-span-5">
          <div className="lg:sticky lg:top-24 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { k: "Rent-first", start: t.startRent, ev: t.evRent, tone: "sky", id: "rent" },
                { k: "Buy equipment", start: t.startBuy, ev: t.evBuy, tone: "amber", id: "buy" },
              ].map((p) => (
                <div key={p.k} className={cn("rounded-xl border p-5 bg-[#131722]", p.tone === "sky" ? "border-sky-500/40 holo-glow" : "border-amber-500/30")}>
                  <p className={cn("mono-label", p.tone === "amber" && "!text-amber-400")}>{p.k}</p>
                  <p className="mt-4 text-xs text-slate-500">Startup</p>
                  <p className="font-mono text-2xl text-slate-100" data-testid={`budget-startup-${p.id}`}>{usd(p.start)}</p>
                  <p className="mt-3 text-xs text-slate-500">Per event</p>
                  <p className="font-mono text-lg text-slate-200" data-testid={`budget-per-event-${p.id}`}>{usd(p.ev)}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#131722] p-5">
              <div className="flex items-center justify-between">
                <label htmlFor="epm" className="text-sm text-slate-300">Services per month</label>
                <span className="font-mono text-sky-300" data-testid="budget-events-per-month-value">{eventsPerMonth}</span>
              </div>
              <input
                id="epm"
                type="range"
                min={1}
                max={12}
                value={eventsPerMonth}
                onChange={(e) => setEventsPerMonth(Number(e.target.value))}
                className="w-full mt-3 accent-sky-500"
                data-testid="budget-events-per-month-slider"
              />
              <p className="mt-4 text-sm text-slate-400" data-testid="budget-crossover-text">
                {crossoverMonths !== null
                  ? <>Buying pays for itself after <span className="text-amber-300 font-mono">{t.crossoverEvents}</span> services, about <span className="text-amber-300 font-mono">{crossoverMonths}</span> months at this pace.</>
                  : "With these numbers, buying never becomes cheaper than renting."}
              </p>
              <div className="h-64 mt-4" data-testid="budget-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={t.chart} margin={{ left: 0, right: 8, top: 8 }}>
                    <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" />
                    <XAxis dataKey="month" stroke="#64748B" fontSize={11} tickFormatter={(m: number) => `${m}m`} />
                    <YAxis stroke="#64748B" fontSize={11} tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} width={48} />
                    <Tooltip
                      contentStyle={{ background: "#131722", border: "1px solid #334155", borderRadius: 8 }}
                      formatter={(value: number, name: string) => [usd(value), name]}
                      labelFormatter={(label: string) => `Month ${label}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="Rent-first" stroke="#38BDF8" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Buy equipment" stroke="#F59E0B" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-slate-500 mt-2">Total money spent over 24 months, including startup costs.</p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
