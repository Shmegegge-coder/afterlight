// Hand-written mirror of backend/orders.py — keep in sync.

export type OrderStatus = "awaiting_intake" | "in_production" | "in_review" | "changes_requested" | "approved" | "delivered";
export type Ending = "ascension" | "sunset" | "starfield" | "favorite-place" | "none";
export type Tone = "celebratory" | "gentle" | "reverent" | "lighthearted";

export interface OrderComment {
  id: string;
  author: "family" | "studio";
  name: string;
  text: string;
  story_id: string | null;
  round: number;
  created_at: string;
}

export interface Consent {
  signer_name: string;
  relationship: string;
  is_next_of_kin: boolean;
  ai_scenes_ok: boolean;
  likeness_animation_ok: boolean;
  voice_clone_ok: boolean;
  signed_at?: string;
}

export interface IntakeDetails {
  tone: Tone;
  ending: Ending;
  music: string;
  must_include: string;
  avoid: string;
  notes: string;
  submitted_at?: string;
}

export interface Order {
  id: string;
  package_id: "memory-film";
  deceased_name: string;
  family_name: string;
  family_email: string;
  family_phone: string;
  funeral_home: string;
  service_date: string;
  price: number;
  max_revisions: number;
  status: OrderStatus;
  intake_token: string;
  review_token: string;
  memorial_id: string | null;
  intake: IntakeDetails | null;
  consent: Consent | null;
  comments: OrderComment[];
  review_round: number;
  changes_requested_count: number;
  approval: { name: string; approved_at: string; round: number } | null;
  history: { at: string; status: OrderStatus; note: string }[];
  created_at: string;
  updated_at: string;
}

export interface OrderCreate {
  package_id: "memory-film";
  deceased_name: string;
  family_name: string;
  family_email: string;
  family_phone: string;
  funeral_home: string;
  service_date: string;
}

export interface IntakeView {
  deceased_name: string;
  family_name: string;
  service_date: string;
  package_name: string;
  status: OrderStatus;
  memorial_id: string | null;
  submitted: boolean;
}

export interface ReviewView {
  deceased_name: string;
  family_name: string;
  service_date: string;
  package_name: string;
  status: OrderStatus;
  memorial_id: string;
  review_round: number;
  revisions_left: number;
  comments: OrderComment[];
  approval: Order["approval"];
  ending: Ending | null;
}

export interface IntakeSubmit extends Omit<IntakeDetails, "submitted_at"> {
  consent: Omit<Consent, "signed_at">;
}

export const STATUS_META: Record<OrderStatus, { label: string; cls: string }> = {
  awaiting_intake: { label: "Awaiting intake", cls: "border-slate-600 text-slate-300" },
  in_production: { label: "In production", cls: "border-sky-500/50 text-sky-300" },
  in_review: { label: "With family", cls: "border-violet-500/50 text-violet-300" },
  changes_requested: { label: "Changes requested", cls: "border-amber-500/50 text-amber-300" },
  approved: { label: "Approved", cls: "border-emerald-500/50 text-emerald-300" },
  delivered: { label: "Delivered", cls: "border-emerald-700/60 text-emerald-500" },
};

export const ENDINGS: { id: Ending; label: string; desc: string }[] = [
  { id: "sunset", label: "Sunset", desc: "A warm sunset fading to gold" },
  { id: "starfield", label: "Starfield", desc: "Drifting into a calm night sky" },
  { id: "favorite-place", label: "Their favorite place", desc: "A final scene somewhere they loved" },
  { id: "ascension", label: "Winged ascension", desc: "Rising with luminous wings into light" },
  { id: "none", label: "Simple fade", desc: "No finale scene, just a gentle fade" },
];

export const TONES: { id: Tone; label: string }[] = [
  { id: "gentle", label: "Gentle" },
  { id: "celebratory", label: "Celebratory" },
  { id: "reverent", label: "Reverent" },
  { id: "lighthearted", label: "Lighthearted" },
];

export const intakeUrl = (o: Pick<Order, "intake_token">) => `${window.location.origin}/intake/${o.intake_token}`;
export const reviewUrl = (o: Pick<Order, "review_token">) => `${window.location.origin}/review/${o.review_token}`;

export function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
