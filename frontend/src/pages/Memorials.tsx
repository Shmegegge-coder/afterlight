import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/SiteLayout";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPost, errorMessage } from "@/lib/api";
import { lifespan, type Memorial, type MemorialCreate } from "@/lib/types";
import { IMG } from "@/data/business";
import { cn } from "@/lib/utils";

export function coverOf(m: Memorial): string | null {
  return m.stories.find((s) => s.image_url)?.image_url ?? m.finale.image_url ?? m.photos[0]?.url ?? null;
}

const EMPTY: MemorialCreate = { name: "", birth_date: "", death_date: "", epitaph: "" };

export default function Memorials() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<MemorialCreate>(EMPTY);
  const list = useQuery({ queryKey: ["memorials"], queryFn: () => apiGet<Memorial[]>("/memorials") });

  const create = useMutation({
    mutationFn: (body: MemorialCreate) => apiPost<Memorial>("/memorials", body),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["memorials"] });
      setOpen(false);
      setForm(EMPTY);
      nav(`/memorials/${m.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Memorial creator · live demo"
        title="Build a Memory Show"
        intro="Add the person's photos and the family's stories. AI turns each story into a glowing memory scene, writes the narration and creates the winged ascension finale. Then play it full-screen to preview the room projection."
      >
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="mt-8 bg-sky-500 hover:bg-sky-400 text-white" data-testid="memorials-create-button" />}>
            <Plus className="size-4" /> New memorial
          </DialogTrigger>
          <DialogContent className="bg-[#131722] border-slate-700">
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">Who are we remembering?</DialogTitle>
              <DialogDescription>You can add photos and stories on the next screen.</DialogDescription>
            </DialogHeader>
            <form
              id="create-memorial"
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.name.trim()) return toast.error("Please enter a name");
                create.mutate(form);
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="m-name">Full name</Label>
                <Input id="m-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Walter James Brooks" data-testid="memorial-create-name-input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="m-born">Born</Label>
                  <Input id="m-born" type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} data-testid="memorial-create-birth-input" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-died">Passed</Label>
                  <Input id="m-died" type="date" value={form.death_date} onChange={(e) => setForm({ ...form, death_date: e.target.value })} data-testid="memorial-create-death-input" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-epitaph">Epitaph <span className="text-slate-500">(optional)</span></Label>
                <Input id="m-epitaph" value={form.epitaph} onChange={(e) => setForm({ ...form, epitaph: e.target.value })} placeholder="Father, fisherman, storyteller" data-testid="memorial-create-epitaph-input" />
              </div>
            </form>
            <DialogFooter>
              <Button type="submit" form="create-memorial" disabled={create.isPending} className="bg-sky-500 hover:bg-sky-400 text-white" data-testid="memorial-create-submit-button">
                {create.isPending ? "Creating…" : "Create memorial"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <section className="mx-auto max-w-7xl px-5 md:px-8 py-12">
        {list.isPending && <div className="grid md:grid-cols-3 gap-5">{[0, 1, 2].map((i) => <div key={i} className="aspect-[4/3] rounded-xl bg-slate-800/40 animate-pulse" />)}</div>}
        {list.isError && <p className="text-slate-500" data-testid="memorials-error">Memorials are unavailable right now. Please try again shortly.</p>}
        {!list.isError && list.data && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="memorials-list">
            {list.data.map((m, i) => {
              const cover = coverOf(m) ?? IMG.clouds;
              return (
                <div key={m.id} className={cn("group relative rounded-xl overflow-hidden border border-slate-800 bg-[#131722] transition-[border-color,box-shadow] duration-300 hover:border-sky-500/50 hover:shadow-[0_0_50px_-15px_rgba(56,189,248,0.45)]", i === 0 && "lg:col-span-2 lg:row-span-1")} data-testid={`memorial-card-${m.id}`}>
                  <Link to={`/memorials/${m.id}`} className="block" data-testid={`memorial-card-open-${m.id}`}>
                    <div className={cn("relative overflow-hidden", i === 0 ? "aspect-[16/8]" : "aspect-[4/3]")}>
                      <img src={cover} alt="" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D12] via-[#0B0D12]/30 to-transparent" />
                      <div className="absolute inset-0 holo-scanlines" />
                      {m.is_sample && <span className="absolute top-3 left-3 text-[10px] font-mono uppercase tracking-widest rounded-full bg-amber-500/20 text-amber-200 px-2.5 py-1 backdrop-blur">Sample</span>}
                    </div>
                    <div className="absolute bottom-0 inset-x-0 p-5">
                      <h2 className="text-2xl text-white">{m.name}</h2>
                      <p className="font-mono text-xs text-sky-300 mt-1">{lifespan(m)}</p>
                      <p className="text-sm text-slate-400 mt-1">{m.stories.length} memories · {m.photos.length} photos</p>
                    </div>
                  </Link>
                  <Link
                    to={`/memorials/${m.id}/show`}
                    className={cn(buttonVariants({ size: "sm" }), "absolute top-3 right-3 bg-slate-900/70 backdrop-blur border border-slate-600 hover:bg-sky-500 text-white")}
                    data-testid={`memorial-card-play-${m.id}`}
                  >
                    <Play className="size-3.5" /> Play
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
