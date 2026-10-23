import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({ orgId: z.string().uuid() });
async function owner(client: any, orgId: string, userId: string) {
  const { assertVoiceOwner } = await import("./voice-credentials.server");
  await assertVoiceOwner(client, orgId, userId);
}
export const saveVoiceConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgInput.extend({ apiKey: z.string().trim().min(1).max(1024) }).parse(d))
  .handler(async ({ data, context }) => {
    await owner(context.supabase, data.orgId, context.userId);
    const { credentialStore, encryptVoiceKey, testVoiceKey } = await import("./voice-credentials.server");
    await testVoiceKey(data.apiKey);
    const encrypted = await encryptVoiceKey(data.orgId, data.apiKey);
    const admin = await credentialStore();
    const { error } = await admin.from("org_voice_credentials").upsert({ org_id: data.orgId, encrypted_key: encrypted, updated_by: context.userId, updated_at: new Date().toISOString(), tested_at: new Date().toISOString() });
    if (error) throw new Error("Could not save your connection. Please try again.");
    return { ok: true };
  });
export const testVoiceConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator((d: unknown) => orgInput.parse(d))
  .handler(async ({ data, context }) => {
    await owner(context.supabase, data.orgId, context.userId);
    const { orgVoiceKey, testVoiceKey, credentialStore } = await import("./voice-credentials.server");
    await testVoiceKey(await orgVoiceKey(data.orgId));
    const admin = await credentialStore();
    const { error } = await admin.from("org_voice_credentials").update({ tested_at: new Date().toISOString() }).eq("org_id", data.orgId);
    if (error) throw new Error("Could not save the connection check.");
    return { ok: true };
  });
export const removeVoiceConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator((d: unknown) => orgInput.parse(d))
  .handler(async ({ data, context }) => {
    await owner(context.supabase, data.orgId, context.userId);
    const { credentialStore } = await import("./voice-credentials.server");
    const admin = await credentialStore();
    const { error } = await admin.from("org_voice_credentials").delete().eq("org_id", data.orgId);
    if (error) throw new Error("Could not remove the connection.");
    return { ok: true };
  });