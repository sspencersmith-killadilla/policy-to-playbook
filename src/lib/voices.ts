/** Shared helpers for organization custom (cloned) voices. */
export const MAX_ORG_VOICES = 10;
export const CUSTOM_PREFIX = "custom:";
export const VOICE_CONSENT_TEXT = "I agree that my recorded voice may be used to create an AI copy of my voice, used only for this organization's training content. I can delete it at any time.";
export const VOICE_READING_SCRIPT = "Welcome to today's training. Over the next few minutes, we'll walk through what this policy means for you and your team. Every one of us plays a part in keeping our workplace safe, fair, and respectful. If you ever have a question, reach out to your supervisor or to Human Resources. Let's start with the basics: why this matters, what's expected, and where to find help. Take your time, think about real situations you've seen, and remember there are no silly questions. Thank you for being here and for doing your part.";
export type OrgVoice = { id: string; name: string; created_by: string; created_by_email: string | null; created_at: string };
export const customVoiceValue = (id: string) => `${CUSTOM_PREFIX}${id}`;
export const isCustomVoice = (v: string | null | undefined) => !!v && v.startsWith(CUSTOM_PREFIX);
export const customVoiceId = (v: string) => v.slice(CUSTOM_PREFIX.length);
/** A custom voice that was deleted falls back to the brand kit voice (or Kore). */
export function resolveVoice(voice: string | null | undefined, brandVoice: string, orgVoices: { id: string }[]): string {
  const v = voice || brandVoice || "Kore";
  if (!isCustomVoice(v)) return v;
  if (orgVoices.some((o) => o.id === customVoiceId(v))) return v;
  return isCustomVoice(brandVoice) ? "Kore" : brandVoice || "Kore";
}
export function canCreateVoice(count: number, consented: boolean): { ok: true } | { ok: false; reason: string } {
  if (!consented) return { ok: false, reason: "Please agree to the consent statement first." };
  if (count >= MAX_ORG_VOICES) return { ok: false, reason: `Your organization already has ${MAX_ORG_VOICES} custom voices. Delete one to add another.` };
  return { ok: true };
}
