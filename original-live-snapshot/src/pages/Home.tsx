import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Calculator, Cpu, Megaphone, Play, Bot, Tags } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { IMG } from "@/data/business";
import { cn } from "@/lib/utils";

const ACTS = [
  { n: "I", title: "Arrival", body: "Guests enter a softly lit room. The person's name glows in the air above the urn or portrait, and quiet music plays." },
  { n: "II", title: "The memories", body: "During the eulogy, moments from their life fill every wall: fishing at dawn, a wedding dance, Sunday baking. Each one glows and drifts like a memory being remembered." },
  { n: "III", title: "The ascension", body: "To close, the person appears life-size, opens luminous wings and rises into golden light. It gives a farewell when an open casket isn't possible." },
];

const TOOLS = [
  { to: "/technology", icon: Cpu, title: "Technology stack", body: "Projection hardware, show-control software, AI tools and workflow.", span: "md:col-span-2" },
  { to: "/budget", icon: Calculator, title: "Budget calculator", body: "Startup and per-event costs. Rent first or buy equipment.", span: "" },
  { to: "/pricing", icon: Tags, title: "Pricing & break-even", body: "Three service tiers and profit by booking volume.", span: "" },
  { to: "/pitch", icon: Megaphone, title: "Who to pitch", body: "Eight buyer groups with angles and next steps.", span: "" },
  { to: "/advisor", icon: Bot, title: "AI business advisor", body: "A plan tailored to your city, budget and goals.", span: "" },
];

const fade = { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.7 } };

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[88vh] flex items-end overflow-hidden">
        <img src={IMG.hero} alt="" className="absolute inset-0 size-full object-cover animate-kenburns" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(11,13,18,0.55), rgba(11,13,18,0.94) 78%, #0B0D12)" }} />
        <div className="absolute inset-0 holo-scanlines" />
        <div className="relative mx-auto max-w-7xl w-full px-5 md:px-8 pb-20 pt-32 grid lg:grid-cols-12 gap-10 items-end">
          <motion.div className="lg:col-span-7" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
            <p className="mono-label mb-6">Holographic memorial services</p>
            <h1 className="text-5xl md:text-7xl leading-[1.02] tracking-tight text-white" data-testid="hero-title">
              Let their memories <em className="text-holo not-italic animate-flicker">fill the room.</em>
            </h1>
            <p className="mt-7 max-w-xl text-lg text-slate-300 leading-relaxed">
              When an open casket isn't possible, or after a cremation, Afterlight projects a person's life across the whole room.
              Each moment appears the way you remember it, and the service ends as they rise to heaven with wings.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/memorials/sample-eleanor-vance/show"
                className={cn(buttonVariants({ size: "lg" }), "h-12 px-6 bg-sky-500 hover:bg-sky-400 text-white holo-glow")}
                data-testid="hero-watch-show-button"
              >
                <Play className="size-4" /> Watch a Memory Show
              </Link>
              <Link
                to="/budget"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 px-6 border-slate-600 bg-slate-900/40 backdrop-blur")}
                data-testid="hero-business-case-button"
              >
                See the business case <ArrowRight className="size-4" />
              </Link>
            </div>
          </motion.div>
          <motion.div
            className="lg:col-span-4 lg:col-start-9 rounded-xl backdrop-blur-xl bg-slate-900/70 border border-slate-700/50 shadow-2xl p-6"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
          >
            <p className="mono-label mb-4">The business at a glance</p>
            <dl className="space-y-4">
              {[
                ["Startup (rent-first)", "≈ $17k – $25k"],
                ["Startup (buy equipment)", "≈ $70k – $95k"],
                ["What to charge", "$3,500 – $15,000"],
                ["Break-even", "≈ 2–3 services / month"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b border-slate-800 pb-3 last:border-0 last:pb-0">
                  <dt className="text-sm text-slate-400">{k}</dt>
                  <dd className="font-mono text-slate-100" data-testid={`glance-${k.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{v}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        </div>
      </section>

      {/* Three acts */}
      <section className="mx-auto max-w-7xl px-5 md:px-8 py-24">
        <motion.div {...fade} className="max-w-2xl">
          <p className="mono-label mb-4">A service in three acts</p>
          <h2 className="text-3xl md:text-4xl text-slate-100 tracking-tight">Not a slideshow. A room you walk into.</h2>
        </motion.div>
        <div className="mt-14 grid md:grid-cols-3 gap-px bg-slate-800/60 rounded-xl overflow-hidden">
          {ACTS.map((a, i) => (
            <motion.div key={a.n} {...fade} transition={{ duration: 0.7, delay: i * 0.12 }} className="bg-[#0B0D12] p-8 md:p-10 group">
              <span className={cn("font-serif text-5xl", i === 2 ? "text-gold-glow" : "text-holo")}>{a.n}</span>
              <h3 className="mt-6 text-2xl text-slate-100">{a.title}</h3>
              <p className="mt-3 text-slate-400 leading-relaxed">{a.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Why */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-5 md:px-8 py-20 grid lg:grid-cols-12 gap-12 items-center">
          <motion.div {...fade} className="lg:col-span-6 relative">
            <img src={IMG.ascension} alt="Golden light through clouds" className="rounded-xl w-full aspect-[4/3] object-cover gold-aura" />
            <div className="absolute inset-0 rounded-xl holo-scanlines" />
          </motion.div>
          <motion.div {...fade} className="lg:col-span-5 lg:col-start-8">
            <p className="mono-label mb-4 !text-amber-400">Why families need it</p>
            <h2 className="text-3xl md:text-4xl text-slate-100 tracking-tight">Over 60% of Americans are now cremated.</h2>
            <p className="mt-5 text-slate-400 leading-relaxed">
              Accidents, illness and long-distance deaths often rule out a viewing. Many families have nothing to gather around.
              Afterlight gives them a presence: a last look and a dignified farewell they will remember.
            </p>
            <ul className="mt-6 space-y-3 text-slate-300">
              {["Closed-casket and cremation services", "Memorials months after the passing", "Celebrations of life, anniversaries and remembrance nights"].map((t) => (
                <li key={t} className="flex gap-3"><span className="mt-2 size-1.5 rounded-full bg-sky-400 shrink-0" />{t}</li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      {/* Founder toolkit */}
      <section className="mx-auto max-w-7xl px-5 md:px-8 py-24">
        <motion.div {...fade} className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-xl">
            <p className="mono-label mb-4">Founder's toolkit</p>
            <h2 className="text-3xl md:text-4xl text-slate-100 tracking-tight">The software, the budget, the price and who to pitch</h2>
          </div>
          <Link to="/memorials" className={cn(buttonVariants({ variant: "outline" }), "border-slate-700")} data-testid="home-try-creator-button">
            Try the memorial creator <ArrowRight className="size-4" />
          </Link>
        </motion.div>
        <div className="mt-12 grid md:grid-cols-3 gap-4">
          {TOOLS.map((t, i) => (
            <motion.div key={t.to} {...fade} transition={{ duration: 0.6, delay: i * 0.06 }} className={t.span}>
              <Link
                to={t.to}
                className="block h-full rounded-xl border border-slate-800 bg-[#131722] p-7 transition-[border-color,transform,box-shadow] duration-300 hover:border-sky-500/50 hover:-translate-y-0.5 hover:shadow-[0_0_50px_-15px_rgba(56,189,248,0.4)]"
                data-testid={`home-tool-card-${t.to.slice(1)}`}
              >
                <t.icon className="size-5 text-sky-400" />
                <h3 className="mt-5 text-xl text-slate-100">{t.title}</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{t.body}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
