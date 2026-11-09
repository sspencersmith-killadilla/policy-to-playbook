import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/org";
import { normalizeContent, canEdit, resolveCourseBrand } from "@/lib/course";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScaledSlide } from "@/components/SlideView";
import { CreateOrg } from "../_app";

export const Route = createFileRoute("/_app/dashboard")({
  validateSearch: (s: Record<string, unknown>): { newOrg?: number } => (s["newOrg"] ? { newOrg: 1 } : {}),
  head: () => ({
    meta: [
      { title: "Courses — Relay" },
      { name: "description", content: "Your organization's training courses." },
      { property: "og:title", content: "Courses — Relay" },
      { property: "og:description", content: "Your organization's training courses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { current, brandKits } = useOrg();
  const { newOrg } = Route.useSearch();
  const q = useQuery({
    queryKey: ["courses", current?.org_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, description, status, content, brand_kit_id, updated_at")
        .eq("org_id", current!.org_id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  if (newOrg) return <CreateOrg onDone={() => (window.location.href = "/dashboard")} />;

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{current?.name}</p>
          <h1 className="text-4xl font-semibold">Courses</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/dashboard" search={{ newOrg: 1 }}>New organization</Link></Button>
          {canEdit(current?.role) && <Button asChild><Link to="/new"><Plus /> New course</Link></Button>}
        </div>
      </div>
      {q.isLoading ? (
        <p className="mt-10 text-muted-foreground">Loading…</p>
      ) : !q.data?.length ? (
        <div className="mt-10 rounded-lg border border-dashed p-16 text-center">
          <h2 className="text-2xl font-semibold">No courses yet</h2>
          <p className="mt-2 text-muted-foreground">Upload a policy or SOP to generate your first training.</p>
          {canEdit(current?.role) && <Button className="mt-6" asChild><Link to="/new">Upload a policy</Link></Button>}
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.map((c) => {
            const content = normalizeContent(c.content);
            return (
              <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }} className="group overflow-hidden rounded-lg border bg-card transition hover:shadow-lg">
                {content.slides[0] ? (
                  <ScaledSlide slide={content.slides[0]} brand={brand} index={0} total={content.slides.length} />
                ) : <div className="aspect-video bg-muted" />}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-lg font-semibold leading-tight">{c.title}</h3>
                    <Badge variant={c.status === "approved" ? "default" : "secondary"} className="capitalize">{c.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{content.slides.length} slides · {content.quiz.length} quiz questions</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
