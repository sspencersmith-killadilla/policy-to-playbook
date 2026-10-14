import { describe, it, expect } from "vitest";
import { narrationKey, isRetryableStatus, pool } from "@/lib/narration";

describe("narration cache key", () => {
  it("is the same for the same voice and text", async () => {
    expect(await narrationKey("Kore", "Hello")).toBe(await narrationKey("Kore", "Hello"));
  });
  it("changes when the voice changes", async () => {
    expect(await narrationKey("Kore", "Hello")).not.toBe(await narrationKey("Puck", "Hello"));
  });
});

describe("voiceover retry rule", () => {
  it("retries 429 and 503", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
  });
  it("does not retry 400 or 402", () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(402)).toBe(false);
  });
});

describe("voiceover pool", () => {
  it("runs at most 3 at once and keeps order", async () => {
    let live = 0, peak = 0;
    const r = await pool(8, 3, async (i) => { live++; peak = Math.max(peak, live); await new Promise((s) => setTimeout(s, 5)); live--; return i; });
    expect(peak).toBe(3);
    expect(r).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});
