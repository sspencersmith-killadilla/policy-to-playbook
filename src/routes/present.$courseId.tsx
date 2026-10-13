import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize, X } from "lucide-react";
import { useCourseView } from "@/lib/useCourseView";
import { ScaledSlide, useBrandFonts } from "@/components/SlideView";
import { DEFAULT_BRAND } from "@/lib/course";

export const Route = createFileRoute("/present/$courseId")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { slide?: number } => ({ slide: Math.max(1, Number(s["slide"]) || 1) }),
  head: () => ({
    meta: [
      { title: "Present — Refrain" },
      { name: "description", content: "Present your training course full screen." },
      { property: "og:title", content: "Present — Refrain" },
      { property: "og:description", content: "Present your training course." },
    ],
  }),
  component: Present,
});

function Present() {
  const { courseId } = Route.useParams();
  const n = Route.useSearch().slide ?? 1;
  const navigate = Route.useNavigate();
  const { data, error } = useCourseView(courseId);
  useBrandFonts(data?.brand ?? DEFAULT_BRAND);
  const total = data?.content.slides.length ?? 0;
  const i = Math.min(n - 1, Math.max(0, total - 1));
  const go = (d: number) => navigate({ search: { slide: Math.min(total, Math.max(1, i + 1 + d)) }, replace: true });
  const touch = useRef<number | null>(null);
  const [notes, setNotes] = useState(false);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (["ArrowRight", " ", "PageDown"].includes(e.key)) go(1);
      if (["ArrowLeft", "PageUp"].includes(e.key)) go(-1);
      if (e.key === "n") setNotes((x) => !x);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  useEffect(() => {
    if (data) document.title = `${i + 1}/${total} — ${data.content.slides[i]?.title ?? data.title}`;
  }, [data, i, total]);

  if (error) return <p className="p-10">{error}</p>;
  if (!data) return <p className="p-10 text-muted-foreground">Loading…</p>;
  const s = data.content.slides[i];
  return (
    <div
      className="flex h-screen flex-col bg-ink"
      onTouchStart={(e) => (touch.current = e.touches[0]!.clientX)}
      onTouchEnd={(e) => { if (touch.current == null) return; const dx = e.changedTouches[0]!.clientX - touch.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); touch.current = null; }}
    >
      <div className="relative min-h-0 flex-1">
        {s && <ScaledSlide slide={s} brand={data.brand} index={i} total={total} className="absolute inset-0" />}
      </div>
      {notes && s && <div className="max-h-40 overflow-y-auto bg-card p-4 text-sm">{s.notes}</div>}
      <div className="flex items-center justify-center gap-4 bg-ink py-2 text-paper">
        <Link to="/courses/$courseId" params={{ courseId }} aria-label="Exit" className="p-2"><X className="size-5" /></Link>
        <button onClick={() => go(-1)} aria-label="Previous" className="p-2"><ChevronLeft /></button>
        <span className="text-sm">{i + 1} / {total}</span>
        <button onClick={() => go(1)} aria-label="Next" className="p-2"><ChevronRight /></button>
        <button onClick={() => setNotes((x) => !x)} className="text-sm underline-offset-4 hover:underline">Notes</button>
        <button onClick={() => document.documentElement.requestFullscreen?.()} aria-label="Full screen" className="p-2"><Maximize className="size-5" /></button>
      </div>
    </div>
  );
}
