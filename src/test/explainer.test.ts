import { describe, expect, it } from "vitest";
import { captionCues, normalizePhotoFrame, photoCoverRect, revealTimes, sceneDuration, sceneNarration } from "@/lib/explainer";

describe("explainer timing", () => {
  it("uses uploaded scene audio instead of AI, even without written narration", async () => {
    let aiCalls = 0;
    expect(await sceneNarration({ narration: "", voice_path: "org/recordings/scene.wav" }, async () => "own-audio", async () => { aiCalls++; return "ai-audio"; })).toBe("own-audio");
    expect(aiCalls).toBe(0);
  });

  it("uses AI when uploaded audio is removed and does not silently replace failed uploads", async () => {
    expect(await sceneNarration({ narration: "Hello", voice_path: null }, async () => "own", async () => "ai")).toBe("ai");
    await expect(sceneNarration({ narration: "Hello", voice_path: "missing" }, async () => { throw new Error("missing audio"); }, async () => "ai")).rejects.toThrow("missing audio");
  });

  it("keeps the selected focal point centered at the requested zoom", () => {
    expect(photoCoverRect(1600, 900, 1280, 720, { x: 0.75, y: 0.5, zoom: 2 })).toEqual({ x: -1280, y: -360, width: 2560, height: 1440 });
    expect(photoCoverRect(1600, 900, 1280, 720, { x: 1, y: 0, zoom: 2 })).toEqual({ x: -1280, y: 0, width: 2560, height: 1440 });
  });

  it("defaults to a centered photo and constrains zoom and focus to safe bounds", () => {
    expect(normalizePhotoFrame()).toEqual({ x: 0.5, y: 0.5, zoom: 1 });
    expect(normalizePhotoFrame({ x: -1, y: 2, zoom: 9 })).toEqual({ x: 0, y: 1, zoom: 3 });
  });
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
