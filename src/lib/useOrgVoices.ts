import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/org";
import { voiceLabel } from "@/lib/course";
import { customVoiceId, isCustomVoice, type OrgVoice } from "@/lib/voices";

export function useOrgVoices() {
  const { current } = useOrg();
  const q = useQuery({
    queryKey: ["org_voices", current?.org_id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase.from("org_voices").select("id,name,created_by,created_by_email,created_at").eq("org_id", current!.org_id).order("created_at");
      if (error) throw error;
      return (data ?? []) as OrgVoice[];
    },
  });
  const voices = q.data ?? [];
  const label = (v: string) => isCustomVoice(v) ? `${voices.find((o) => o.id === customVoiceId(v))?.name ?? "Deleted voice"} (team voice)` : voiceLabel(v);
  return { voices, label, refetch: q.refetch };
}
