import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const APP_URL = "https://relay.civicplexus.org";

export const sendInviteEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ inviteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, claims } = context;
    // RLS only lets org owners read invites, so this doubles as the permission check.
    const { data: invite } = await supabase
      .from("org_invites")
      .select("id, org_id, email, role, token, accepted_at")
      .eq("id", data.inviteId)
      .maybeSingle();
    if (!invite || invite.accepted_at) return { sent: false as const, reason: "not_found" as const };
    const { data: org } = await supabase.from("organizations").select("name").eq("id", invite.org_id).maybeSingle();
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    try {
      const r = await sendTemplateEmail("team-invite", invite.email, {
        idempotencyKey: `team-invite-${invite.id}`,
        templateData: {
          orgName: org?.name,
          inviterEmail: (claims as { email?: string }).email,
          role: invite.role,
          inviteUrl: `${APP_URL}/invite/${invite.token}`,
        },
      });
      return r.sent ? { sent: true as const } : { sent: false as const, reason: r.reason };
    } catch (e) {
      console.error("invite email failed", e);
      return { sent: false as const, reason: "error" as const };
    }
  });
