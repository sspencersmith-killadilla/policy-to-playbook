// Pure timing helpers for the explainer video (shared by the renderer, captions and tests).
import type { ExplainerScene, ExplainerStyle } from "./course";

export const EXPLAINER_CLOSING_ID = "relay-explainer-closing";

/** Enforce the closing scene for new and saved scripts without changing their media indices. */
export function withExplainerClosing(scenes: ExplainerScene[]): ExplainerScene[] {
  const content = scenes.filter((scene) => scene.id !== EXPLAINER_CLOSING_ID);
  const last = content.at(-1);
  return [...content, {
    id: EXPLAINER_CLOSING_ID,
    kind: "title",
    heading: "Thank you for watching",
    narration: "Thank you for watching, and for taking the time to learn.",
    items: [],
    items2: [],
    quote: null,
    source: null,
    illustration_prompt: null,
    voice: last?.voice ?? null,
  }];
}

export type PhotoFrame = { x: number; y: number; zoom: number };
export function normalizePhotoFrame(frame?: Partial<PhotoFrame> | null): PhotoFrame {
  const finite = (v: number | undefined, fallback: number) => typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return {
    x: Math.max(0, Math.min(1, finite(frame?.x, 0.5))),
    y: Math.max(0, Math.min(1, finite(frame?.y, 0.5))),
    zoom: Math.max(1, Math.min(3, finite(frame?.zoom, 1))),
  };
}

/** Covers the video without blank edges, keeping the selected source point centered where possible. */
export function photoCoverRect(sw: number, sh: number, width: number, height: number, frame?: Partial<PhotoFrame> | null) {
  const f = normalizePhotoFrame(frame);
  const scale = Math.max(width / sw, height / sh) * f.zoom;
  const w = sw * scale, h = sh * scale;
  return { x: Math.max(width - w, Math.min(0, width / 2 - f.x * w)), y: Math.max(height - h, Math.min(0, height / 2 - f.y * h)), width: w, height: h };
}

/** Uploaded audio is authoritative, including when the written script is empty. */
export async function sceneNarration<T>(scene: { narration: string; voice_path?: string | null }, uploaded: () => Promise<T>, ai: () => Promise<T>): Promise<T | null> {
  if (scene.voice_path) return uploaded();
  return scene.narration.trim() ? ai() : null;
}

/** A scene lasts as long as its narration plus a short pause, never under 3 seconds. */
export function sceneDuration(narrationSeconds: number | null | undefined): number {
  return Math.max(3, (narrationSeconds ?? 0) + 0.8);
}

/**
 * When each of a scene's n items appears. The first shows at 0.8s, the rest spread evenly
 * so the last appears by 75% of the scene, while the narrator is still talking about it.
 */
export function revealTimes(n: number, duration: number): number[] {
  if (n <= 0) return [];
  const first = Math.min(0.8, duration * 0.2);
  const last = Math.max(first, duration * 0.75);
  if (n === 1) return [first];
  return Array.from({ length: n }, (_, i) => first + ((last - first) * i) / (n - 1));
}

export type Cue = { start: number; end: number; text: string };

/** Splits narration into ~12-word caption cues timed across [start, start + duration - 0.8]. */
export function captionCues(narration: string, start: number, duration: number): Cue[] {
  const words = narration.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const speak = Math.max(0.5, duration - 0.8);
  const chunks: string[][] = [];
  for (let i = 0; i < words.length; i += 12) chunks.push(words.slice(i, i + 12));
  let t = start;
  return chunks.map((c) => {
    const len = (c.length / words.length) * speak;
    const cue = { start: t, end: t + len, text: c.join(" ") };
    t += len;
    return cue;
  });
}

const vttTime = (t: number) => {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
};

export function cuesToVtt(cues: Cue[]): string {
  return "WEBVTT\n\n" + cues.map((c, i) => `${i + 1}\n${vttTime(c.start)} --> ${vttTime(c.end)}\n${c.text}\n`).join("\n");
}

/* ---------------- Motion & style helpers ---------------- */

/** A scene's effective look: its own choice, else the video's, else animated. The closing card is always animated. */
export function sceneStyle(scene: { id: string; style?: ExplainerStyle | null }, videoStyle?: ExplainerStyle | null): ExplainerStyle {
  if (scene.id === EXPLAINER_CLOSING_ID) return "animated";
  return scene.style ?? videoStyle ?? "animated";
}

/** Footage scenes that still need an AI clip made. */
export function footageNeeded<T extends { id: string; style?: ExplainerStyle | null; clip_path?: string | null }>(scenes: T[], videoStyle?: ExplainerStyle | null): T[] {
  return scenes.filter((s) => sceneStyle(s, videoStyle) === "footage" && !s.clip_path);
}

/** Footage plays only when the scene wants footage and a clip exists; otherwise it falls back to animation. */
export function playsFootage(scene: { id: string; style?: ExplainerStyle | null }, videoStyle: ExplainerStyle | null | undefined, hasClip: boolean): boolean {
  return hasClip && sceneStyle(scene, videoStyle) === "footage";
}

export type Transition = "fade" | "slide" | "wipe" | "zoom";
const TRANSITIONS: Transition[] = ["slide", "wipe", "zoom", "fade"];
/** Transition into scene i (none for the first scene). */
export function transitionFor(i: number): Transition | null {
  return i <= 0 ? null : TRANSITIONS[(i - 1) % TRANSITIONS.length]!;
}
export const TRANSITION_SECONDS = 0.6;

/** Seconds of crossfade when a short clip hands off to its scene's animated slide. */
export const HANDOFF_FADE = 0.5;

/** How a clip shorter than its scene finishes: no loop — it holds its last frame for tiny gaps, otherwise hands off to a slide. */
export function clipHandoff(sceneDur: number, clipDur: number | null | undefined): { clipEnd: number; handoffStart: number; mode: "none" | "hold" | "slide" } {
  const c = clipDur && clipDur > 0 ? clipDur : 0;
  if (!c || c >= sceneDur) return { clipEnd: sceneDur, handoffStart: sceneDur, mode: "none" };
  if (sceneDur - c < 1) return { clipEnd: c, handoffStart: sceneDur, mode: "hold" };
  return { clipEnd: c, handoffStart: Math.max(0, c - HANDOFF_FADE), mode: "slide" };
}

/** Clip playback position at scene-local time t: plays once, then rests on the final frame. */
export function clipTimeAt(t: number, clipDur: number): number {
  return Math.max(0, Math.min(t, clipDur - 0.01));
}

export const easeInOut = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2; };

/** Slow camera drift across a scene: starts 2% in (so edges never show), pushes in 4% more, alternating drift direction. */
export function cameraAt(t: number, d: number, i: number) {
  const p = easeInOut(t / Math.max(0.1, d));
  const dir = i % 2 === 0 ? 1 : -1;
  return { scale: 1.02 + 0.04 * p, dx: dir * (p - 0.5) * 12, dy: (p - 0.5) * -6 };
}

/** Ken Burns zoom on photos: grows 1.0 -> 1.12 of the saved zoom, keeping the focal point. */
export function kenBurnsZoom(baseZoom: number, t: number, d: number) {
  return baseZoom * (1 + 0.12 * easeInOut(t / Math.max(0.1, d)));
}

/** Counts the first number in a heading up from 0 (e.g. "73% of incidents"), keeping its formatting. */
export function countUp(text: string, p: number): string {
  const m = text.match(/\d[\d,]*(\.\d+)?/);
  if (!m) return text;
  const raw = m[0], target = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(target)) return text;
  const dec = m[1] ? m[1].length - 1 : 0;
  const v = target * easeInOut(p);
  let out = v.toFixed(dec);
  if (raw.includes(",")) out = Number(out).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return text.slice(0, m.index) + out + text.slice((m.index ?? 0) + raw.length);
}

/** Real instrumental gain: about 20 dB below full scale under speech, lifting gently in pauses. */
export function musicGain(voiceActive: boolean) {
  return voiceActive ? 0.1 : 0.24;
}

/** Repeat a decoded track with a short crossfade instead of an audible hard restart. */
export function musicLoopSample(channel: Float32Array, index: number, fadeSamples: number): number {
  const length = channel.length;
  if (!length) return 0;
  const fade = Math.max(0, Math.min(fadeSamples, Math.floor(length / 2)));
  if (!fade) return channel[index % length] ?? 0;
  const period = length - fade;
  const cycle = Math.floor(index / period);
  const position = index - cycle * period;
  const current = channel[position] ?? 0;
  if (cycle === 0 || position >= fade) return current;
  const previous = channel[position + period] ?? 0;
  const blend = position / fade;
  return previous * (1 - blend) + current * blend;
}
