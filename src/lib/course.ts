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
export const VOICE_CHOICES = ["Kore", "Puck", "Charon", "Aoede", "Fenrir", "Leda"];

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
