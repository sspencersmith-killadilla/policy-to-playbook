import { describe, expect, it } from "vitest";
import { BRAND_SLOTS, canEdit, DEFAULT_BRAND, resolveCourseBrand, scoreQuiz, MONTHLY_GENERATION_LIMIT, type BrandKit, type QuizQuestion } from "@/lib/course";

const q = (c: number): QuizQuestion => ({ id: String(c), question: "", options: ["a", "b", "c", "d"], correct_index: c, explanation: "", source: "" });

describe("course rules", () => {
  it("scores quiz as a whole percentage", () => {
    expect(scoreQuiz([q(0), q(1), q(2)], [0, 1, 3])).toBe(67);
  });
  it("only owners and editors can edit", () => {
    expect(canEdit("owner")).toBe(true);
    expect(canEdit("editor")).toBe(true);
    expect(canEdit("viewer")).toBe(false);
  });
  it("allows 30 AI generations per org per 30 days", () => {
    expect(MONTHLY_GENERATION_LIMIT).toBe(30);
  });

  const kit = (slot: "A" | "B" | "C" | "D", color: string): BrandKit => ({
    ...DEFAULT_BRAND, id: `kit-${slot}`, org_id: "org-1", slot, name: `Kit ${slot}`, primary_color: color,
  });
  const kits = BRAND_SLOTS.map((slot, i) => kit(slot, `#00000${i}`));

  it("offers exactly four brand kits: A, B, C and D", () => {
    expect(BRAND_SLOTS).toEqual(["A", "B", "C", "D"]);
    expect(kits).toHaveLength(4);
  });

  it("keeps each course on its own selected brand kit", () => {
    expect(resolveCourseBrand(kits, "kit-B").primary_color).toBe("#000001");
    expect(resolveCourseBrand(kits, "kit-D").primary_color).toBe("#000003");
    expect(resolveCourseBrand(kits, "kit-A").primary_color).toBe("#000000");
  });

  it("keeps existing or missing brand links on Kit A", () => {
    expect(resolveCourseBrand(kits, null).primary_color).toBe("#000000");
    expect(resolveCourseBrand(kits, "deleted-kit").primary_color).toBe("#000000");
  });
});
