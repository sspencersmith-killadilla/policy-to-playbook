import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth, safeNext } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Search = { mode?: "signin" | "signup"; next?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    mode: s.mode === "signup" ? "signup" : "signin",
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Coursewright" },
      { name: "description", content: "Sign in or create your Coursewright account." },
      { property: "og:title", content: "Sign in — Coursewright" },
      { property: "og:description", content: "Sign in or create your Coursewright account." },
    ],
  }),
  component: AuthPage,
});

const NEXT_KEY = "cw.next";

function AuthPage() {
  const { mode, next } = Route.useSearch();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  useEffect(() => {
    if (session) {
      const stored = sessionStorage.getItem(NEXT_KEY);
      sessionStorage.removeItem(NEXT_KEY);
      navigate({ to: safeNext(next ?? stored) });
    }
  }, [session, next, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: `${window.location.origin}${safeNext(next)}` },
        });
        if (error) throw error;
        if (!data.session) toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    sessionStorage.setItem(NEXT_KEY, safeNext(next));
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/auth` });
    if (r.error) toast.error(r.error.message ?? "Google sign-in failed");
  }

  async function forgot() {
    if (!email) { toast.error("Enter your email first."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="font-display text-2xl font-semibold">Coursewright</Link>
        <h1 className="mt-8 text-3xl font-semibold">{isSignup ? "Create your account" : "Welcome back"}</h1>
        <Button variant="outline" className="mt-6 w-full" onClick={google}>Continue with Google</Button>
        <div className="my-5 text-center text-xs uppercase tracking-widest text-muted-foreground">or</div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{isSignup ? "Create account" : "Sign in"}</Button>
        </form>
        <div className="mt-4 flex justify-between text-sm">
          <Link to="/auth" search={{ mode: isSignup ? "signin" : "signup", next }} className="text-primary underline-offset-4 hover:underline">
            {isSignup ? "Have an account? Sign in" : "New here? Create an account"}
          </Link>
          {!isSignup && <button onClick={forgot} className="text-muted-foreground hover:underline">Forgot password?</button>}
        </div>
      </div>
    </div>
  );
}
