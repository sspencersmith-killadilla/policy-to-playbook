import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutGrid, Plus, Palette, Users, History, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { OrgProvider, useOrg } from "@/lib/org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin", next: loc.href } });
  }, [loading, user, navigate, loc.href]);
  if (!user) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  return (
    <OrgProvider userId={user.id}>
      <Shell email={user.email ?? ""} />
    </OrgProvider>
  );
}

const nav = [
  { to: "/dashboard", label: "Courses", icon: LayoutGrid },
  { to: "/new", label: "New course", icon: Plus },
  { to: "/brand", label: "Brand kit", icon: Palette },
  { to: "/team", label: "Team", icon: Users },
  { to: "/activity", label: "Activity", icon: History },
] as const;

function Shell({ email }: { email: string }) {
  const { orgs, current, setCurrent, loading } = useOrg();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!current) return <CreateOrg />;
  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 flex h-screen w-60 flex-col border-r bg-sidebar p-4">
        <Link to="/dashboard" className="font-display px-2 text-xl font-semibold">Coursewright</Link>
        <div className="mt-6">
          <Select value={current.org_id} onValueChange={(v) => (v === "__new" ? (window.location.href = "/dashboard?newOrg=1") : setCurrent(v))}>
            <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              {orgs.map((o) => <SelectItem key={o.org_id} value={o.org_id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="mt-1 px-1 text-xs capitalize text-muted-foreground">Your role: {current.role}</p>
        </div>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent" activeProps={{ className: "bg-sidebar-accent font-medium" }}>
              <n.icon className="size-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t pt-3 text-xs text-muted-foreground">
          <p className="truncate px-1">{email}</p>
          <Button variant="ghost" size="sm" className="mt-1 w-full justify-start" onClick={() => supabase.auth.signOut()}>
            <LogOut /> Sign out
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export function CreateOrg({ onDone }: { onDone?: () => void }) {
  const { refresh, setCurrent } = useOrg();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("create_organization", { _name: name });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setCurrent(data as string);
    await refresh();
    onDone?.();
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={create} className="w-full max-w-md space-y-4">
        <h1 className="text-3xl font-semibold">Name your organization</h1>
        <p className="text-muted-foreground">Courses, brand kit and team live inside an organization. You can invite colleagues next.</p>
        <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Health" />
        <Button type="submit" className="w-full" disabled={busy}>Create organization</Button>
      </form>
    </div>
  );
}
