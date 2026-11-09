import { describe, expect, it } from "vitest";
import { captionCues, EXPLAINER_CLOSING_ID, normalizePhotoFrame, photoCoverRect, revealTimes, sceneDuration, sceneNarration, withExplainerClosing } from "@/lib/explainer";
import type { ExplainerScene } from "@/lib/course";

describe("required explainer ending", () => {
  const scene: ExplainerScene = { id: "saved-scene", kind: "recap", heading: "Recap", narration: "Review", items: [], items2: [], quote: null, source: null, illustration_prompt: null, voice: "Charon", voice_path: "org/audio.wav", image_path: "org/photo.jpg" };

  it("appends a distinct closing scene to previously saved content without altering uploaded media", () => {
    const original = [scene];
    const result = withExplainerClosing(original);
    expect(result).toHaveLength(2);
    expect(result.at(-1)?.id).toBe(EXPLAINER_CLOSING_ID);
    expect(result.at(-1)?.voice).toBe("Charon");
    expect(result.at(-1)?.voice_path).toBeUndefined();
    expect(result[0]).toBe(scene);
    expect(original).toEqual([scene]);
  });

  it("keeps exactly one closing scene at the end when rebuilding or reordering a script", () => {
    const closing = withExplainerClosing([])[0];
    if (!closing) throw new Error("Closing scene missing");
    const result = withExplainerClosing([closing, scene, closing]);
    expect(result.map((s) => s.id)).toEqual(["saved-scene", EXPLAINER_CLOSING_ID]);
    expect(withExplainerClosing(result)).toEqual(result);
  });
});

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

import { countUp, footageNeeded, playsFootage, sceneStyle, transitionFor, cameraAt, kenBurnsZoom, musicGain, musicLoopSample } from "@/lib/explainer";

describe("explainer video styles", () => {
  it("scene style overrides the video style, and the closing card is always animated", () => {
    expect(sceneStyle({ id: "a" }, "footage")).toBe("footage");
    expect(sceneStyle({ id: "a", style: "animated" }, "footage")).toBe("animated");
    expect(sceneStyle({ id: "a" }, undefined)).toBe("animated");
    expect(sceneStyle({ id: "relay-explainer-closing", style: "footage" }, "footage")).toBe("animated");
  });
  it("a footage scene without a clip falls back to animation", () => {
    expect(playsFootage({ id: "a" }, "footage", false)).toBe(false);
    expect(playsFootage({ id: "a" }, "footage", true)).toBe(true);
    expect(playsFootage({ id: "a" }, "animated", true)).toBe(false);
  });
  it("only footage scenes without a clip need one made", () => {
    const s = [{ id: "a" }, { id: "b", clip_path: "x.mp4" }, { id: "c", style: "animated" as const }];
    expect(footageNeeded(s, "footage").map((x) => x.id)).toEqual(["a"]);
  });
});

describe("explainer motion", () => {
  it("no transition into the first scene, varied after", () => {
    expect(transitionFor(0)).toBeNull();
    expect(new Set([1, 2, 3, 4].map(transitionFor)).size).toBe(4);
  });
  it("big numbers count up to their exact value", () => {
    expect(countUp("73% of incidents", 0)).toBe("0% of incidents");
    expect(countUp("73% of incidents", 1)).toBe("73% of incidents");
    expect(countUp("1,250 reports", 1)).toBe("1,250 reports");
    expect(countUp("No numbers", 0.5)).toBe("No numbers");
  });
  it("camera never shows the frame edge and photo zoom grows 12%", () => {
    expect(cameraAt(0, 5, 0).scale).toBeGreaterThanOrEqual(1.02);
    expect(kenBurnsZoom(1.5, 5, 5)).toBeCloseTo(1.68);
  });
  it("music is 20 dB below full scale under the voice and lifts only in pauses", () => {
    expect(musicGain(true)).toBe(0.1);
    expect(musicGain(false)).toBe(0.24);
    expect(musicGain(true)).toBeLessThan(musicGain(false));
  });
  it("crossfades a repeated instrumental instead of restarting it abruptly", () => {
    const channel = Float32Array.from([0, 0.2, 0.4, 0.6, 0.8, 1]);
    const fade = 2;
    const period = channel.length - fade;
    expect(musicLoopSample(channel, period, fade)).toBeCloseTo(0.8);
    expect(musicLoopSample(channel, period + 1, fade)).toBeCloseTo(0.6);
    expect(musicLoopSample(channel, period + 2, fade)).toBeCloseTo(0.4);
  });
});

import { clipHandoff, clipTimeAt } from "@/lib/explainer";
describe("short clip handoff", () => {
  it("hands a 6s clip in a 15s scene to a slide instead of looping", () => {
    expect(clipHandoff(15, 6)).toEqual({ clipEnd: 6, handoffStart: 5.5, mode: "slide" });
    expect(clipTimeAt(10, 6)).toBeCloseTo(5.99);
  });
  it("holds the last frame for a gap under 1 second", () => {
    expect(clipHandoff(6.5, 6).mode).toBe("hold");
  });
  it("leaves clips longer than the scene unchanged", () => {
    expect(clipHandoff(5, 6).mode).toBe("none");
  });
});
