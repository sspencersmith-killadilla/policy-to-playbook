import { afterEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { canManageVoiceConnection } from "@/lib/voice-credentials";
import { encryptVoiceKey, decryptVoiceKey, testVoiceKey } from "@/lib/voice-credentials.server";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("organization voice credentials", () => {
  it("allows only an owner to manage a connection", () => {
    expect(canManageVoiceConnection("owner")).toBe(true);
    expect(canManageVoiceConnection("editor")).toBe(false);
    expect(canManageVoiceConnection("viewer")).toBe(false);
    expect(canManageVoiceConnection(undefined)).toBe(false);
  });
  it("encrypts keys and binds decryption to the organization", async () => {
    vi.stubGlobal("crypto", webcrypto);
    vi.stubEnv("ORG_CREDENTIAL_ENCRYPTION_KEY", "test-only-encryption-material-not-a-real-key");
    const sample = "test-only-provider-credential";
    const sealed = await encryptVoiceKey("org-a", sample);
    expect(sealed.includes(sample)).toBe(false);
    expect((await decryptVoiceKey("org-a", sealed)) === sample).toBe(true);
    await expect(decryptVoiceKey("org-b", sealed)).rejects.toThrow();
  });
  it("rejects altered ciphertext", async () => {
    vi.stubGlobal("crypto", webcrypto);
    vi.stubEnv("ORG_CREDENTIAL_ENCRYPTION_KEY", "test-only-encryption-material-not-a-real-key");
    const sealed = JSON.parse(await encryptVoiceKey("org-a", "test-only"));
    sealed.data[0] ^= 1;
    await expect(decryptVoiceKey("org-a", JSON.stringify(sealed))).rejects.toThrow();
  });
  it("rejects a key missing voice permissions without returning provider details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: { status: "missing_permissions", message: "provider-sensitive-content" } }), { status: 401 })));
    await expect(testVoiceKey("test-only")).rejects.toThrow("This key needs Voices: Read and Write");
  });
  it("accepts a successful provider voice access check", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    await expect(testVoiceKey("test-only")).resolves.toBeUndefined();
  });
});