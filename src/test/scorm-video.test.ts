import { describe, it, expect } from "vitest";
import { buildVtt } from "@/lib/exports";
import { emptySlide } from "@/lib/course";

describe("SCORM video captions", () => {
  it("spreads each slide's narration across its chapter time", () => {
    const s = { ...emptySlide(), notes: Array.from({ length: 24 }, (_, i) => `w${i}`).join(" ") };
    const vtt = buildVtt([s], [{ slideIndex: 0, start: 10, end: 20 }]);
    expect(vtt).toContain("00:00:10.000 --> 00:00:15.000");
    expect(vtt).toContain("00:00:15.000 --> 00:00:20.000");
  });
});
