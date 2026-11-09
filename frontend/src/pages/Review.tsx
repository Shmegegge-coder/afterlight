import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MessageSquare, PenLine, Play, Send } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost, errorMessage, setFamilyToken } from "@/lib/api";
import type { Memorial, Story } from "@/lib/types";
import { fmtDate, type OrderComment, type ReviewView } from "@/lib/orders";
import { cn } from "@/lib/utils";

const NAME_KEY = "afterlight-reviewer-name";

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-5xl px-5 md:px-8 py-10">{children}</div>;
}

function CommentList({ items }: { items: OrderComment[] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-2">
      {items.map((c) => (
        <li key={c.id} className={cn("rounded-lg px-3 py-2 text-sm", c.author === "studio" ? "bg-sky-500/10 border border-sky-500/20" : "bg-slate-800/50")} data-testid={`review-comment-${c.id}`}>
          <p className="text-xs text-slate-500">
            <span className={c.author === "studio" ? "text-sky-300" : "text-slate-300"}>{c.name}</span> · round {c.round} · {fmtDate(c.created_at)}
          </p>
          <p className="mt-1 text-slate-200 whitespace-pre-wrap">{c.text}</p>
        </li>
      ))}
    </ul>
  );
}

function CommentBox({ onSend, pending, placeholder, testid }: { onSend: (text: string) => void; pending: boolean; placeholder: string; testid: string }) {
  const [text, setText] = useState("");
  return (
    <form
      className="flex gap-2 items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        onSend(text.trim());
        setText("");
      }}
    >
      <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="flex-1 min-h-0" data-testid={`${testid}-input`} />
      <Button type="submit" size="icon" disabled={pending || !text.trim()} aria-label="Send comment" data-testid={`${testid}-send`}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
      </Button>
    </form>
  );
}

function SceneCard({ s, i, comments, open, onSend, pending }: { s: Story; i: number; comments: OrderComment[]; open: boolean; onSend: (text: string, storyId: string) => void; pending: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <article className="rounded-xl border border-slate-800 bg-[#131722] overflow-hidden" data-testid={`review-scene-${s.id}`}>
      <div className="relative aspect-video bg-[#030712]">
        {s.video_url ? (
          <video src={s.video_url} poster={s.image_url ?? undefined} className="size-full object-cover" controls loop muted playsInline />
        ) : s.image_url ? (
          <img src={s.image_url} alt={s.title} className="size-full object-cover" />
        ) : (
          <div className="size-full grid place-items-center text-sm text-slate-500">Scene in progress</div>
        )}
        <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[10px] text-sky-200">Scene {i + 1}</span>
      </div>
      <div className="p-4 space-y-3">
        <h3 className="text-lg text-slate-100">{s.title}</h3>
        {s.caption && <p className="text-sm text-sky-100/90 border-l-2 border-sky-500/50 pl-3 leading-relaxed">“{s.caption}”</p>}
        <CommentList items={comments} />
        {open && (
          show ? (
            <CommentBox onSend={(t) => onSend(t, s.id)} pending={pending} placeholder="What would you like changed in this scene?" testid={`review-scene-comment-${s.id}`} />
          ) : (
            <button type="button" onClick={() => setShow(true)} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-sky-200" data-testid={`review-scene-comment-open-${s.id}`}>
              <MessageSquare className="size-3.5" /> Comment on this scene
            </button>
          )
        )}
      </div>
    </article>
  );
}

export default function Review() {
  const { token = "" } = useParams();
  setFamilyToken(token); // family pages authenticate with their link token, not a login
  const qc = useQueryClient();
  const [name, setNameState] = useState(() => localStorage.getItem(NAME_KEY) ?? "");
  const setName = (v: string) => { setNameState(v); localStorage.setItem(NAME_KEY, v); };
  const [dialog, setDialog] = useState<null | "approve" | "changes">(null);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);

  const rq = useQuery({ queryKey: ["review", token], queryFn: () => apiGet<ReviewView>(`/review/${token}`), retry: false });
  const r = rq.data;
  const mq = useQuery({ queryKey: ["memorial", r?.memorial_id], queryFn: () => apiGet<Memorial>(`/memorials/${r?.memorial_id}`), enabled: !!r?.memorial_id });
  const m = mq.data;
  const setR = (v: ReviewView) => qc.setQueryData(["review", token], v);

  const comment = useMutation({
    mutationFn: (body: { text: string; story_id: string | null }) => apiPost<ReviewView>(`/review/${token}/comments`, { ...body, name }),
    onSuccess: (v) => { setR(v); toast.success("Comment sent"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const changes = useMutation({
    mutationFn: () => apiPost<ReviewView>(`/review/${token}/request-changes`, { name, note }),
    onSuccess: (v) => { setR(v); setDialog(null); setNote(""); toast.success("Change request sent"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const approve = useMutation({
    mutationFn: () => apiPost<ReviewView>(`/review/${token}/approve`, { name, confirm }),
    onSuccess: (v) => { setR(v); setDialog(null); toast.success("Approved. Thank you."); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (rq.isPending) return <Shell><div className="h-40 rounded-xl bg-slate-800/40 animate-pulse" /></Shell>;
  if (rq.isError || !r) {
    return (
      <Shell>
        <h1 className="text-3xl text-slate-100">Not ready yet</h1>
        <p className="mt-3 text-slate-400" data-testid="review-error">{errorMessage(rq.error, "This link isn't working. Please ask us for a new one.")}</p>
      </Shell>
    );
  }

  const open = r.status === "in_review";
  const byStory = (id: string | null) => r.comments.filter((c) => c.story_id === id);
  const sendScene = (text: string, storyId: string) => {
    if (!name.trim()) return toast.error("Please add your name at the top first");
    comment.mutate({ text, story_id: storyId });
  };

  const banner = {
    in_review: { cls: "border-violet-500/40", title: "Ready for your review", body: `Watch the film, comment on any scene, then approve it or request changes. ${r.revisions_left} revision round${r.revisions_left === 1 ? "" : "s"} left.` },
    changes_requested: { cls: "border-amber-500/40", title: "We're making your changes", body: "We'll update the film and send it back to this same link, usually within 48 hours." },
    approved: { cls: "border-emerald-500/40", title: "Approved", body: r.approval ? `Approved by ${r.approval.name} on ${fmtDate(r.approval.approved_at)}. We're preparing your final files.` : "" },
    delivered: { cls: "border-emerald-500/40", title: "Delivered", body: "Your Memory Film has been delivered. Thank you for trusting us." },
    awaiting_intake: { cls: "border-slate-700", title: "Waiting on details", body: "" },
    in_production: { cls: "border-slate-700", title: "In production", body: "" },
  }[r.status];

  return (
    <Shell>
      <p className="mono-label mb-3">{r.package_name} · review round {r.review_round}</p>
      <h1 className="text-3xl md:text-5xl text-slate-100 tracking-tight" data-testid="review-title">{m?.name ?? r.deceased_name}</h1>
      {r.service_date && <p className="mt-2 text-sm text-slate-400">Service on {fmtDate(r.service_date)}</p>}

      <div className={cn("mt-6 rounded-xl border bg-[#131722] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4", banner.cls)} data-testid="review-status-banner">
        <div>
          <p className="text-slate-100 flex items-center gap-2">{(r.status === "approved" || r.status === "delivered") && <CheckCircle2 className="size-4 text-emerald-400" />}{banner.title}</p>
          <p className="mt-1 text-sm text-slate-400">{banner.body}</p>
        </div>
        {m && (
          <Link to={`/memorials/${m.id}/show?return=${encodeURIComponent(`/review/${token}`)}`} className={cn(buttonVariants({ size: "lg" }), "bg-sky-500 hover:bg-sky-400 text-white holo-glow shrink-0")} data-testid="review-play-button">
            <Play className="size-4" /> Watch full film
          </Link>
        )}
      </div>

      {open && (
        <div className="mt-6 max-w-sm space-y-1.5">
          <Label htmlFor="r-name">Your name (shown with your comments)</Label>
          <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="review-name-input" />
        </div>
      )}

      {mq.isPending && <div className="mt-8 h-60 rounded-xl bg-slate-800/40 animate-pulse" />}
      {m && (
        <>
          {m.narration.intro && (
            <section className="mt-10 rounded-xl border border-slate-800 bg-[#131722] p-5" data-testid="review-narration-intro">
              <p className="mono-label">Opening narration</p>
              <p className="mt-3 text-slate-300 leading-relaxed">{m.narration.intro}</p>
            </section>
          )}
          <section className="mt-8">
            <p className="mono-label">Scenes</p>
            <div className="mt-4 grid md:grid-cols-2 gap-5" data-testid="review-scenes">
              {m.stories.map((s, i) => <SceneCard key={s.id} s={s} i={i} comments={byStory(s.id)} open={open} onSend={sendScene} pending={comment.isPending} />)}
            </div>
          </section>
          {r.ending !== "none" && (m.finale.image_url || m.narration.finale) && (
            <section className="mt-8 rounded-xl border border-amber-500/30 bg-[#131722] overflow-hidden grid md:grid-cols-2" data-testid="review-finale">
              {m.finale.image_url && <img src={m.finale.image_url} alt="Closing scene" className="size-full object-cover aspect-video" />}
              <div className="p-5">
                <p className="mono-label !text-amber-400">Closing</p>
                {m.narration.finale && <p className="mt-3 text-amber-100/90 leading-relaxed">{m.narration.finale}</p>}
              </div>
            </section>
          )}
        </>
      )}

      <section className="mt-10 rounded-xl border border-slate-800 bg-[#131722] p-5 space-y-4" data-testid="review-general-comments">
        <p className="mono-label">General comments</p>
        <CommentList items={byStory(null)} />
        {open && (
          <CommentBox
            onSend={(t) => { if (!name.trim()) return toast.error("Please add your name first"); comment.mutate({ text: t, story_id: null }); }}
            pending={comment.isPending}
            placeholder="Music, pacing, anything about the film as a whole"
            testid="review-general-comment"
          />
        )}
      </section>

      {open && (
        <div className="sticky bottom-4 mt-8 rounded-xl border border-slate-700 bg-[#0B0D12]/95 backdrop-blur p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between" data-testid="review-action-bar">
          <p className="text-sm text-slate-400">Happy with it? Approve to receive the final files.</p>
          <div className="flex gap-2">
            <Button variant="outline" className="border-slate-600" disabled={r.revisions_left === 0} onClick={() => setDialog("changes")} data-testid="review-request-changes-button">
              <PenLine className="size-4" /> Request changes
            </Button>
            <Button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950" onClick={() => setDialog("approve")} data-testid="review-approve-button">
              <CheckCircle2 className="size-4" /> Approve film
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialog === "changes"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="bg-[#131722] border-slate-700">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Request changes</DialogTitle>
            <DialogDescription>Your scene comments are included automatically. Add a summary of what you'd like changed. This uses 1 of your {r.revisions_left} remaining rounds.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="ch-name">Your name</Label><Input id="ch-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="changes-name-input" /></div>
            <div className="space-y-1.5"><Label htmlFor="ch-note">What should change?</Label><Textarea id="ch-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} data-testid="changes-note-input" /></div>
          </div>
          <DialogFooter>
            <Button disabled={changes.isPending || name.trim().length < 2 || note.trim().length < 3} onClick={() => changes.mutate()} className="bg-amber-500 hover:bg-amber-400 text-slate-950" data-testid="changes-submit-button">
              {changes.isPending && <Loader2 className="size-4 animate-spin" />} Send change request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "approve"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="bg-[#131722] border-slate-700">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Approve the Memory Film</DialogTitle>
            <DialogDescription>Once approved, we'll prepare the final video file and online memorial page.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="ap-name">Type your full name</Label><Input id="ap-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="approve-name-input" /></div>
            <label htmlFor="ap-ok" className="flex gap-3 items-start text-sm text-slate-300">
              <input id="ap-ok" type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 size-4 accent-emerald-500" data-testid="approve-confirm-checkbox" />
              I've watched the film and approve it on behalf of the family.
            </label>
          </div>
          <DialogFooter>
            <Button disabled={approve.isPending || name.trim().length < 2 || !confirm} onClick={() => approve.mutate()} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950" data-testid="approve-submit-button">
              {approve.isPending && <Loader2 className="size-4 animate-spin" />} Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
