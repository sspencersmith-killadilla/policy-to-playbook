import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Join your team — Relay" },
      { name: "description", content: "Accept your invitation to join an organization." },
      { property: "og:title", content: "Join your team — Relay" },
      { property: "og:description", content: "Accept your invitation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Invite,
});

function Invite() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signup", next: `/invite/${token}` } });
      return;
    }
    supabase.rpc("accept_invite", { _token: token }).then(({ data, error }) => {
      if (error) { setErr(error.message); return; }
      localStorage.setItem("relay.currentOrg", data as string);
      window.location.href = "/dashboard";
    });
  }, [loading, user, token, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      {err ? (
        <div>
          <h1 className="text-2xl font-semibold">We couldn't accept this invite</h1>
          <p className="mt-2 text-muted-foreground">{err}</p>
          <Button className="mt-6" onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/auth", search: { mode: "signin", next: `/invite/${token}` } }))}>Sign in with another account</Button>
        </div>
      ) : <p className="text-muted-foreground">Joining…</p>}
    </div>
  );
}
