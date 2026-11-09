export type SlideLayout = "title" | "section" | "bullets" | "scenario" | "key_point";

export type Slide = {
  id: string;
  layout: SlideLayout;
  title: string;
  subtitle: string | null;
  bullets: string[];
  body: string | null;
  notes: string;
  source: string;
  /** Optional AI scene clip (storage path) played before this slide in the narrated video. */
  clip_path?: string | null;
  clip_prompt?: string | null;
  /** Optional voiceover recorded by the user (storage path); used instead of the AI voice. */
  voice_path?: string | null;
  /** AI voice for this slide; empty uses the brand kit voice. */
  voice?: string | null;
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  source: string;
};

export type CourseContent = {
  objectives: string[];
  slides: Slide[];
  quiz: QuizQuestion[];
  explainer?: Explainer | null;
};

export type Brand = {
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  heading_font: string;
  body_font: string;
  intro_text: string;
  outro_text: string;
  voice: string;
};

export const DEFAULT_BRAND: Brand = {
  logo_url: null,
  primary_color: "#1F3A5F",
  accent_color: "#E07A3F",
  background_color: "#FAF7F2",
  text_color: "#1B1B1B",
  heading_font: "Fraunces",
  body_font: "Work Sans",
  intro_text: "Welcome to your training",
  outro_text: "Thank you for completing this training",
  voice: "Kore",
};

export const FONT_CHOICES = ["Fraunces", "Work Sans", "Playfair Display", "IBM Plex Sans", "Merriweather", "Space Grotesk", "Lora", "Archivo"];
export const VOICE_LABELS: Record<string, string> = {
  Kore: "Kore (female, firm)",
  Aoede: "Aoede (female, breezy)",
  Leda: "Leda (female, youthful)",
  Gacrux: "Gacrux (female, mature)",
  Sulafat: "Sulafat (female, warm)",
  Puck: "Puck (male, upbeat)",
  Charon: "Charon (male, informative)",
  Fenrir: "Fenrir (male, energetic)",
  Orus: "Orus (male, firm)",
  Algenib: "Algenib (male, gravelly)",
  Achird: "Achird (male, friendly)",
  Enceladus: "Enceladus (male, soft)",
};
export const VOICE_CHOICES = Object.keys(VOICE_LABELS);
export const voiceLabel = (v: string) => VOICE_LABELS[v] ?? v;

export const LAYOUTS: { value: SlideLayout; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "section", label: "Section divider" },
  { value: "bullets", label: "Bullet points" },
  { value: "scenario", label: "Scenario" },
  { value: "key_point", label: "Key point" },
];

export const newId = () => Math.random().toString(36).slice(2, 10);

export function emptySlide(layout: SlideLayout = "bullets"): Slide {
  return { id: newId(), layout, title: "New slide", subtitle: null, bullets: [], body: null, notes: "", source: "" };
}

/** Normalizes whatever is stored in the database into a safe CourseContent. */
export function normalizeContent(raw: unknown): CourseContent {
  const r = (raw ?? {}) as Partial<CourseContent>;
  return {
    objectives: Array.isArray(r.objectives) ? r.objectives : [],
    slides: Array.isArray(r.slides) ? r.slides.map((s) => ({ ...emptySlide(), ...s, bullets: s.bullets ?? [] })) : [],
    quiz: Array.isArray(r.quiz) ? r.quiz : [],
    explainer: r.explainer && Array.isArray(r.explainer.scenes) ? r.explainer : null,
  };
}

/** Score a quiz attempt as a whole percentage. */
export function scoreQuiz(quiz: QuizQuestion[], answers: (number | null)[]): number {
  if (quiz.length === 0) return 100;
  const correct = quiz.filter((q, i) => answers[i] === q.correct_index).length;
  return Math.round((correct / quiz.length) * 100);
}

export function canEdit(role: string | null | undefined) {
  return role === "owner" || role === "editor";
}

/** Monthly AI generation allowance per organization. */
export const MONTHLY_GENERATION_LIMIT = 30;

/** Monthly AI scene clip allowance per organization (clips are the most expensive item). */
export const MONTHLY_CLIP_LIMIT = 20;

/* ---------------- Explainer video ---------------- */
export type ExplainerKind = "title" | "points" | "dodont" | "steps" | "quote" | "fact" | "illustration" | "scenario" | "recap";

export type ExplainerScene = {
  id: string;
  kind: ExplainerKind;
  /** What the narrator says during this scene. */
  narration: string;
  heading: string;
  /** Bullets, steps, "Do" items, recap items, or the scenario's right actions. */
  items: string[];
  /** "Don't" items (Do / Don't scenes only). */
  items2: string[];
  quote: string | null;
  source: string | null;
  illustration_prompt: string | null;
  image_path?: string | null;
  /** Slide whose AI scene clip plays behind this scene. */
  clip_slide_id?: string | null;
  /** AI voice for this scene; empty uses the brand kit voice. */
  voice?: string | null;
  /** Uploaded scene narration in the private documents bucket; overrides AI. */
  voice_path?: string | null;
  /** Photo focal point in normalized source-image coordinates and cover zoom. */
  image_frame?: { x: number; y: number; zoom: number } | null;
  /** Per-scene look; empty follows the video's style. */
  style?: ExplainerStyle | null;
  /** AI footage clip made for this scene (private documents bucket). */
  clip_path?: string | null;
  clip_prompt?: string | null;
};

export type ExplainerStyle = "animated" | "footage";

export type ExplainerTone = "friendly" | "formal" | "plain";

export type Explainer = {
  length: 2 | 4 | 6;
  tone: ExplainerTone;
  illustrations: boolean;
  includeClips: boolean;
  /** Whole-video look; scenes can override. Missing means animated. */
  style?: ExplainerStyle;
  /** Soft background music under the narration. */
  music?: boolean;
  scenes: ExplainerScene[];
};

export const EXPLAINER_KINDS: { value: ExplainerKind; label: string }[] = [
  { value: "title", label: "Title card" },
  { value: "points", label: "Key points" },
  { value: "dodont", label: "Do / Don't" },
  { value: "steps", label: "Steps" },
  { value: "quote", label: "Policy quote" },
  { value: "fact", label: "Big number / fact" },
  { value: "illustration", label: "Illustration" },
  { value: "scenario", label: "Scenario" },
  { value: "recap", label: "Recap" },
];

/** Scenes the AI writes for each target length (minutes). */
export const EXPLAINER_SCENES: Record<2 | 4 | 6, number> = { 2: 8, 4: 11, 6: 15 };
/** Most AI illustrations one explainer video can use. */
export const MAX_ILLUSTRATIONS_PER_VIDEO = 15;
/** Monthly AI illustration allowance per organization. */
export const MONTHLY_ILLUSTRATION_LIMIT = 60;

export const sceneUsesPicture = (s: ExplainerScene) => s.kind === "illustration" || s.kind === "scenario";
