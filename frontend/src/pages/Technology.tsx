import { motion } from "motion/react";
import { PageHeader } from "@/components/SiteLayout";
import { AI_TOOLS, HARDWARE, IMG, SOFTWARE, WORKFLOW } from "@/data/business";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const fade = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.6 } };

function ToolTable({ rows, testid }: { rows: typeof SOFTWARE; testid: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#131722]" data-testid={testid}>
      <Table>
        <TableHeader>
          <TableRow className="border-slate-800 hover:bg-transparent">
            <TableHead className="mono-label !text-slate-500">Tool</TableHead>
            <TableHead className="mono-label !text-slate-500">What it does</TableHead>
            <TableHead className="mono-label !text-slate-500 text-right">Approx. cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.name} className="border-slate-800">
              <TableCell className="font-medium text-slate-100 whitespace-nowrap">{r.name}</TableCell>
              <TableCell className="text-slate-400 whitespace-normal">{r.role}</TableCell>
              <TableCell className="font-mono text-sm text-sky-300 text-right whitespace-nowrap">{r.cost}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function Technology() {
  return (
    <div>
      <PageHeader
        eyebrow="How it works · Technology stack"
        title="The hardware, software and AI behind a holographic memorial"
        intro="Afterlight combines three layers: projection hardware puts light in the room, show-control software runs the experience live, and AI tools turn family photos and stories into memory scenes."
      />

      <section className="mx-auto max-w-7xl px-5 md:px-8 py-16">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <p className="mono-label mb-3">01 · Projection hardware</p>
            <h2 className="text-3xl text-slate-100">Putting a person in the room</h2>
            <p className="mt-4 text-slate-400 leading-relaxed">Start by renting, then buy what you use most. Most premium services combine a hologauze or Pepper's Ghost stage for the finale with room-wrap projectors for the memories.</p>
            <img src={IMG.room} alt="Immersive light installation" className="mt-8 rounded-xl aspect-[4/5] object-cover w-full holo-glow hidden lg:block" />
          </div>
          <div className="lg:col-span-8 grid sm:grid-cols-2 gap-4">
            {HARDWARE.map((h, i) => (
              <motion.div
                key={h.id}
                {...fade}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className={`rounded-xl border border-slate-800 bg-[#131722] p-6 transition-colors duration-300 hover:border-sky-500/40 ${i === 0 ? "sm:col-span-2" : ""}`}
                data-testid={`hardware-card-${h.id}`}
              >
                <h3 className="text-xl text-slate-100">{h.name}</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{h.what}</p>
                <p className="mt-4 font-mono text-sm text-sky-300">{h.cost}</p>
                <div className="mt-4 grid gap-2 text-sm">
                  <p><span className="text-emerald-400">Best for: </span><span className="text-slate-300">{h.bestFor}</span></p>
                  <p><span className="text-amber-400">Trade-off: </span><span className="text-slate-300">{h.tradeoff}</span></p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 md:px-8 py-16 grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4">
          <p className="mono-label mb-3">02 · Show-control & mapping software</p>
          <h2 className="text-3xl text-slate-100">Running the show live</h2>
          <p className="mt-4 text-slate-400 leading-relaxed">A media-server PC runs the playback. Resolume plus TouchDesigner covers about 90% of services. Use disguise only for arena-scale events.</p>
        </div>
        <div className="lg:col-span-8"><ToolTable rows={SOFTWARE} testid="software-table" /></div>
      </section>

      <section className="mx-auto max-w-7xl px-5 md:px-8 py-16 grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4">
          <p className="mono-label mb-3">03 · AI content tools</p>
          <h2 className="text-3xl text-slate-100">Making memories visible</h2>
          <p className="mt-4 text-slate-400 leading-relaxed">AI turns old photos and a family's stories into dreamlike scenes and short animated clips, then writes the narration. The <a href="/memorials" className="text-sky-400 hover:underline">memorial creator</a> demo uses these tools live.</p>
        </div>
        <div className="lg:col-span-8"><ToolTable rows={AI_TOOLS} testid="ai-tools-table" /></div>
      </section>

      <section className="mx-auto max-w-7xl px-5 md:px-8 py-16">
        <p className="mono-label mb-3">04 · Workflow</p>
        <h2 className="text-3xl text-slate-100 max-w-xl">From the first family call to the final farewell</h2>
        <ol className="mt-12 relative border-l border-sky-500/30 ml-3 space-y-10">
          {WORKFLOW.map((w, i) => (
            <motion.li key={w.step} {...fade} transition={{ duration: 0.5, delay: i * 0.08 }} className="pl-8 relative" data-testid={`workflow-step-${i + 1}`}>
              <span className="absolute -left-[9px] top-1.5 size-4 rounded-full bg-[#0B0D12] border-2 border-sky-400 holo-glow" />
              <div className="flex flex-wrap items-baseline gap-3">
                <h3 className="text-xl text-slate-100">{w.step}</h3>
                <span className="font-mono text-xs text-sky-400">{w.time}</span>
              </div>
              <p className="mt-2 text-slate-400 max-w-2xl leading-relaxed">{w.detail}</p>
            </motion.li>
          ))}
        </ol>
      </section>
    </div>
  );
}
