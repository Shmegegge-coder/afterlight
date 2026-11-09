import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Copy, ExternalLink, Loader2, PackageCheck, Plus, Send, ShieldCheck, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiDelete, apiGet, apiPost, errorMessage } from "@/lib/api";
import { ENDINGS, STATUS_META, fmtDate, intakeUrl, reviewUrl, type Order, type OrderCreate, type OrderStatus } from "@/lib/orders";
import { usd } from "@/data/business";
import { cn } from "@/lib/utils";

const EMPTY: OrderCreate = { package_id: "memory-film", deceased_name: "", family_name: "", family_email: "", family_phone: "", funeral_home: "", service_date: "" };
const FILTERS: ("all" | OrderStatus)[] = ["all", "awaiting_intake", "in_production", "in_review", "changes_requested", "approved", "delivered"];

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error("Couldn't copy. Please select the link manually.");
  }
}

function OrderCard({ o }: { o: Order }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["orders"] });
  const act = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown; msg: string }) => apiPost<Order>(path, body),
    onSuccess: (_d, v) => { refresh(); toast.success(v.msg); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: () => apiDelete<{ ok: boolean }>(`/orders/${o.id}`),
    onSuccess: () => { refresh(); toast.success("Order deleted"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const meta = STATUS_META[o.status];
  const canSend = (o.status === "in_production" || o.status === "changes_requested") && !!o.memorial_id;
  const openRequests = o.comments.filter((c) => c.author === "family" && c.round === o.review_round).length;
  const ending = ENDINGS.find((e) => e.id === o.intake?.ending);

  return (
    <article className="rounded-xl border border-slate-800 bg-[#131722]" data-testid={`order-card-${o.id}`}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full p-5 grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] gap-3 md:gap-6 items-center text-left" data-testid={`order-toggle-${o.id}`}>
        <div className="min-w-0">
          <p className="text-lg text-slate-100 truncate">{o.deceased_name}</p>
          <p className="text-xs text-slate-500 truncate">{o.family_name}{o.funeral_home && ` · ${o.funeral_home}`}</p>
        </div>
        <p className="text-sm text-slate-400">{o.service_date ? `Service ${fmtDate(o.service_date)}` : "No service date"}</p>
        <Badge variant="outline" className={cn("font-mono text-[10px] uppercase tracking-widest w-fit", meta.cls)} data-testid={`order-status-${o.id}`}>{meta.label}</Badge>
        <ChevronDown className={cn("size-4 text-slate-500 transition-transform hidden md:block", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-slate-800 p-5 grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-5">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="border-slate-600" onClick={() => copy(intakeUrl(o), "Intake link")} data-testid={`order-copy-intake-${o.id}`}>
                <Copy className="size-3.5" /> Intake link
              </Button>
              {o.memorial_id && (
                <Link to={`/memorials/${o.memorial_id}`} className={cn(buttonVariants({ size: "sm" }), "bg-sky-500 hover:bg-sky-400 text-white")} data-testid={`order-open-studio-${o.id}`}>
                  <Wand2 className="size-3.5" /> Open in studio
                </Link>
              )}
              <Button size="sm" className="bg-violet-500 hover:bg-violet-400 text-white" disabled={!canSend || act.isPending} onClick={() => act.mutate({ path: `/orders/${o.id}/send-for-review`, msg: "Sent to family. Copy the review link and share it." })} data-testid={`order-send-review-${o.id}`}>
                <Send className="size-3.5" /> {o.status === "changes_requested" ? "Send revised film" : "Send for review"}
              </Button>
              {o.review_round > 0 && (
                <Button size="sm" variant="outline" className="border-slate-600" onClick={() => copy(reviewUrl(o), "Review link")} data-testid={`order-copy-review-${o.id}`}>
                  <Copy className="size-3.5" /> Review link
                </Button>
              )}
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-slate-950" disabled={o.status !== "approved" || act.isPending} onClick={() => act.mutate({ path: `/orders/${o.id}/deliver`, msg: "Marked delivered" })} data-testid={`order-deliver-${o.id}`}>
                <PackageCheck className="size-3.5" /> Mark delivered
              </Button>
            </div>

            {o.intake ? (
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm" data-testid={`order-intake-${o.id}`}>
                <div><dt className="text-xs text-slate-500">Tone</dt><dd className="text-slate-200 capitalize">{o.intake.tone}</dd></div>
                <div><dt className="text-xs text-slate-500">Ending</dt><dd className="text-slate-200">{ending?.label ?? o.intake.ending}</dd></div>
                {o.intake.music && <div><dt className="text-xs text-slate-500">Music</dt><dd className="text-slate-200">{o.intake.music}</dd></div>}
                {o.intake.must_include && <div><dt className="text-xs text-slate-500">Must include</dt><dd className="text-slate-200">{o.intake.must_include}</dd></div>}
                {o.intake.avoid && <div><dt className="text-xs text-slate-500">Avoid</dt><dd className="text-amber-200">{o.intake.avoid}</dd></div>}
                {o.intake.notes && <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Notes</dt><dd className="text-slate-200">{o.intake.notes}</dd></div>}
              </dl>
            ) : (
              <p className="text-sm text-slate-500">Waiting for the family to complete intake. Send them the intake link{o.family_email ? ` at ${o.family_email}` : ""}{o.family_phone ? ` or ${o.family_phone}` : ""}.</p>
            )}

            {o.consent && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm" data-testid={`order-consent-${o.id}`}>
                <p className="flex items-center gap-2 text-emerald-300"><ShieldCheck className="size-4" /> Consent signed by {o.consent.signer_name} ({o.consent.relationship}) · {fmtDate(o.consent.signed_at ?? "")}</p>
                <p className="mt-2 text-xs text-slate-400">
                  Animate face: <span className={o.consent.likeness_animation_ok ? "text-emerald-300" : "text-rose-300"}>{o.consent.likeness_animation_ok ? "allowed" : "not allowed"}</span> · Voice recreation: <span className={o.consent.voice_clone_ok ? "text-emerald-300" : "text-rose-300"}>{o.consent.voice_clone_ok ? "allowed" : "not allowed"}</span>
                </p>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{usd(o.price)} · round {o.review_round} · {o.changes_requested_count}/{o.max_revisions} revisions used</span>
              <button type="button" className="inline-flex items-center gap-1 hover:text-red-400" onClick={() => { if (window.confirm(`Delete the order for ${o.deceased_name}? The memorial itself is kept.`)) del.mutate(); }} data-testid={`order-delete-${o.id}`}>
                <Trash2 className="size-3.5" /> Delete order
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-3">
            <p className="mono-label">Family feedback {openRequests > 0 && <span className="text-amber-300">· {openRequests} this round</span>}</p>
            <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {o.comments.length === 0 && <li className="text-sm text-slate-500">No comments yet.</li>}
              {o.comments.map((c) => (
                <li key={c.id} className={cn("rounded-lg px-3 py-2 text-sm", c.author === "studio" ? "bg-sky-500/10" : "bg-slate-800/60")}>
                  <p className="text-xs text-slate-500"><span className="text-slate-300">{c.name}</span> · round {c.round}{c.story_id && " · on a scene"}</p>
                  <p className="mt-1 text-slate-200 whitespace-pre-wrap">{c.text}</p>
                </li>
              ))}
            </ul>
            <form className="flex gap-2 items-end" onSubmit={(e) => { e.preventDefault(); if (!reply.trim()) return; act.mutate({ path: `/orders/${o.id}/comments`, body: { text: reply.trim(), name: "Afterlight" }, msg: "Reply posted" }); setReply(""); }}>
              <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the family" className="flex-1 min-h-0" data-testid={`order-reply-input-${o.id}`} />
              <Button type="submit" size="icon" disabled={!reply.trim() || act.isPending} aria-label="Post reply" data-testid={`order-reply-send-${o.id}`}><Send className="size-4" /></Button>
            </form>
          </div>
        </div>
      )}
    </article>
  );
}

export default function Orders() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<OrderCreate>(EMPTY);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const list = useQuery({ queryKey: ["orders"], queryFn: () => apiGet<Order[]>("/orders"), refetchInterval: 15000 });

  const create = useMutation({
    mutationFn: (body: OrderCreate) => apiPost<Order>("/orders", body),
    onSuccess: (o) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      setOpen(false);
      setForm(EMPTY);
      copy(intakeUrl(o), "Order created. Intake link");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const orders = list.data ?? [];
  const shown = filter === "all" ? orders : orders.filter((o) => o.status === filter);
  const count = (s: OrderStatus) => orders.filter((o) => o.status === s).length;
  const needsYou = count("in_production") + count("changes_requested");

  return (
    <div>
      <PageHeader
        eyebrow="Memory Film · order desk"
        title="Content-only orders"
        intro="Create an order, send the family their intake link, build the film in the studio, then send it for review. Families comment and approve on their own private page."
      >
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="mt-8 bg-sky-500 hover:bg-sky-400 text-white" data-testid="orders-create-button" />}>
            <Plus className="size-4" /> New Memory Film order
          </DialogTrigger>
          <DialogContent className="bg-[#131722] border-slate-700">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">New Memory Film order</DialogTitle>
              <DialogDescription>The intake link is copied to your clipboard when you create the order.</DialogDescription>
            </DialogHeader>
            <form
              id="create-order"
              className="grid grid-cols-2 gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.deceased_name.trim() || !form.family_name.trim()) return toast.error("Please add both names");
                create.mutate(form);
              }}
            >
              <div className="col-span-2 space-y-1.5"><Label htmlFor="o-d">Remembering</Label><Input id="o-d" placeholder="Full name" value={form.deceased_name} onChange={(e) => setForm({ ...form, deceased_name: e.target.value })} data-testid="order-deceased-input" /></div>
              <div className="col-span-2 space-y-1.5"><Label htmlFor="o-f">Family contact</Label><Input id="o-f" placeholder="Full name" value={form.family_name} onChange={(e) => setForm({ ...form, family_name: e.target.value })} data-testid="order-family-input" /></div>
              <div className="space-y-1.5"><Label htmlFor="o-e">Email</Label><Input id="o-e" type="email" value={form.family_email} onChange={(e) => setForm({ ...form, family_email: e.target.value })} data-testid="order-email-input" /></div>
              <div className="space-y-1.5"><Label htmlFor="o-p">Phone</Label><Input id="o-p" type="tel" value={form.family_phone} onChange={(e) => setForm({ ...form, family_phone: e.target.value })} data-testid="order-phone-input" /></div>
              <div className="space-y-1.5"><Label htmlFor="o-h">Funeral home <span className="text-slate-500">(optional)</span></Label><Input id="o-h" value={form.funeral_home} onChange={(e) => setForm({ ...form, funeral_home: e.target.value })} data-testid="order-home-input" /></div>
              <div className="space-y-1.5"><Label htmlFor="o-s">Service date</Label><Input id="o-s" type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} data-testid="order-date-input" /></div>
            </form>
            <DialogFooter>
              <Button type="submit" form="create-order" disabled={create.isPending} className="bg-sky-500 hover:bg-sky-400 text-white" data-testid="order-create-submit">
                {create.isPending && <Loader2 className="size-4 animate-spin" />} Create order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <section className="mx-auto max-w-7xl px-5 md:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { k: "Open orders", v: orders.filter((o) => o.status !== "delivered").length },
            { k: "Needs you", v: needsYou, hl: needsYou > 0 },
            { k: "With families", v: count("in_review") },
            { k: "Delivered revenue", v: usd(orders.filter((o) => o.status === "delivered").reduce((a, o) => a + o.price, 0)) },
          ].map((s) => (
            <div key={s.k} className={cn("rounded-xl border bg-[#131722] p-5", s.hl ? "border-amber-500/40" : "border-slate-800")}>
              <p className="text-xs text-slate-500">{s.k}</p>
              <p className="mt-2 font-mono text-2xl text-slate-100">{s.v}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={cn("rounded-full border px-3 py-1 text-xs font-mono transition-colors", filter === f ? "bg-sky-500/15 border-sky-500/60 text-sky-200" : "border-slate-700 text-slate-400 hover:text-slate-100")} data-testid={`orders-filter-${f}`}>
              {f === "all" ? `All · ${orders.length}` : `${STATUS_META[f].label} · ${count(f)}`}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-3" data-testid="orders-list">
          {list.isPending && [0, 1].map((i) => <div key={i} className="h-20 rounded-xl bg-slate-800/40 animate-pulse" />)}
          {list.isError && <p className="text-slate-500">Orders are unavailable right now.</p>}
          {!list.isPending && shown.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-slate-500">
              No orders here yet. <a href="#" onClick={(e) => { e.preventDefault(); setOpen(true); }} className="text-sky-300 hover:underline">Create the first one <ExternalLink className="inline size-3" /></a>
            </div>
          )}
          {shown.map((o) => <OrderCard key={o.id} o={o} />)}
        </div>
      </section>
    </div>
  );
}
