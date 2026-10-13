import { createFileRoute } from "@tanstack/react-router";
import { useCourseView } from "@/lib/useCourseView";
import { SlideView, useBrandFonts } from "@/components/SlideView";
import { DEFAULT_BRAND } from "@/lib/course";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/print/$courseId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Print handout — Refrain" },
      { name: "description", content: "Printable PDF handout of your course." },
      { property: "og:title", content: "Print handout — Refrain" },
      { property: "og:description", content: "Printable PDF handout." },
    ],
  }),
  component: Print,
});

function Print() {
  const { courseId } = Route.useParams();
  const { data, error } = useCourseView(courseId);
  useBrandFonts(data?.brand ?? DEFAULT_BRAND);
  if (error) return <p className="p-10">{error}</p>;
  if (!data) return <p className="p-10 text-muted-foreground">Loading…</p>;
  return (
    <div>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b bg-card px-6 py-3">
        <span>Choose "Save as PDF" in the print dialog.</span>
        <Button onClick={() => window.print()}>Print / Save PDF</Button>
      </div>
      {data.content.slides.map((s, i) => (
        <div key={s.id} className="print-slide">
          <SlideView slide={s} brand={data.brand} index={i} total={data.content.slides.length} />
        </div>
      ))}
    </div>
  );
}
