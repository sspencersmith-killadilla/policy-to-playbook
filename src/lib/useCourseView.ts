import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_BRAND, normalizeContent, type Brand, type CourseContent } from "./course";

/** Loads a course plus its org brand for standalone (presenter/print) views. RLS limits access to members. */
export function useCourseView(courseId: string) {
  const [state, setState] = useState<{ title: string; content: CourseContent; brand: Brand } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) {
        window.location.href = `/auth?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      const { data, error } = await supabase.from("courses").select("title, content, org_id").eq("id", courseId).single();
      if (error || !data) return setError("Course not found or you don't have access.");
      const { data: b } = await supabase.from("brand_kits").select("*").eq("org_id", data.org_id).maybeSingle();
      setState({ title: data.title, content: normalizeContent(data.content), brand: { ...DEFAULT_BRAND, ...(b ?? {}) } as Brand });
    })();
  }, [courseId]);
  return { data: state, error };
}
