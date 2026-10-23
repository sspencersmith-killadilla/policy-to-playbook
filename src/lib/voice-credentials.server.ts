import { AiError } from "./ai.server";

const encoder = new TextEncoder();
async function encryptionKey() {
  const secret = process.env["ORG_CREDENTIAL_ENCRYPTION_KEY"];
  if (!secret) throw new Error("Secure voice settings are unavailable. Please try again later.");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptVoiceKey(orgId: string, value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(orgId) }, await encryptionKey(), encoder.encode(value));
  return JSON.stringify({ v: 1, iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) });
}
export async function decryptVoiceKey(orgId: string, encrypted: string) {
  const row = JSON.parse(encrypted);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(row.iv), additionalData: encoder.encode(orgId) }, await encryptionKey(), new Uint8Array(row.data));
  return new TextDecoder().decode(plain);
}
// Call only after checking membership or ownership using the caller's RLS client.
export async function credentialStore() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
export async function orgVoiceKey(orgId: string) {
  const admin = await credentialStore();
  const { data, error } = await admin.from("org_voice_credentials").select("encrypted_key").eq("org_id", orgId).maybeSingle();
  if (error) throw new Error("Could not load the voice connection.");
  if (!data) throw new AiError("Custom voices aren't connected. Ask an owner to add your organization's ElevenLabs key in Brand kit.", 503);
  return decryptVoiceKey(orgId, data.encrypted_key);
}
export async function testVoiceKey(key: string) {
  const response = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(20000) });
  if (response.ok) return;
  // Never log or return a provider body: it may contain credential-related data.
  let missing = false;
  try { const body = await response.json(); missing = body?.detail?.status === "missing_permissions" || body?.detail?.code === "missing_permissions"; } catch {}
  if (missing) throw new AiError("This key needs Voices: Read and Write, and Text to Speech access in ElevenLabs. Update its permissions and try again.", response.status);
  if (response.status === 401) throw new AiError("ElevenLabs did not accept this key. Copy an active API key from ElevenLabs and try again.", 401);
  throw new AiError(`ElevenLabs connection check failed (${response.status}). Check your account and try again.`, response.status);
}