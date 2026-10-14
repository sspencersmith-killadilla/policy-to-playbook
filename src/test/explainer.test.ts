import { describe, expect, it } from "vitest";
import { captionCues, revealTimes, sceneDuration } from "@/lib/explainer";

describe("explainer timing", () => {
  it("reveals every item inside the first 75% of the scene, in order", () => {
    const t = revealTimes(4, 20);
    expect(t).toHaveLength(4);
    expect(t[0]).toBeCloseTo(0.8);
    expect(t[3]).toBeCloseTo(15);
    for (let i = 1; i < t.length; i++) expect(t[i]!).toBeGreaterThan(t[i - 1]!);
  });

  it("scenes last narration plus 0.8s, at least 3 seconds", () => {
    expect(sceneDuration(10)).toBeCloseTo(10.8);
    expect(sceneDuration(1)).toBe(3);
    expect(sceneDuration(null)).toBe(3);
  });

  it("caption cues cover the spoken part of the scene", () => {
    const words = Array.from({ length: 30 }, (_, i) => `w${i}`).join(" ");
    const cues = captionCues(words, 10, 10.8);
    expect(cues).toHaveLength(3);
    expect(cues[0]!.start).toBe(10);
    expect(cues[2]!.end).toBeCloseTo(20);
  });
});
