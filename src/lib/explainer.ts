// Pure timing helpers for the explainer video (shared by the renderer, captions and tests).

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
