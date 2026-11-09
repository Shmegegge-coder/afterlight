import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, HeartHandshake, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiDelete, apiGet, apiPatch, apiPost, apiUpload, errorMessage, setFamilyToken } from "@/lib/api";
import type { Memorial, MemorialCreate, StoryCreate } from "@/lib/types";
import { ENDINGS, TONES, fmtDate, type Ending, type IntakeSubmit, type IntakeView, type Tone } from "@/lib/orders";
import { cn } from "@/lib/utils";

const STEPS = ["About them", "Photos", "Memories", "Style", "Consent"] as const;
const MIN_PHOTOS = 3;
const MIN_STORIES = 3;
const MAX_STORIES = 12;

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-4xl px-5 md:px-8 py-10">{children}</div>;
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex flex-wrap gap-2 md:gap-3" data-testid="intake-stepper">
      {STEPS.map((s, i) => (
        <li
          key={s}
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-mono",
            i < step && "border-emerald-500/40 text-emerald-300",
            i === step && "border-sky-500/60 bg-sky-500/10 text-sky-200",
            i > step && "border-slate-800 text-slate-500",
          )}
        >
          {i < step ? <Check className="size-3" /> : <span>{i + 1}</span>}
          {s}
        </li>
      ))}
    </ol>
  );
}

function Choice({ active, onClick, title, desc, testid }: { active: boolean; onClick: () => void; title: string; desc?: string; testid: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl border p-4 text-left transition-colors duration-200",
        active ? "border-sky-500/70 bg-sky-500/10" : "border-slate-800 bg-[#131722] hover:border-slate-600",
      )}
      data-testid={testid}
    >
      <p className="text-sm text-slate-100">{title}</p>
      {desc && <p className="mt-1 text-xs text-slate-400">{desc}</p>}
    </button>
  );
}

function Check2({ id, checked, onChange, children, testid }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; testid: string }) {
  return (
    <label htmlFor={id} className="flex gap-3 items-start rounded-lg border border-slate-800 bg-[#131722] p-4 cursor-pointer hover:border-slate-600">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-sky-500 shrink-0" data-testid={testid} />
      <span className="text-sm text-slate-300 leading-relaxed">{children}</span>
    </label>
  );
}

export default function Intake() {
  const { token = "" } = useParams();
  setFamilyToken(token); // family pages authenticate with their link token, not a login
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [about, setAbout] = useState<MemorialCreate | null>(null);
  const [story, setStory] = useState<StoryCreate>({ title: "", text: "", photo_id: null });
  const [style, setStyle] = useState<{ tone: Tone; ending: Ending; music: string; must_include: string; avoid: string; notes: string }>({
    tone: "gentle",
    ending: "sunset",
    music: "",
    must_include: "",
    avoid: "",
    notes: "",
  });
  const [consent, setConsent] = useState({ signer_name: "", relationship: "", is_next_of_kin: false, ai_scenes_ok: false, likeness_animation_ok: false, voice_clone_ok: false });

  const iq = useQuery({ queryKey: ["intake", token], queryFn: () => apiGet<IntakeView>(`/intake/${token}`), retry: false });
  const memorialId = iq.data?.memorial_id ?? null;
  const mq = useQuery({
    queryKey: ["memorial", memorialId],
    queryFn: () => apiGet<Memorial>(`/memorials/${memorialId}`),
    enabled: !!memorialId,
  });
  const m = mq.data;
  const setM = (d: Memorial) => qc.setQueryData(["memorial", d.id], d);

  const form: MemorialCreate = about ?? {
    name: m?.name ?? iq.data?.deceased_name ?? "",
    birth_date: m?.birth_date ?? "",
    death_date: m?.death_date ?? "",
    epitaph: m?.epitaph ?? "",
  };

  const saveAbout = useMutation({
    mutationFn: async (body: MemorialCreate) => {
      if (memorialId) return apiPatch<Memorial>(`/memorials/${memorialId}`, body);
      const created = await apiPost<Memorial>("/memorials", body);
      const view = await apiPost<IntakeView>(`/intake/${token}/memorial`, { memorial_id: created.id });
      qc.setQueryData(["intake", token], view);
      return created;
    },
    onSuccess: (d) => { setM(d); setAbout(null); setStep(1); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const upload = useMutation({
    mutationFn: (files: File[]) => {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      return apiUpload<Memorial>(`/memorials/${memorialId}/photos`, fd);
    },
    onSuccess: (d) => { setM(d); toast.success("Photos added"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const delPhoto = useMutation({
    mutationFn: (pid: string) => apiDelete<Memorial>(`/memorials/${memorialId}/photos/${pid}`),
    onSuccess: setM,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const addStory = useMutation({
    mutationFn: (body: StoryCreate) => apiPost<Memorial>(`/memorials/${memorialId}/stories`, body),
    onSuccess: (d) => { setM(d); setStory({ title: "", text: "", photo_id: null }); toast.success("Memory added"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const delStory = useMutation({
    mutationFn: (sid: string) => apiDelete<Memorial>(`/memorials/${memorialId}/stories/${sid}`),
    onSuccess: setM,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const submit = useMutation({
    mutationFn: (body: IntakeSubmit) => apiPost<IntakeView>(`/intake/${token}/submit`, body),
    onSuccess: (v) => { qc.setQueryData(["intake", token], v); window.scrollTo({ top: 0 }); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (iq.isPending) return <Shell><div className="h-40 rounded-xl bg-slate-800/40 animate-pulse" /></Shell>;
  if (iq.isError || !iq.data) {
    return (
      <Shell>
        <h1 className="text-3xl text-slate-100">This link isn't working</h1>
        <p className="mt-3 text-slate-400" data-testid="intake-error">{errorMessage(iq.error, "Please check the link or ask us for a new one.")}</p>
      </Shell>
    );
  }
  const v = iq.data;

  if (v.submitted) {
    return (
      <Shell>
        <div className="rounded-2xl border border-emerald-500/30 bg-[#131722] p-8 md:p-10 text-center" data-testid="intake-done">
          <HeartHandshake className="size-10 text-emerald-300 mx-auto" />
          <h1 className="mt-5 text-3xl md:text-4xl text-slate-100">Thank you, {v.family_name.split(" ")[0]}</h1>
          <p className="mt-3 text-slate-400 max-w-xl mx-auto leading-relaxed">
            We have everything we need to begin {v.deceased_name}'s Memory Film. We'll send you a private review link within 72 hours so you can watch it, leave comments and approve it.
          </p>
        </div>
      </Shell>
    );
  }

  const photos = m?.photos ?? [];
  const stories = m?.stories ?? [];
  const canNext = [
    !!form.name.trim(),
    photos.length >= MIN_PHOTOS,
    stories.length >= MIN_STORIES,
    true,
    consent.signer_name.trim().length >= 2 && !!consent.relationship.trim() && consent.is_next_of_kin && consent.ai_scenes_ok,
  ][step];
  const hint = [
    "Please enter their name.",
    `Please add at least ${MIN_PHOTOS} photos.`,
    `Please add at least ${MIN_STORIES} memories.`,
    "",
    "Please enter your name and relationship and tick the two required boxes.",
  ][step];

  const next = () => {
    if (!canNext) return toast.error(hint);
    if (step === 0) return saveAbout.mutate(form);
    if (step === STEPS.length - 1) return submit.mutate({ ...style, consent });
    setStep(step + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const busy = saveAbout.isPending || submit.isPending;

  return (
    <Shell>
      <p className="mono-label mb-3">{v.package_name} · family intake</p>
      <h1 className="text-3xl md:text-4xl text-slate-100 tracking-tight" data-testid="intake-title">Help us remember {v.deceased_name}</h1>
      <p className="mt-3 text-slate-400 leading-relaxed max-w-2xl">
        This takes about 15 minutes. Your progress saves as you go, so you can close this page and come back to the same link.
        {v.service_date && <> The service is on <span className="text-slate-200">{fmtDate(v.service_date)}</span>.</>}
      </p>
      <div className="mt-8"><Stepper step={step} /></div>

      <section className="mt-8 rounded-2xl border border-slate-800 bg-[#0F131C] p-5 md:p-8" data-testid={`intake-step-${step}`}>
        {step === 0 && (
          <div className="grid md:grid-cols-2 gap-5">
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="i-name">Their full name</Label>
              <Input id="i-name" value={form.name} onChange={(e) => setAbout({ ...form, name: e.target.value })} data-testid="intake-name-input" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="i-born">Born</Label>
              <Input id="i-born" type="date" value={form.birth_date} onChange={(e) => setAbout({ ...form, birth_date: e.target.value })} data-testid="intake-birth-input" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="i-died">Passed</Label>
              <Input id="i-died" type="date" value={form.death_date} onChange={(e) => setAbout({ ...form, death_date: e.target.value })} data-testid="intake-death-input" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="i-ep">A few words that describe them <span className="text-slate-500">(optional)</span></Label>
              <Input id="i-ep" placeholder="Mother, gardener, the funniest person in any room" value={form.epitaph} onChange={(e) => setAbout({ ...form, epitaph: e.target.value })} data-testid="intake-epitaph-input" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-2xl text-slate-100">Share their photos</h2>
            <p className="mt-2 text-sm text-slate-400">10–30 photos work best. Include a few clear photos of their face, plus places, people and things they loved. JPG, PNG or WebP.</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) upload.mutate(Array.from(e.target.files)); e.target.value = ""; /* copy before clearing: the FileList is live */ }} data-testid="intake-photo-file-input" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={upload.isPending}
              className="mt-5 w-full rounded-xl border border-dashed border-slate-700 hover:border-sky-500/60 bg-[#131722] py-10 flex flex-col items-center gap-2 text-slate-400 hover:text-sky-200 transition-colors duration-200"
              data-testid="intake-photo-upload-button"
            >
              {upload.isPending ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
              <span className="text-sm">{upload.isPending ? "Uploading…" : "Choose photos"}</span>
            </button>
            <p className="mt-3 text-xs font-mono text-slate-500" data-testid="intake-photo-count">{photos.length} added · minimum {MIN_PHOTOS}</p>
            {photos.length > 0 && (
              <div className="mt-4 grid grid-cols-3 sm:grid-cols-5 gap-2">
                {photos.map((p, i) => (
                  <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-800">
                    <img src={p.url} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                    <button type="button" onClick={() => delPhoto.mutate(p.id)} className="absolute top-1 right-1 p-1 rounded bg-black/60 text-slate-200 hover:text-red-400" aria-label="Remove photo" data-testid={`intake-photo-delete-${p.id}`}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="grid lg:grid-cols-2 gap-6">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!story.title.trim() || !story.text.trim()) return toast.error("Please add a title and the memory");
                if (stories.length >= MAX_STORIES) return toast.error(`Up to ${MAX_STORIES} memories fit in a Memory Film`);
                addStory.mutate(story);
              }}
              data-testid="intake-story-form"
            >
              <h2 className="text-2xl text-slate-100">Tell us their stories</h2>
              <p className="text-sm text-slate-400">Each memory becomes one scene. Where were you, what were they doing, what did it look and feel like?</p>
              <div className="space-y-1.5">
                <Label htmlFor="i-st">Title</Label>
                <Input id="i-st" placeholder="Sunday pancakes" value={story.title} onChange={(e) => setStory({ ...story, title: e.target.value })} data-testid="intake-story-title-input" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-sx">The memory</Label>
                <Textarea id="i-sx" rows={5} placeholder="Every Sunday he made pancakes shaped like our initials, flour everywhere, radio on…" value={story.text} onChange={(e) => setStory({ ...story, text: e.target.value })} data-testid="intake-story-text-input" />
              </div>
              {photos.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Matching photo <span className="text-slate-500 font-normal">(optional)</span></p>
                  <div className="flex flex-wrap gap-2">
                    {photos.map((p, i) => (
                      <button key={p.id} type="button" onClick={() => setStory({ ...story, photo_id: story.photo_id === p.id ? null : p.id })} className={cn("size-12 rounded-md overflow-hidden border-2", story.photo_id === p.id ? "border-sky-400" : "border-transparent opacity-70 hover:opacity-100")} aria-label={`Use photo ${i + 1}`} data-testid={`intake-story-photo-${p.id}`}>
                        <img src={p.url} alt="" className="size-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Button type="submit" disabled={addStory.isPending} className="w-full" data-testid="intake-add-story-button">
                {addStory.isPending ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Add memory
              </Button>
            </form>
            <div>
              <p className="text-xs font-mono text-slate-500" data-testid="intake-story-count">{stories.length} added · minimum {MIN_STORIES} · maximum {MAX_STORIES}</p>
              <ul className="mt-3 space-y-3">
                {stories.length === 0 && <li className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">Your memories will appear here.</li>}
                {stories.map((s, i) => (
                  <li key={s.id} className="rounded-xl border border-slate-800 bg-[#131722] p-4 flex gap-3" data-testid={`intake-story-${s.id}`}>
                    <span className="font-mono text-xs text-sky-300 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-100 text-sm">{s.title}</p>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">{s.text}</p>
                    </div>
                    <button type="button" onClick={() => delStory.mutate(s.id)} className="p-1 text-slate-500 hover:text-red-400" aria-label="Remove memory" data-testid={`intake-story-delete-${s.id}`}>
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl text-slate-100">Tone of the narration</h2>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {TONES.map((t) => <Choice key={t.id} active={style.tone === t.id} onClick={() => setStyle({ ...style, tone: t.id })} title={t.label} testid={`intake-tone-${t.id}`} />)}
              </div>
            </div>
            <div>
              <h2 className="text-2xl text-slate-100">How should the film end?</h2>
              <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ENDINGS.map((e) => <Choice key={e.id} active={style.ending === e.id} onClick={() => setStyle({ ...style, ending: e.id })} title={e.label} desc={e.desc} testid={`intake-ending-${e.id}`} />)}
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label htmlFor="i-mu">Songs or music they loved <span className="text-slate-500">(optional)</span></Label>
                <Input id="i-mu" placeholder="Artist, song, or style" value={style.music} onChange={(e) => setStyle({ ...style, music: e.target.value })} data-testid="intake-music-input" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-mi">Must include <span className="text-slate-500">(optional)</span></Label>
                <Input id="i-mi" placeholder="Names, places, sayings" value={style.must_include} onChange={(e) => setStyle({ ...style, must_include: e.target.value })} data-testid="intake-must-include-input" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-av">Please avoid <span className="text-slate-500">(optional)</span></Label>
                <Input id="i-av" placeholder="Topics, people or imagery to leave out" value={style.avoid} onChange={(e) => setStyle({ ...style, avoid: e.target.value })} data-testid="intake-avoid-input" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-no">Anything else <span className="text-slate-500">(optional)</span></Label>
                <Input id="i-no" value={style.notes} onChange={(e) => setStyle({ ...style, notes: e.target.value })} data-testid="intake-notes-input" />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-2xl text-slate-100">Consent</h2>
            <p className="text-sm text-slate-400 leading-relaxed">We only create a Memory Film with permission from the family. You can withdraw consent at any time before delivery.</p>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label htmlFor="c-name">Your full name</Label>
                <Input id="c-name" value={consent.signer_name} onChange={(e) => setConsent({ ...consent, signer_name: e.target.value })} data-testid="consent-name-input" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-rel">Your relationship to {v.deceased_name.split(" ")[0]}</Label>
                <Input id="c-rel" placeholder="Daughter, husband, brother…" value={consent.relationship} onChange={(e) => setConsent({ ...consent, relationship: e.target.value })} data-testid="consent-relationship-input" />
              </div>
            </div>
            <div className="space-y-3">
              <Check2 id="c-nok" checked={consent.is_next_of_kin} onChange={(x) => setConsent({ ...consent, is_next_of_kin: x })} testid="consent-nok-checkbox">
                <span className="text-slate-100">Required.</span> I am the next of kin, or I have their permission to arrange this memorial.
              </Check2>
              <Check2 id="c-ai" checked={consent.ai_scenes_ok} onChange={(x) => setConsent({ ...consent, ai_scenes_ok: x })} testid="consent-ai-checkbox">
                <span className="text-slate-100">Required.</span> I allow Afterlight to use these photos and stories with AI tools to create memory scenes and narration for this memorial only.
              </Check2>
              <Check2 id="c-anim" checked={consent.likeness_animation_ok} onChange={(x) => setConsent({ ...consent, likeness_animation_ok: x })} testid="consent-animation-checkbox">
                <span className="text-slate-100">Optional.</span> You may animate scenes that show their face (short moving clips).
              </Check2>
              <Check2 id="c-voice" checked={consent.voice_clone_ok} onChange={(x) => setConsent({ ...consent, voice_clone_ok: x })} testid="consent-voice-checkbox">
                <span className="text-slate-100">Optional.</span> You may recreate their voice from recordings we provide. If unticked, a narrator's voice is used.
              </Check2>
            </div>
          </div>
        )}
      </section>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" disabled={step === 0 || busy} onClick={() => setStep(step - 1)} data-testid="intake-back-button">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button onClick={next} disabled={busy} className={cn("text-white", canNext ? "bg-sky-500 hover:bg-sky-400" : "bg-slate-700 hover:bg-slate-600")} data-testid="intake-next-button">
          {busy && <Loader2 className="size-4 animate-spin" />}
          {step === STEPS.length - 1 ? "Sign and submit" : "Continue"} {step < STEPS.length - 1 && <ArrowRight className="size-4" />}
        </Button>
      </div>
    </Shell>
  );
}
