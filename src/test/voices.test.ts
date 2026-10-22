import { describe, expect, it } from "vitest";
import { canCreateVoice, resolveVoice } from "@/lib/voices";

describe("custom voices", () => {
  it("falls back to the brand kit voice when a custom voice was deleted", () => {
    expect(resolveVoice("custom:abc", "Charon", [])).toBe("Charon");
    expect(resolveVoice("custom:abc", "Charon", [{ id: "abc" }])).toBe("custom:abc");
  });
  it("allows at most 10 custom voices per organization", () => {
    expect(canCreateVoice(9, true).ok).toBe(true);
    expect(canCreateVoice(10, true).ok).toBe(false);
  });
  it("requires consent before creating a voice", () => {
    expect(canCreateVoice(0, false).ok).toBe(false);
  });
});
