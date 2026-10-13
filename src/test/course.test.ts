import { describe, expect, it } from "vitest";
import { canEdit, scoreQuiz, MONTHLY_GENERATION_LIMIT, type QuizQuestion } from "@/lib/course";

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
});
