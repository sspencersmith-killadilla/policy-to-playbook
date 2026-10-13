import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_BRAND, type Brand } from "./course";

export type OrgMembership = { org_id: string; role: "owner" | "editor" | "viewer"; name: string };

type Ctx = {
  orgs: OrgMembership[];
  current: OrgMembership | null;
  brand: Brand;
  setCurrent: (id: string) => void;
  refresh: () => Promise<void>;
  loading: boolean;
};

const OrgContext = createContext<Ctx | null>(null);
const KEY = "relay.currentOrg";

export function OrgProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const qc = useQueryClient();
  const [currentId, setCurrentId] = useState<string | null>(null);
  useEffect(() => setCurrentId(localStorage.getItem(KEY)), []);

  const orgsQ = useQuery({
    queryKey: ["orgs", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_members")
        .select("org_id, role, organizations(name)")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((m: any) => ({ org_id: m.org_id, role: m.role, name: m.organizations?.name ?? "Org" })) as OrgMembership[];
    },
  });
  const orgs = orgsQ.data ?? [];
  const current = orgs.find((o) => o.org_id === currentId) ?? orgs[0] ?? null;

  const brandQ = useQuery({
    queryKey: ["brand", current?.org_id],
    enabled: !!current,
    queryFn: async () => {
      const { data } = await supabase.from("brand_kits").select("*").eq("org_id", current!.org_id).maybeSingle();
      return { ...DEFAULT_BRAND, ...(data ?? {}) } as Brand;
    },
  });

  const value = useMemo<Ctx>(
    () => ({
      orgs,
      current,
      brand: brandQ.data ?? DEFAULT_BRAND,
      loading: orgsQ.isLoading,
      setCurrent: (id) => {
        localStorage.setItem(KEY, id);
        setCurrentId(id);
      },
      refresh: async () => {
        await qc.invalidateQueries({ queryKey: ["orgs", userId] });
      },
    }),
    [orgs, current, brandQ.data, orgsQ.isLoading, qc, userId],
  );
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const c = useContext(OrgContext);
  if (!c) throw new Error("useOrg outside OrgProvider");
  return c;
}

export async function logAudit(orgId: string, action: string, target?: string, meta?: Record<string, unknown>) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("audit_events").insert({
    org_id: orgId, actor: data.user.id, actor_email: data.user.email ?? null, action, target: target ?? null, meta: (meta ?? null) as any,
  });
}
