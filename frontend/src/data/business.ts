// Researched US estimates (2025–2026, USD). Every number is editable in the calculators.

export const IMG = {
  hero: "https://images.unsplash.com/photo-1768692508167-bc60a243b386?crop=entropy&cs=srgb&fm=jpg&q=85&w=2000",
  ascension: "https://images.unsplash.com/photo-1707218526479-91d005196060?crop=entropy&cs=srgb&fm=jpg&q=85&w=1800",
  room: "https://images.unsplash.com/photo-1748525938712-a065b4396ba4?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600",
  clouds: "https://images.unsplash.com/photo-1525291713758-6c2990e200ff?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600",
};

export interface HardwareOption {
  id: string;
  name: string;
  what: string;
  cost: string;
  bestFor: string;
  tradeoff: string;
}

export const HARDWARE: HardwareOption[] = [
  {
    id: "peppers-ghost",
    name: "Pepper's Ghost stage",
    what: "An angled transparent foil reflects a hidden screen/projector so a life-size figure appears to stand on stage.",
    cost: "$3,000 – $15,000 per event (rental) · $20k+ to own",
    bestFor: "The life-size ascension finale at the front of the chapel",
    tradeoff: "Needs a dark room, 6–10 ft depth and 3–5 hours of setup.",
  },
  {
    id: "hologauze",
    name: "Hologauze / holo-net scrim",
    what: "A near-invisible front-projection gauze. Images float in mid-air while the room behind stays visible.",
    cost: "$300 – $600 per m² to buy · ~10 m² screen ≈ $3k–$6k",
    bestFor: "Floating memory scenes above the urn or casket area",
    tradeoff: "Needs bright projectors (10k+ lumens) and black drape behind.",
  },
  {
    id: "room-wrap",
    name: "Room-wrap projection mapping",
    what: "2–6 projectors blend images across walls and ceiling, so memories surround the guests.",
    cost: "Projector rental $300 – $800/day each · laser 10k-lumen ≈ $6k – $15k to buy",
    bestFor: "Filling the whole room with the person's life story",
    tradeoff: "Edge-blending and mapping need a skilled operator.",
  },
  {
    id: "holobox",
    name: "Holobox-style display cabinet",
    what: "A self-contained, plug-and-play 3D display booth that shows a person at human scale.",
    cost: "≈ $5,000 – $27,000 to buy · rental ≈ $1,500 – $4,000/event",
    bestFor: "Smaller chapels, homes, receptions and simple setup",
    tradeoff: "Fixed size; less immersive than a full room.",
  },
  {
    id: "fan",
    name: "3D hologram fans (LED spinners)",
    what: "Spinning LED blades create floating images. Several can be tiled into a wall.",
    cost: "$300 – $1,200 per day rental · $250 – $2,500 to buy",
    bestFor: "Entry-level packages, entrance displays, keepsake tables",
    tradeoff: "Visible blades up close; best viewed from the front.",
  },
];

export interface SoftwareTool {
  name: string;
  role: string;
  cost: string;
}

export const SOFTWARE: SoftwareTool[] = [
  { name: "Resolume Arena", role: "Live playback, cue lists and projector edge-blending", cost: "≈ $900 one-time" },
  { name: "TouchDesigner", role: "Real-time effects: particles, glow, ascension sequence", cost: "$600/yr Commercial · $2,200 Pro" },
  { name: "MadMapper", role: "Simple projection mapping onto walls, drapes and objects", cost: "≈ $450 one-time or monthly plan" },
  { name: "disguise (d3)", role: "Premium show control for large venues (hardware-based)", cost: "Software free · media servers $20k+ (rent per show)" },
  { name: "QLab", role: "Show cueing for music, narration and video", cost: "Free – $999 (licences)" },
  { name: "DaVinci Resolve", role: "Editing the memory film and keepsake video", cost: "Free · Studio $295" },
  { name: "Blender / Unreal Engine", role: "3D wings, clouds and heaven environment for the finale", cost: "Free" },
];

export const AI_TOOLS: SoftwareTool[] = [
  { name: "Nano Banana Pro (Google)", role: "Turns family photos + stories into dreamlike memory scenes and the winged ascension", cost: "≈ $0.15 – $0.30 per image" },
  { name: "Kling v3 / Veo 3.1", role: "Animates still scenes into short living-memory clips", cost: "≈ $0.50 – $3 per 5-sec clip" },
  { name: "Claude (Anthropic)", role: "Writes narration, captions and the family-intake questionnaire", cost: "Cents per memorial" },
  { name: "ElevenLabs", role: "Narration voice (with family consent, a cloned voice)", cost: "$5 – $99/mo" },
  { name: "Topaz Photo / Video AI", role: "Upscales and restores old, low-resolution photos", cost: "≈ $200 – $300/yr" },
];

export const WORKFLOW = [
  { step: "Intake", detail: "A 45-minute family meeting collects photos, videos, stories, music and the person's personality. Consent forms are signed.", time: "Day 1" },
  { step: "Scene creation", detail: "AI turns stories into memory scenes. An editor colour-grades them, adds animation and builds the ascension finale.", time: "Days 1–3" },
  { step: "Family review", detail: "The family previews the Memory Show online and requests changes. Final approval.", time: "Day 3–4" },
  { step: "Setup", detail: "The crew installs projectors, gauze or the Holobox, drapes, and audio, then runs a tech rehearsal.", time: "3–5 hrs before" },
  { step: "The service", detail: "The operator runs the show live: memories fill the room during the eulogy, and the ascension closes the service.", time: "60–90 min" },
];

export type PlanKey = "rent" | "buy";

export interface BudgetItem {
  id: string;
  label: string;
  note: string;
  kind: "startup" | "event";
  rent: number;
  buy: number;
}

// ---- Per-service delivery costs (rent-first), itemised so Pricing and Budget always agree ----
export type CostPart = "display" | "projectors" | "crew" | "content" | "transport" | "consumables" | "rider";

export const COST_PART_LABELS: Record<CostPart, { label: string; note: string }> = {
  display: { label: "Hologram display rental", note: "Fan (Essentials) · Pepper's Ghost (Legacy)" },
  projectors: { label: "Projector rental", note: "2× 10k-lumen, 1 day (Signature & Legacy)" },
  crew: { label: "Crew", note: "$40/hr · 1×5h / 2×6h / 3×9h by package" },
  content: { label: "Content creation", note: "Editor $50/hr + AI images, clips, voice (all packages)" },
  transport: { label: "Transport", note: "Van rental / fuel" },
  consumables: { label: "Consumables", note: "Drapes, gaffer tape, cabling" },
  rider: { label: "Event insurance rider", note: "Per-venue certificate" },
};

const sumParts = (p: Record<CostPart, number>) => Object.values(p).reduce((a, v) => a + v, 0);

export interface Tier {
  id: "memory-film" | "essentials" | "signature" | "legacy";
  name: string;
  tagline: string;
  includes: string[];
  parts: Record<CostPart, number>;
  cost: number; // = sum(parts); editable in the Pricing calculator
  markup: number; // % over cost
  mix: number; // % of bookings
}

const RAW_TIERS: Omit<Tier, "cost">[] = [
  {
    id: "memory-film",
    name: "Memory Film",
    tagline: "Content only: an AI memory film and online memorial, no equipment",
    includes: ["Online family intake + consent", "Up to 12 AI memory scenes + narration", "Private review link, 2 revision rounds", "HD video file + online memorial page"],
    parts: { display: 0, projectors: 0, crew: 0, content: 175, transport: 0, consumables: 0, rider: 0 },
    markup: 300,
    mix: 30,
  },
  {
    id: "essentials",
    name: "Essentials",
    tagline: "A photo memory show on the venue's screen plus a hologram-fan display",
    includes: ["Memory show on the venue's existing screen", "One hologram-fan display at the entrance or urn table", "Up to 30 restored photos + AI-written narration", "1 technician, 2-hour service"],
    parts: { display: 400, projectors: 0, crew: 200, content: 225, transport: 60, consumables: 40, rider: 25 },
    markup: 160,
    mix: 40,
  },
  {
    id: "signature",
    name: "Signature",
    tagline: "A room-wrap of memories plus AI video scenes",
    includes: ["Room-wrap projection on 2–3 walls", "10 AI memory scenes + 4 animated clips", "Winged ascension finale", "2 technicians, rehearsal, family preview"],
    parts: { display: 0, projectors: 900, crew: 480, content: 650, transport: 100, consumables: 120, rider: 50 },
    markup: 155,
    mix: 22,
  },
  {
    id: "legacy",
    name: "Legacy",
    tagline: "A full immersive room, custom ascension and keepsake video",
    includes: ["Pepper's Ghost life-size figure + full room-wrap", "Up to 25 scenes, custom 3D heaven finale", "Voice narration & music score", "4K keepsake film + online memorial"],
    parts: { display: 3000, projectors: 900, crew: 1080, content: 1800, transport: 200, consumables: 200, rider: 100 },
    markup: 105,
    mix: 8,
  },
];

export const TIERS: Tier[] = RAW_TIERS.map((t) => ({ ...t, cost: sumParts(t.parts) }));

// Funeral-home revenue share + card processing, taken off the top of every sale.
export const DEFAULT_REV_SHARE = 20;
export const DEFAULT_PAYMENT_FEE = 3;

const mixTotal = TIERS.reduce((a, t) => a + t.mix, 0);
const blended = (part: CostPart) => Math.round(TIERS.reduce((a, t) => a + t.parts[part] * (t.mix / mixTotal), 0));

// Owning gear removes display/projector rental and adds maintenance; van fuel replaces rental.
const BUY_OVERRIDES: Partial<Record<CostPart, number>> = { display: 0, projectors: 0, transport: 50 };

const EVENT_ROWS: BudgetItem[] = (Object.keys(COST_PART_LABELS) as CostPart[]).map((part) => ({
  id: part,
  label: COST_PART_LABELS[part].label,
  note: `${COST_PART_LABELS[part].note} · blended across package mix`,
  kind: "event",
  rent: blended(part),
  buy: BUY_OVERRIDES[part] ?? blended(part),
}));

export const BUDGET_DEFAULTS: BudgetItem[] = [
  { id: "display-own", label: "Hologram display hardware", note: "Holobox unit or Pepper's Ghost kit", kind: "startup", rent: 0, buy: 18000 },
  { id: "gauze", label: "Hologauze screen + truss", note: "~10 m² at ~$450/m² + truss", kind: "startup", rent: 0, buy: 6000 },
  { id: "projectors-own", label: "Laser projectors (2×)", note: "10k-lumen class", kind: "startup", rent: 0, buy: 16000 },
  { id: "media-server", label: "Media server PC (GPU)", note: "Runs Resolume / TouchDesigner", kind: "startup", rent: 3500, buy: 3500 },
  { id: "software", label: "Show-control software", note: "Resolume, TouchDesigner, MadMapper", kind: "startup", rent: 2000, buy: 2000 },
  { id: "audio", label: "Audio system", note: "Speakers, mixer, wireless mics", kind: "startup", rent: 0, buy: 2500 },
  { id: "van", label: "Cargo van", note: "Used van down-payment", kind: "startup", rent: 0, buy: 12000 },
  { id: "legal", label: "Business setup & contracts", note: "LLC, attorney, consent forms", kind: "startup", rent: 1500, buy: 1500 },
  { id: "insurance", label: "Insurance (year 1)", note: "General liability + equipment", kind: "startup", rent: 2500, buy: 3500 },
  { id: "brand", label: "Website, brand & demo reel", note: "Your pitch asset", kind: "startup", rent: 3000, buy: 3000 },
  { id: "marketing", label: "Launch marketing", note: "Funeral-director outreach, trade show booth", kind: "startup", rent: 4000, buy: 4000 },
  { id: "ai-credits", label: "AI credits & stock assets", note: "Image/video generation, music licences", kind: "startup", rent: 500, buy: 500 },
  ...EVENT_ROWS,
  { id: "maintenance", label: "Equipment maintenance", note: "Laser hours, repairs (owned gear only)", kind: "event", rent: 0, buy: 150 },
];

export interface PitchGroup {
  id: string;
  name: string;
  examples: string[];
  angle: string;
  nextSteps: string[];
  priority: "High" | "Medium" | "Long-term";
}

export const PITCH_GROUPS: PitchGroup[] = [
  {
    id: "chains",
    name: "Funeral home chains",
    examples: ["Service Corporation International (SCI / Dignity Memorial)", "Park Lawn Corporation", "Carriage Services", "Foundation Partners Group"],
    angle: "A premium add-on that raises the average revenue per service by $3k–$15k, especially on cremation cases where revenue has dropped.",
    nextSteps: ["Ask for the regional market or innovation director on LinkedIn", "Offer a free pilot at 1–3 locations", "Bring a revenue-share proposal (e.g. 20% to the home)"],
    priority: "High",
  },
  {
    id: "independents",
    name: "Independent funeral homes & cremation providers",
    examples: ["Family-owned homes in your city", "Direct-cremation providers", "Pet-cremation services (a lower-stakes test market)"],
    angle: "Help them stand out from the chains and give cremation families a meaningful service without a casket.",
    nextSteps: ["Visit 10 local homes with a tablet demo of the Memory Show", "Offer the first service at cost for a testimonial", "Leave a printed price sheet with the wholesale rate"],
    priority: "High",
  },
  {
    id: "cemeteries",
    name: "Cemeteries & memorial parks",
    examples: ["Forest Lawn", "Rose Hills", "Local municipal and Catholic cemeteries"],
    angle: "Chapel and on-site service upgrades, plus anniversary and Día de los Muertos memorial nights that bring families back.",
    nextSteps: ["Pitch a recurring annual remembrance event", "Propose a permanent hologram chapel install"],
    priority: "Medium",
  },
  {
    id: "associations",
    name: "Funeral-industry associations",
    examples: ["NFDA (National Funeral Directors Association)", "CANA (Cremation Association of North America)", "Your state funeral directors association", "Selected Independent Funeral Homes"],
    angle: "Credibility and access to thousands of funeral directors at once.",
    nextSteps: ["Exhibit or demo at the NFDA International Convention & Expo", "Submit a talk on 'memorialization for cremation families'", "Advertise in association newsletters"],
    priority: "High",
  },
  {
    id: "grief-tech",
    name: "Grief-tech companies",
    examples: ["StoryFile", "HereAfter AI", "Tribute / Kudoboard-style memorial platforms", "Online obituary sites"],
    angle: "Partnership: their recorded stories and AI likeness become your live holographic content, and you become their physical-event arm.",
    nextSteps: ["Propose an integration or referral partnership", "Co-market a joint package"],
    priority: "Medium",
  },
  {
    id: "av-partners",
    name: "Hologram & AV companies (partners)",
    examples: ["Proto (Holobox maker)", "ARHT Media", "Hologram USA", "Local event AV rental houses"],
    angle: "Wholesale or rental discounts and white-label equipment, so you launch without buying hardware.",
    nextSteps: ["Ask for reseller / rental-partner pricing", "Negotiate a per-event revenue share instead of buying"],
    priority: "High",
  },
  {
    id: "churches",
    name: "Church networks",
    examples: ["Large multi-campus churches", "Catholic dioceses' bereavement ministries", "Black church funeral networks", "Hispanic parish networks"],
    angle: "Churches host many services and already own AV. The ascension finale fits faith-based celebrations.",
    nextSteps: ["Meet the pastor or bereavement ministry lead", "Offer a church-partner rate and a demo after Sunday service"],
    priority: "Medium",
  },
  {
    id: "investors",
    name: "Death-care & grief-tech investors",
    examples: ["Angel groups in your city", "Impact/aging-focused VCs (e.g. 'longevity & end-of-life' funds)", "SBA 7(a) or microloan lenders", "Pitch competitions & accelerators"],
    angle: "The US funeral market is ~$20B+/yr, cremation is over 60% and rising. Families need new ways to memorialize.",
    nextSteps: ["Prove demand with 5–10 paid services first", "Build a one-page deck: problem, demo, unit economics, traction", "Apply to local pitch competitions"],
    priority: "Long-term",
  },
];

export const usd = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits });
