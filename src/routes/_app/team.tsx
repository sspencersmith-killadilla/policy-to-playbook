import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, logAudit } from "@/lib/org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/team")({
  head: () => ({
    meta: [
      { title: "Team — Coursewright" },
      { name: "description", content: "Invite colleagues and manage roles." },
      { property: "og:title", content: "Team — Coursewright" },
      { property: "og:description", content: "Invite colleagues and manage roles." },
    ],
  }),
  component: Team,
});

type Role = "owner" | "editor" | "viewer";

function Team() {
  const { current } = useOrg();
  const qc = useQueryClient();
  const isOwner = current?.role === "owner";
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const members = useQuery({
    queryKey: ["members", current?.org_id],
    queryFn: async () => (await supabase.from("org_members").select("user_id, email, role").eq("org_id", current!.org_id)).data ?? [],
  });
  const invites = useQuery({
    queryKey: ["invites", current?.org_id],
    enabled: isOwner,
    queryFn: async () => (await supabase.from("org_invites").select("id, email, role, token, accepted_at").eq("org_id", current!.org_id).is("accepted_at", null)).data ?? [],
  });
  const link = (token: string) => `${window.location.origin}/invite/${token}`;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("org_invites").insert({ org_id: current!.org_id, email: email.trim().toLowerCase(), role, created_by: u.user!.id }).select("token").single();
    if (error) { toast.error(error.message); return; }
    await navigator.clipboard.writeText(link(data.token)).catch(() => {});
    await logAudit(current!.org_id, "member.invited", email);
    toast.success("Invite link copied. Send it to your colleague.");
    setEmail("");
    qc.invalidateQueries({ queryKey: ["invites"] });
  }
  async function changeRole(userId: string, r: Role) {
    const { error } = await supabase.from("org_members").update({ role: r }).eq("org_id", current!.org_id).eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["members"] });
  }
  async function remove(userId: string) {
    const { error } = await supabase.from("org_members").delete().eq("org_id", current!.org_id).eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    await logAudit(current!.org_id, "member.removed", userId);
    qc.invalidateQueries({ queryKey: ["members"] });
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="text-4xl font-semibold">Team</h1>
      <p className="mt-2 text-muted-foreground">Owners manage the team and brand. Editors build and approve courses. Viewers can only look.</p>
      {isOwner && (
        <form onSubmit={invite} className="mt-8 flex gap-2">
          <Input type="email" required placeholder="colleague@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="owner">Owner</SelectItem><SelectItem value="editor">Editor</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectContent>
          </Select>
          <Button type="submit">Invite</Button>
        </form>
      )}
      <ul className="mt-8 divide-y rounded-lg border bg-card">
        {members.data?.map((m) => (
          <li key={m.user_id} className="flex items-center justify-between gap-4 p-4">
            <span>{m.email}</span>
            {isOwner ? (
              <div className="flex gap-2">
                <Select value={m.role} onValueChange={(v) => changeRole(m.user_id, v as Role)}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="owner">Owner</SelectItem><SelectItem value="editor">Editor</SelectItem><SelectItem value="viewer">Viewer</SelectItem></SelectContent>
                </Select>
                <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => remove(m.user_id)}><Trash2 /></Button>
              </div>
            ) : <span className="text-sm capitalize text-muted-foreground">{m.role}</span>}
          </li>
        ))}
      </ul>
      {isOwner && !!invites.data?.length && (
        <>
          <h2 className="mt-10 text-xl font-semibold">Pending invites</h2>
          <ul className="mt-3 divide-y rounded-lg border bg-card">
            {invites.data.map((i) => (
              <li key={i.id} className="flex items-center justify-between p-4">
                <span>{i.email} <span className="text-sm capitalize text-muted-foreground">· {i.role}</span></span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(link(i.token)); toast.success("Link copied"); }}><Copy /> Copy link</Button>
                  <Button size="icon" variant="ghost" aria-label="Cancel invite" onClick={async () => { await supabase.from("org_invites").delete().eq("id", i.id); qc.invalidateQueries({ queryKey: ["invites"] }); }}><Trash2 /></Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
