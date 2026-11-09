import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clapperboard, Feather, ImagePlus, Loader2, Play, RefreshCw, Sparkles, Trash2, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiDelete, apiGet, apiPatch, apiPost, apiUpload, errorMessage } from "@/lib/api";
import { isGenerating, lifespan, type Memorial, type MemorialUpdate, type Story, type StoryCreate } from "@/lib/types";
import { cn } from "@/lib/utils";

function Status({ busy, label }: { busy: boolean; label: string }) {
  if (!busy) return null;
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#030712]/80 backdrop-blur-sm">
      <div className="text-center">
        <Loader2 className="size-6 text-sky-300 animate-spin mx-auto" />
        <p className="mt-3 text-sm text-sky-200">{label}</p>
      </div>
    </div>
  );
}

function StoryCard({ m, s, onAction, pending }: { m: Memorial; s: Story; onAction: (path: string, msg: string) => void; pending: boolean }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => apiDelete<Memorial>(`/memorials/${m.id}/stories/${s.id}`),
    onSuccess: (d) => qc.setQueryData(["memorial", m.id], d),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const photo = m.photos.find((p) => p.id === s.photo_id);
  const imgBusy = s.image_status === "generating";
  const vidBusy = s.video_status === "generating";
  return (
    <article className="rounded-xl border border-slate-800 bg-[#131722] overflow-hidden grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" data-testid={`story-card-${s.id}`}>
      <div className="relative aspect-video bg-[#030712] overflow-hidden">
        {s.video_url ? (
          <video src={s.video_url} poster={s.image_url ?? undefined} className="size-full object-cover" controls loop muted playsInline data-testid={`story-video-${s.id}`} />
        ) : s.image_url ? (
          <img src={s.image_url} alt={s.title} className="size-full object-cover" data-testid={`story-image-${s.id}`} />
        ) : (
          <div className="size-full grid place-items-center holo-scanlines">
            <p className="text-sm text-slate-500 px-6 text-center">No scene yet. Generate one from this story{photo ? " and the linked photo" : ""}.</p>
          </div>
        )}
        <div className="absolute inset-0 holo-scanlines pointer-events-none" />
        <Status busy={imgBusy} label="Painting the memory… (~30–60s)" />
        <Status busy={!imgBusy && vidBusy} label="Animating clip… (2–5 min)" />
      </div>
      <div className="p-5 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl text-slate-100" data-testid={`story-title-${s.id}`}>{s.title}</h3>
          <button onClick={() => del.mutate()} className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200" aria-label="Delete memory" data-testid={`story-delete-button-${s.id}`}>
            <Trash2 className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-400 leading-relaxed line-clamp-4">{s.text}</p>
        {s.caption && <p className="mt-3 text-sm italic text-sky-200/90 border-l-2 border-sky-500/50 pl-3" data-testid={`story-caption-${s.id}`}>“{s.caption}”</p>}
        {s.image_error && s.image_status === "failed" && <p className="mt-3 text-xs text-red-400" data-testid={`story-image-error-${s.id}`}>Scene failed: {s.image_error}</p>}
        {s.video_error && s.video_status === "failed" && <p className="mt-3 text-xs text-red-400" data-testid={`story-video-error-${s.id}`}>Clip failed: {s.video_error}</p>}
        <div className="mt-auto pt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            className="bg-sky-500 hover:bg-sky-400 text-white"
            disabled={imgBusy || pending}
            onClick={() => onAction(`/memorials/${m.id}/stories/${s.id}/generate-image`, "Scene generation started")}
            data-testid={`story-generate-image-button-${s.id}`}
          >
            {s.image_url ? <RefreshCw className="size-3.5" /> : <Wand2 className="size-3.5" />}
            {s.image_url ? "Regenerate scene" : "Generate scene"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-slate-600"
            disabled={!s.image_url || vidBusy || imgBusy || pending}
            onClick={() => onAction(`/memorials/${m.id}/stories/${s.id}/generate-video`, "Clip animation started. This takes a few minutes.")}
            data-testid={`story-generate-video-button-${s.id}`}
          >
            <Clapperboard className="size-3.5" /> {s.video_url ? "Re-animate clip" : "Animate clip"}
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function MemorialStudio() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [story, setStory] = useState<StoryCreate>({ title: "", text: "", photo_id: null });
  const [edit, setEdit] = useState<MemorialUpdate | null>(null);

  const q = useQuery({
    queryKey: ["memorial", id],
    queryFn: () => apiGet<Memorial>(`/memorials/${id}`),
    refetchInterval: (query) => (isGenerating(query.state.data) ? 4000 : false),
  });
  const m = q.data;
  const setM = (d: Memorial) => {
    qc.setQueryData(["memorial", id], d);
    qc.invalidateQueries({ queryKey: ["memorials"] });
  };

  const action = useMutation({
    mutationFn: ({ path }: { path: string; msg: string }) => apiPost<Memorial>(path),
    onSuccess: (d, v) => { setM(d); toast.success(v.msg); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const onAction = (path: string, msg: string) => action.mutate({ path, msg });

  const upload = useMutation({
    mutationFn: (files: File[]) => {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      return apiUpload<Memorial>(`/memorials/${id}/photos`, fd);
    },
    onSuccess: (d) => { setM(d); toast.success("Photos added"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const delPhoto = useMutation({
    mutationFn: (pid: string) => apiDelete<Memorial>(`/memorials/${id}/photos/${pid}`),
    onSuccess: setM,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const addStory = useMutation({
    mutationFn: (body: StoryCreate) => apiPost<Memorial>(`/memorials/${id}/stories`, body),
    onSuccess: (d) => { setM(d); setStory({ title: "", text: "", photo_id: null }); toast.success("Memory added"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const save = useMutation({
    mutationFn: (body: MemorialUpdate) => apiPatch<Memorial>(`/memorials/${id}`, body),
    onSuccess: (d) => { setM(d); setEdit(null); toast.success("Details saved"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => apiDelete<{ ok: boolean }>(`/memorials/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["memorials"] }); toast.success("Memorial deleted"); nav("/memorials"); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const back = (
    <Link to="/memorials" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100 transition-colors duration-200" data-testid="studio-back-link">
      <ArrowLeft className="size-4" /> All memorials
    </Link>
  );

  if (q.isPending) {
    return <div className="mx-auto max-w-7xl px-5 md:px-8 py-12">{back}<div className="mt-8 h-40 rounded-xl bg-slate-800/40 animate-pulse" /></div>;
  }
  if (q.isError || !m) {
    return <div className="mx-auto max-w-7xl px-5 md:px-8 py-12">{back}<p className="mt-8 text-slate-400" data-testid="studio-error">This memorial couldn't be loaded. It may have been deleted, or the server is unavailable.</p></div>;
  }

  const sceneCount = m.stories.filter((s) => s.image_url).length;
  const finaleBusy = m.finale.status === "generating";
  const narrBusy = m.narration.status === "generating";
  const ending = m.finale.ending ?? "ascension";
  const first = m.name.split(" ")[0];
  const FINALE_COPY: Record<string, { title: string; desc: string }> = {
    ascension: { title: "Ascension finale", desc: `${m.name} rises to heaven with luminous wings into golden light.` },
    sunset: { title: "Sunset finale", desc: `A warm sunset fading to gold, chosen by ${first}'s family.` },
    starfield: { title: "Starfield finale", desc: `Drifting into a calm night sky, chosen by ${first}'s family.` },
    "favorite-place": { title: "Favorite-place finale", desc: `A final scene somewhere ${first} loved, chosen by the family. Add the place in the order notes.` },
    none: { title: "Simple fade", desc: "The family chose a simple fade, so there's no finale scene to generate." },
  };
  const fin = FINALE_COPY[ending] ?? FINALE_COPY.ascension;

  return (
    <div className="mx-auto max-w-7xl px-5 md:px-8 py-10">
      {back}
      <header className="mt-6 flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-800 pb-8">
        <div>
          <p className="mono-label mb-3">Memorial studio{m.is_sample ? " · sample" : ""}</p>
          <h1 className="text-4xl md:text-5xl text-slate-100 tracking-tight" data-testid="studio-name">{m.name}</h1>
          <p className="mt-2 font-mono text-sm text-sky-300" data-testid="studio-lifespan">{lifespan(m)}</p>
          {m.epitaph && <p className="mt-2 text-slate-400 italic">{m.epitaph}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/memorials/${m.id}/show`} className={cn(buttonVariants({ size: "lg" }), "bg-sky-500 hover:bg-sky-400 text-white holo-glow")} data-testid="studio-play-show-button">
            <Play className="size-4" /> Play Memory Show
          </Link>
          <Button variant="outline" size="lg" className="border-slate-700" onClick={() => setEdit(edit ? null : { name: m.name, birth_date: m.birth_date, death_date: m.death_date, epitaph: m.epitaph })} data-testid="studio-edit-details-button">
            Edit details
          </Button>
          <Button variant="ghost" size="lg" className="text-slate-400 hover:text-red-400" onClick={() => { if (window.confirm(`Delete the memorial for ${m.name}?`)) remove.mutate(); }} data-testid="studio-delete-button">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </header>

      {edit && (
        <form
          className="mt-6 rounded-xl border border-slate-700 bg-[#131722] p-5 grid md:grid-cols-4 gap-4 items-end"
          onSubmit={(e) => { e.preventDefault(); save.mutate(edit); }}
          data-testid="studio-edit-form"
        >
          <div className="space-y-1.5"><Label htmlFor="e-name">Name</Label><Input id="e-name" value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} data-testid="studio-edit-name-input" /></div>
          <div className="space-y-1.5"><Label htmlFor="e-b">Born</Label><Input id="e-b" type="date" value={edit.birth_date ?? ""} onChange={(e) => setEdit({ ...edit, birth_date: e.target.value })} data-testid="studio-edit-birth-input" /></div>
          <div className="space-y-1.5"><Label htmlFor="e-d">Passed</Label><Input id="e-d" type="date" value={edit.death_date ?? ""} onChange={(e) => setEdit({ ...edit, death_date: e.target.value })} data-testid="studio-edit-death-input" /></div>
          <div className="space-y-1.5"><Label htmlFor="e-ep">Epitaph</Label><Input id="e-ep" value={edit.epitaph ?? ""} onChange={(e) => setEdit({ ...edit, epitaph: e.target.value })} data-testid="studio-edit-epitaph-input" /></div>
          <Button type="submit" disabled={save.isPending} className="md:col-span-4 md:w-fit bg-sky-500 hover:bg-sky-400 text-white" data-testid="studio-edit-save-button">Save details</Button>
        </form>
      )}

      <div className="mt-10 grid lg:grid-cols-12 gap-8">
        {/* Left: photos + add memory */}
        <aside className="lg:col-span-4 space-y-8">
          <section>
            <div className="flex items-center justify-between">
              <p className="mono-label">01 · Photos</p>
              <span className="text-xs text-slate-500 font-mono">{m.photos.length}</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">Clear photos of the person's face help the AI capture their likeness.</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) upload.mutate(Array.from(e.target.files)); e.target.value = ""; /* copy before clearing: the FileList is live */ }} data-testid="studio-photo-file-input" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={upload.isPending}
              className="mt-4 w-full rounded-xl border border-dashed border-slate-700 hover:border-sky-500/60 bg-[#131722] py-6 flex flex-col items-center gap-2 text-slate-400 hover:text-sky-200 transition-colors duration-200"
              data-testid="studio-photo-upload-button"
            >
              {upload.isPending ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
              <span className="text-sm">{upload.isPending ? "Uploading…" : "Upload photos"}</span>
            </button>
            {m.photos.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2" data-testid="studio-photo-grid">
                {m.photos.map((p, i) => (
                  <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-800">
                    <img src={p.url} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                    <button onClick={() => delPhoto.mutate(p.id)} className="absolute top-1 right-1 p-1 rounded bg-black/60 text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:text-red-400" aria-label="Remove photo" data-testid={`studio-photo-delete-${p.id}`}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <p className="mono-label">02 · Add a memory</p>
            <form
              className="mt-4 rounded-xl backdrop-blur-xl bg-slate-900/80 border border-slate-700/50 p-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!story.title.trim() || !story.text.trim()) return toast.error("Please add a title and the story");
                addStory.mutate(story);
              }}
              data-testid="studio-add-story-form"
            >
              <div className="space-y-1.5">
                <Label htmlFor="s-title">Title</Label>
                <Input id="s-title" placeholder="The day she taught me to fish" value={story.title} onChange={(e) => setStory({ ...story, title: e.target.value })} data-testid="studio-story-title-input" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-text">The memory</Label>
                <Textarea id="s-text" rows={4} placeholder="Where were you? What did they do or say? What did it look like?" value={story.text} onChange={(e) => setStory({ ...story, text: e.target.value })} data-testid="studio-story-text-input" />
              </div>
              <div className="space-y-1.5">
                <Label>Reference photo</Label>
                <Select value={story.photo_id ?? "auto"} onValueChange={(v: string) => setStory({ ...story, photo_id: v === "auto" ? null : v })}>
                  <SelectTrigger className="w-full" data-testid="studio-story-photo-select">
                    <SelectValue>{(v) => (v === "auto" || !v ? "Use all photos (automatic)" : `Photo ${m.photos.findIndex((p) => p.id === v) + 1}`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Use all photos (automatic)</SelectItem>
                    {m.photos.map((p, i) => <SelectItem key={p.id} value={p.id}>Photo {i + 1}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={addStory.isPending} className="w-full" data-testid="studio-add-story-button">
                <ImagePlus className="size-4" /> Add memory
              </Button>
            </form>
          </section>
        </aside>

        {/* Right: scenes, finale, narration */}
        <div className="lg:col-span-8 space-y-10">
          <section>
            <div className="flex items-center justify-between">
              <p className="mono-label">03 · Memory scenes</p>
              <span className="text-xs text-slate-500 font-mono" data-testid="studio-scene-count">{sceneCount}/{m.stories.length} scenes ready</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">Nano Banana Pro paints each memory as a soft, glowing scene. Animating a clip with Kling v3 is optional, slower and costs more credits.</p>
            <div className="mt-4 space-y-4" data-testid="studio-story-list">
              {m.stories.length === 0 && <p className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-slate-500">No memories yet. Add the first one on the left.</p>}
              {m.stories.map((s) => <StoryCard key={s.id} m={m} s={s} onAction={onAction} pending={action.isPending} />)}
            </div>
          </section>

          <section className="grid md:grid-cols-2 gap-5">
            <div className="rounded-xl border border-amber-500/30 bg-[#131722] overflow-hidden" data-testid="studio-finale-panel">
              <div className="relative aspect-video bg-[#030712]">
                {m.finale.image_url ? (
                  <img src={m.finale.image_url} alt={fin.title} className="size-full object-cover" data-testid="studio-finale-image" />
                ) : (
                  <div className="size-full grid place-items-center"><Feather className="size-8 text-amber-300/60" /></div>
                )}
                <Status busy={finaleBusy} label="Creating the finale… (~30–60s)" />
              </div>
              <div className="p-5">
                <p className="mono-label !text-amber-400" data-testid="studio-finale-title">04 · {fin.title}</p>
                <p className="mt-2 text-sm text-slate-400">{fin.desc}</p>
                {m.finale.status === "failed" && m.finale.error && <p className="mt-2 text-xs text-red-400" data-testid="studio-finale-error">{m.finale.error}</p>}
                <Button
                  className="mt-4 bg-amber-500 hover:bg-amber-400 text-slate-950"
                  disabled={finaleBusy || action.isPending || ending === "none"}
                  onClick={() => onAction(`/memorials/${m.id}/finale/generate`, `${fin.title} started`)}
                  data-testid="studio-generate-finale-button"
                >
                  <Feather className="size-4" /> {m.finale.image_url ? "Regenerate finale" : "Generate finale"}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#131722] p-5 flex flex-col" data-testid="studio-narration-panel">
              <p className="mono-label">05 · Narration script</p>
              <div className="relative mt-3 flex-1 min-h-40 space-y-3 text-sm">
                {m.narration.intro ? (
                  <>
                    <p className="text-slate-300 leading-relaxed" data-testid="studio-narration-intro">{m.narration.intro}</p>
                    <p className="text-xs text-slate-500">+ a spoken caption for each memory scene</p>
                    <p className="text-amber-200/90 leading-relaxed italic" data-testid="studio-narration-finale">{m.narration.finale}</p>
                  </>
                ) : (
                  <p className="text-slate-500">Claude writes an opening, a caption for each memory and a closing for the finale. Add your memories first.</p>
                )}
                {narrBusy && <div className="absolute inset-0 grid place-items-center bg-[#131722]/85"><Loader2 className="size-5 animate-spin text-sky-300" /></div>}
              </div>
              {m.narration.status === "failed" && m.narration.error && <p className="mt-2 text-xs text-red-400" data-testid="studio-narration-error">{m.narration.error}</p>}
              <Button
                variant="outline"
                className="mt-4 border-slate-600 w-fit"
                disabled={narrBusy || action.isPending || m.stories.length === 0}
                onClick={() => onAction(`/memorials/${m.id}/narration/generate`, "Writing narration…")}
                data-testid="studio-generate-narration-button"
              >
                <Sparkles className="size-4" /> {m.narration.intro ? "Rewrite narration" : "Write narration"}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
