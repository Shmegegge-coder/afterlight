// Hand-written mirrors of backend/models/*.py — keep in sync.

export type GenStatus = "idle" | "generating" | "done" | "failed";

export interface Photo {
  id: string;
  url: string;
}

export interface Story {
  id: string;
  title: string;
  text: string;
  photo_id: string | null;
  caption: string;
  image_url: string | null;
  image_status: GenStatus;
  image_error: string | null;
  video_url: string | null;
  video_status: GenStatus;
  video_error: string | null;
}

export interface Finale {
  image_url: string | null;
  status: GenStatus;
  error: string | null;
}

export interface Narration {
  intro: string;
  finale: string;
  status: GenStatus;
  error: string | null;
}

export interface Memorial {
  id: string;
  name: string;
  birth_date: string;
  death_date: string;
  epitaph: string;
  is_sample: boolean;
  photos: Photo[];
  stories: Story[];
  finale: Finale;
  narration: Narration;
  created_at: string;
}

export interface MemorialCreate {
  name: string;
  birth_date: string;
  death_date: string;
  epitaph: string;
}

export type MemorialUpdate = Partial<MemorialCreate>;

export interface StoryCreate {
  title: string;
  text: string;
  photo_id: string | null;
}

export interface PlanRequest {
  city: string;
  budget: number;
  goals: string;
  experience: string;
}

export interface Plan extends PlanRequest {
  id: string;
  content: string;
  created_at: string;
}

export type PlanStreamEvent =
  | { type: "delta"; content: string }
  | { type: "done"; id: string }
  | { type: "error"; message: string };

export function isGenerating(m: Memorial | undefined): boolean {
  if (!m) return false;
  return (
    m.finale.status === "generating" ||
    m.narration.status === "generating" ||
    m.stories.some((s) => s.image_status === "generating" || s.video_status === "generating")
  );
}

export function yearOf(d: string): string {
  return d ? d.slice(0, 4) : "";
}

export function lifespan(m: Pick<Memorial, "birth_date" | "death_date">): string {
  const a = yearOf(m.birth_date);
  const b = yearOf(m.death_date);
  return a || b ? `${a || "?"} — ${b || "?"}` : "";
}
