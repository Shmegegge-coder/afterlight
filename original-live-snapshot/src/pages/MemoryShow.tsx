import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Maximize, Pause, Play, RotateCcw, X } from "lucide-react";
import Wings from "@/components/Wings";
import { apiGet } from "@/lib/api";
import { lifespan, type Memorial } from "@/lib/types";
import { IMG } from "@/data/business";
import { cn } from "@/lib/utils";

type Slide =
  | { kind: "intro" }
  | { kind: "scene"; id: string; title: string; caption: string; image: string; video: string | null }
  | { kind: "finale"; image: string; aiFinale: boolean }
  | { kind: "end" };

const DURATION: Record<Slide["kind"], number> = { intro: 8000, scene: 9000, finale: 16000, end: 0 };

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  size: 2 + (i % 3),
  duration: 14 + ((i * 7) % 12),
  delay: -((i * 3) % 20),
}));

function Particles({ gold }: { gold?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className={cn("absolute bottom-[-10px] rounded-full animate-drift-up", gold ? "bg-amber-200" : "bg-sky-200")}
          style={{ left: `${p.left}%`, width: p.size, height: p.size, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`, boxShadow: `0 0 8px ${gold ? "#FBBF24" : "#38BDF8"}` }}
        />
      ))}
    </div>
  );
}

function buildSlides(m: Memorial): Slide[] {
  const scenes: Slide[] = m.stories
    .filter((s) => s.image_url)
    .map((s) => ({ kind: "scene", id: s.id, title: s.title, caption: s.caption || s.text, image: s.image_url as string, video: s.video_url }));
  return [
    { kind: "intro" },
    ...scenes,
    { kind: "finale", image: m.finale.image_url ?? IMG.ascension, aiFinale: !!m.finale.image_url && !m.is_sample },
    { kind: "end" },
  ];
}

export default function MemoryShow() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: ["memorial", id], queryFn: () => apiGet<Memorial>(`/memorials/${id}`) });
  const m = q.data;
  const slides = useMemo(() => (m ? buildSlides(m) : []), [m]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const slide = slides[idx];

  const next = useCallback(() => setIdx((i) => Math.min(i + 1, Math.max(slides.length - 1, 0))), [slides.length]);
  const prev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  // Auto-advance; scenes with video advance when the clip ends instead.
  useEffect(() => {
    if (!slide || !playing || slide.kind === "end") return;
    if (slide.kind === "scene" && slide.video) return;
    const t = window.setTimeout(next, DURATION[slide.kind]);
    return () => window.clearTimeout(t);
  }, [slide, playing, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div className="fixed inset-0 bg-[#030712] text-[#E0F2FE] overflow-hidden select-none" data-testid="memory-show-player">
      <div className="absolute inset-0 holo-scanlines z-20 pointer-events-none" />
      <div className="absolute inset-x-0 h-40 bg-gradient-to-b from-transparent via-sky-300/[0.04] to-transparent z-20 pointer-events-none animate-beam" />

      {q.isPending && <div className="absolute inset-0 grid place-items-center text-sky-300/70 font-mono text-sm">Loading memories…</div>}
      {(q.isError || (!q.isPending && !m)) && (
        <div className="absolute inset-0 grid place-items-center text-center px-6">
          <div>
            <p className="font-serif text-3xl">This Memory Show isn't available right now.</p>
            <Link to="/memorials" className="mt-6 inline-block text-sky-300 hover:underline" data-testid="show-error-back-link">Back to memorials</Link>
          </div>
        </div>
      )}

      {m && slide && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${slide.kind}-${idx}`}
            className="absolute inset-0"
            initial={{ opacity: 0, filter: "blur(12px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 1.6, ease: "easeInOut" }}
            data-testid={`show-slide-${slide.kind}`}
          >
            {slide.kind === "intro" && (
              <div className="absolute inset-0 grid place-items-center px-6">
                <div className="absolute size-[60vmin] rounded-full bg-sky-500/10 blur-3xl animate-glow-pulse" />
                <Particles />
                <div className="relative text-center max-w-3xl">
                  <p className="font-mono text-xs tracking-[0.4em] uppercase text-sky-300/80">In loving memory</p>
                  <h1 className="mt-6 font-serif text-5xl md:text-7xl text-holo animate-flicker" data-testid="show-name">{m.name}</h1>
                  <p className="mt-4 font-mono text-sky-300">{lifespan(m)}</p>
                  {m.epitaph && <p className="mt-3 text-sky-100/70 italic">{m.epitaph}</p>}
                  {m.narration.intro && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2, duration: 2 }} className="mt-10 text-lg md:text-xl text-sky-50/90 leading-relaxed font-serif italic">
                      {m.narration.intro}
                    </motion.p>
                  )}
                </div>
              </div>
            )}

            {slide.kind === "scene" && (
              <>
                <div className="absolute inset-0 overflow-hidden">
                  {slide.video ? (
                    <video
                      src={slide.video}
                      poster={slide.image}
                      className="size-full object-cover memory-image animate-flicker"
                      autoPlay
                      muted
                      playsInline
                      onEnded={() => playing && next()}
                      data-testid="show-scene-video"
                    />
                  ) : (
                    <img src={slide.image} alt={slide.title} className="size-full object-cover memory-image animate-kenburns" data-testid="show-scene-image" />
                  )}
                </div>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(3,7,18,0.85)_100%)]" />
                <div className="absolute inset-0 mix-blend-screen bg-sky-400/[0.06]" />
                <Particles />
                <motion.div
                  className="absolute bottom-24 inset-x-0 px-6 md:px-16"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2, duration: 1.4 }}
                >
                  <p className="font-mono text-xs tracking-[0.3em] uppercase text-sky-300/90">{slide.title}</p>
                  <p className="mt-3 max-w-3xl font-serif text-2xl md:text-3xl text-white leading-snug" style={{ textShadow: "0 2px 20px rgba(0,0,0,0.8)" }} data-testid="show-scene-caption">
                    {slide.caption}
                  </p>
                </motion.div>
              </>
            )}

            {slide.kind === "finale" && (
              <>
                <div className="absolute inset-0 bg-gradient-to-b from-[#0b1530] via-[#1a1530] to-[#3a2410]" />
                <div className="absolute left-1/2 top-1/2 size-[180vmax] animate-rays opacity-40 pointer-events-none" style={{ background: "repeating-conic-gradient(from 0deg, rgba(253,230,138,0.18) 0deg 4deg, transparent 4deg 16deg)" }} />
                <motion.img
                  src={slide.image}
                  alt="Ascension"
                  className="absolute inset-0 size-full object-cover memory-image"
                  initial={{ y: "6%", scale: 1.05, opacity: 0.2 }}
                  animate={{ y: "-6%", scale: 1.15, opacity: 0.85 }}
                  transition={{ duration: 15, ease: [0.16, 1, 0.3, 1] }}
                  data-testid="show-finale-image"
                />
                <motion.div
                  className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(255,251,235,0.95),rgba(251,191,36,0.35)_30%,transparent_65%)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.2, 0.9] }}
                  transition={{ duration: 15, times: [0, 0.5, 1] }}
                />
                {!slide.aiFinale && (
                  <motion.div
                    className="absolute left-1/2 -translate-x-1/2 w-[min(70vw,560px)]"
                    initial={{ top: "60%", opacity: 0, scale: 0.8 }}
                    animate={{ top: "4%", opacity: [0, 1, 1, 0.2], scale: 1 }}
                    transition={{ duration: 15, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Wings className="w-full drop-shadow-[0_0_40px_rgba(251,191,36,0.6)]" />
                  </motion.div>
                )}
                <Particles gold />
                <motion.div className="absolute bottom-24 inset-x-0 text-center px-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3, duration: 2 }}>
                  <p className="max-w-3xl mx-auto font-serif text-2xl md:text-3xl text-gold-glow italic leading-snug" data-testid="show-finale-caption">
                    {m.narration.finale || `Fly high, ${m.name.split(" ")[0]}. Into the light.`}
                  </p>
                </motion.div>
              </>
            )}

            {slide.kind === "end" && (
              <div className="absolute inset-0 grid place-items-center text-center px-6">
                <div className="absolute size-[50vmin] rounded-full bg-amber-400/10 blur-3xl animate-glow-pulse" />
                <div className="relative">
                  <p className="font-serif text-4xl md:text-6xl text-gold-glow">{m.name}</p>
                  <p className="mt-4 font-mono text-amber-200/80">{lifespan(m)}</p>
                  <p className="mt-8 text-sky-100/80 font-serif italic text-xl">Forever in our hearts.</p>
                  <div className="mt-10 flex gap-3 justify-center">
                    <button onClick={() => { setIdx(0); setPlaying(true); }} className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 px-5 py-2 text-sm hover:bg-sky-400/10 transition-colors duration-200" data-testid="show-replay-button">
                      <RotateCcw className="size-4" /> Replay
                    </button>
                    <Link to={`/memorials/${m.id}`} className="inline-flex items-center gap-2 rounded-full border border-slate-600 px-5 py-2 text-sm hover:bg-white/5 transition-colors duration-200" data-testid="show-end-studio-link">
                      Back to studio
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 inset-x-0 z-30 p-4 md:p-6 flex items-center justify-between gap-4 bg-gradient-to-t from-black/70 to-transparent opacity-60 hover:opacity-100 transition-opacity duration-300">
        <Link to={m ? `/memorials/${m.id}` : "/memorials"} className="p-2 rounded-full hover:bg-white/10 transition-colors duration-200" aria-label="Exit show" data-testid="show-exit-button">
          <X className="size-5" />
        </Link>
        <div className="flex items-center gap-1.5" data-testid="show-progress">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={cn("h-1.5 rounded-full transition-[width,background-color] duration-300", i === idx ? "w-8 bg-sky-300" : "w-2 bg-white/30 hover:bg-white/60", s.kind === "finale" && i !== idx && "bg-amber-300/50")}
              aria-label={`Go to slide ${i + 1}`}
              data-testid={`show-progress-dot-${i}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prev} className="p-2 rounded-full hover:bg-white/10 transition-colors duration-200" aria-label="Previous" data-testid="show-prev-button"><ChevronLeft className="size-5" /></button>
          <button onClick={() => setPlaying((p) => !p)} className="p-2 rounded-full hover:bg-white/10 transition-colors duration-200" aria-label={playing ? "Pause" : "Play"} data-testid="show-play-pause-button">
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <button onClick={next} className="p-2 rounded-full hover:bg-white/10 transition-colors duration-200" aria-label="Next" data-testid="show-next-button"><ChevronRight className="size-5" /></button>
          <button onClick={fullscreen} className="p-2 rounded-full hover:bg-white/10 transition-colors duration-200 hidden sm:block" aria-label="Fullscreen" data-testid="show-fullscreen-button"><Maximize className="size-5" /></button>
        </div>
      </div>
    </div>
  );
}
