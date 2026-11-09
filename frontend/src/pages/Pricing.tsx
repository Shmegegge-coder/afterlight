import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/SiteLayout";
import { Input } from "@/components/ui/input";
import { DEFAULT_PAYMENT_FEE, DEFAULT_REV_SHARE, TIERS, type Tier, usd } from "@/data/business";
import { cn } from "@/lib/utils";

const priceOf = (t: Tier) => Math.round((t.cost * (1 + t.markup / 100)) / 50) * 50;
const netOf = (t: Tier, takePct: number) => priceOf(t) * (1 - takePct / 100) - t.cost;
const MIN_MARGIN = 25; // % of price kept after cost, share and fees

export default function Pricing() {
  const [tiers, setTiers] = useState<Tier[]>(TIERS);
  const [overhead, setOverhead] = useState(4000);
  const [revShare, setRevShare] = useState(DEFAULT_REV_SHARE);
  const [payFee, setPayFee] = useState(DEFAULT_PAYMENT_FEE);
  const take = revShare + payFee;

  const set = (id: Tier["id"], patch: Partial<Tier>) => setTiers((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const m = useMemo(() => {
    const mixTotal = tiers.reduce((a, t) => a + t.mix, 0) || 1;
    const avgProfit = tiers.reduce((a, t) => a + netOf(t, take) * (t.mix / mixTotal), 0);
    const avgPrice = tiers.reduce((a, t) => a + priceOf(t) * (t.mix / mixTotal), 0);
    const breakEven = avgProfit > 0 ? overhead / avgProfit : Infinity;
    const chart = [1, 2, 3, 4, 6, 8, 10, 12].map((n) => ({ events: `${n}`, profit: Math.round(n * avgProfit - overhead) }));
    return { avgProfit, avgPrice, breakEven, chart };
  }, [tiers, overhead, take]);

  return (
    <div>
      <PageHeader
        eyebrow="Pricing calculator"
        title="What to charge for a holographic memorial"
        intro="Each tier's price is its itemised delivery cost plus your markup, rounded to the nearest $50. Profit is what's left after the funeral-home revenue share and card fees. Packages under a 25% margin are flagged."
      />

      <section className="mx-auto max-w-7xl px-5 md:px-8 py-12">
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {tiers.map((t) => {
            const price = priceOf(t);
            const net = netOf(t, take);
            const margin = price > 0 ? (net / price) * 100 : 0;
            const weak = margin < MIN_MARGIN;
            const featured = t.id === "signature";
            return (
              <div
                key={t.id}
                className={cn(
                  "rounded-xl border p-6 bg-[#131722] flex flex-col transition-[border-color,box-shadow] duration-300",
                  featured ? "border-sky-500/50 holo-glow xl:-translate-y-3" : "border-slate-800 hover:border-slate-600",
                  t.id === "legacy" && "border-amber-500/30",
                )}
                data-testid={`pricing-tier-${t.id}`}
              >
                <div className="flex items-center justify-between">
                  <p className={cn("mono-label", t.id === "legacy" && "!text-amber-400")}>{t.name}</p>
                  {featured && <span className="text-[10px] font-mono uppercase tracking-widest rounded-full bg-sky-500/15 text-sky-300 px-2 py-0.5">Most booked</span>}
                </div>
                <p className="mt-4 font-serif text-4xl text-slate-100" data-testid={`pricing-price-${t.id}`}>{usd(price)}</p>
                <p className="mt-2 text-sm text-slate-400">{t.tagline}</p>
                <ul className="mt-5 space-y-2 text-sm text-slate-300 flex-1">
                  {t.includes.map((x) => (
                    <li key={x} className="flex gap-2"><Check className="size-4 text-emerald-400 shrink-0 mt-0.5" />{x}</li>
                  ))}
                </ul>
                <div className="mt-6 pt-5 border-t border-slate-800 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs text-slate-500" htmlFor={`cost-${t.id}`}>Your cost / event</label>
                    <Input
                      id={`cost-${t.id}`}
                      type="number"
                      min={0}
                      step={50}
                      value={t.cost}
                      onChange={(e) => set(t.id, { cost: Math.max(0, Number(e.target.value)) })}
                      className="w-28 font-mono text-right bg-[#0B0D12] border-slate-700"
                      data-testid={`pricing-cost-input-${t.id}`}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Markup</span><span className="font-mono text-sky-300">{t.markup}%</span></div>
                    <input type="range" min={20} max={300} step={5} value={t.markup} onChange={(e) => set(t.id, { markup: Number(e.target.value) })} className="w-full accent-sky-500" data-testid={`pricing-markup-slider-${t.id}`} />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs"><span className="text-slate-500">Share of bookings</span><span className="font-mono text-sky-300">{t.mix}%</span></div>
                    <input type="range" min={0} max={100} step={5} value={t.mix} onChange={(e) => set(t.id, { mix: Number(e.target.value) })} className="w-full accent-sky-500" data-testid={`pricing-mix-slider-${t.id}`} />
                  </div>
                  <p className="text-xs text-slate-500">
                    Net profit per event: <span className={cn("font-mono", weak ? "text-rose-400" : "text-emerald-400")} data-testid={`pricing-net-${t.id}`}>{usd(net)}</span>
                    <span className="text-slate-600"> · {margin.toFixed(0)}% margin</span>
                  </p>
                  {weak && <p className="text-xs text-rose-400" data-testid={`pricing-warning-${t.id}`}>Below {MIN_MARGIN}% margin. Raise markup or cut cost.</p>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-xl border border-slate-800 bg-[#131722] p-5">
              <label htmlFor="overhead" className="text-sm text-slate-300">Fixed monthly overhead</label>
              <p className="text-xs text-slate-500">Storage, insurance, software, phone, your base salary</p>
              <Input id="overhead" type="number" min={0} step={100} value={overhead} onChange={(e) => setOverhead(Math.max(0, Number(e.target.value)))} className="mt-3 font-mono bg-[#0B0D12] border-slate-700" data-testid="pricing-overhead-input" />
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#131722] p-5 space-y-4">
              <div>
                <div className="flex justify-between text-sm"><span className="text-slate-300">Funeral-home revenue share</span><span className="font-mono text-sky-300">{revShare}%</span></div>
                <input type="range" min={0} max={40} step={1} value={revShare} onChange={(e) => setRevShare(Number(e.target.value))} className="w-full accent-sky-500" data-testid="pricing-revshare-slider" />
              </div>
              <div>
                <div className="flex justify-between text-sm"><span className="text-slate-300">Card / payment fees</span><span className="font-mono text-sky-300">{payFee}%</span></div>
                <input type="range" min={0} max={6} step={0.5} value={payFee} onChange={(e) => setPayFee(Number(e.target.value))} className="w-full accent-sky-500" data-testid="pricing-fee-slider" />
              </div>
            </div>
            <div className="rounded-xl border border-sky-500/40 bg-[#131722] p-5 holo-glow">
              <p className="mono-label">Break-even</p>
              <p className="mt-3 font-serif text-4xl text-slate-100" data-testid="pricing-break-even-value">
                {Number.isFinite(m.breakEven) ? m.breakEven.toFixed(1) : "—"} <span className="text-base text-slate-400 font-sans">services / month</span>
              </p>
              <p className="mt-3 text-sm text-slate-400">Average ticket <span className="font-mono text-slate-200" data-testid="pricing-avg-price">{usd(m.avgPrice)}</span> · average net profit <span className="font-mono text-emerald-400" data-testid="pricing-avg-profit">{usd(m.avgProfit)}</span></p>
            </div>
          </div>
          <div className="lg:col-span-8 rounded-xl border border-slate-800 bg-[#131722] p-5">
            <p className="text-sm text-slate-300">Monthly profit by number of services</p>
            <div className="h-72 mt-4" data-testid="pricing-profit-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.chart}>
                  <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="events" stroke="#64748B" fontSize={11} />
                  <YAxis stroke="#64748B" fontSize={11} width={56} tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} />
                  <ReferenceLine y={0} stroke="#475569" />
                  <Tooltip
                    cursor={{ fill: "rgba(56,189,248,0.06)" }}
                    contentStyle={{ background: "#131722", border: "1px solid #334155", borderRadius: 8 }}
                    formatter={(value: number) => [usd(value), "Profit"]}
                    labelFormatter={(label: string) => `${label} services / month`}
                  />
                  <Bar dataKey="profit" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
