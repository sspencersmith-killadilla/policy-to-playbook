import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/org";
import { MONTHLY_GENERATION_LIMIT } from "@/lib/course";

export const Route = createFileRoute("/_app/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Refrain" },
      { name: "description", content: "Audit log of changes, approvals and exports." },
      { property: "og:title", content: "Activity — Refrain" },
      { property: "og:description", content: "Audit log of changes, approvals and exports." },
    ],
  }),
  component: Activity,
});

const labels: Record<string, string> = {
  "document.uploaded": "Uploaded a document",
  "course.generated": "Generated a course with AI",
  "course.approved": "Approved a course",
  "brand.updated": "Updated the brand kit",
  "member.invited": "Invited",
  "member.removed": "Removed a member",
  "clip.generated": "Generated an AI scene clip",
};

function Activity() {
  const { current } = useOrg();
  const q = useQuery({
    queryKey: ["audit", current?.org_id],
    queryFn: async () => (await supabase.from("audit_events").select("*").eq("org_id", current!.org_id).order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const since = Date.now() - 30 * 864e5;
  const used = q.data?.filter((e) => e.action === "course.generated" && new Date(e.created_at).getTime() > since).length ?? 0;
  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="text-4xl font-semibold">Activity</h1>
      <p className="mt-2 text-muted-foreground">AI generations used in the last 30 days: {used} of {MONTHLY_GENERATION_LIMIT}</p>
      <ul className="mt-8 divide-y rounded-lg border bg-card">
        {q.data?.map((e) => (
          <li key={e.id} className="flex justify-between gap-4 p-4 text-sm">
            <span><strong>{e.actor_email ?? "Someone"}</strong> — {labels[e.action] ?? e.action.replace(/\./g, " ")}{e.action === "member.invited" ? ` ${e.target}` : ""}</span>
            <span className="shrink-0 text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
          </li>
        ))}
        {!q.data?.length && <li className="p-4 text-muted-foreground">Nothing yet.</li>}
      </ul>
    </div>
  );
}
