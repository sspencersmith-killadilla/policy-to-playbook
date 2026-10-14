import mark from "@/assets/relay-mark.png";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth, safeNext } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Search = { mode?: "signin" | "signup"; next?: string | undefined; confirmed?: boolean | undefined };

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    mode: s["mode"] === "signup" ? "signup" : "signin",
    next: typeof s["next"] === "string" ? (s["next"] as string) : undefined,
    confirmed: s["confirmed"] === 1 || s["confirmed"] === "1" || s["confirmed"] === true ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Relay" },
      { name: "description", content: "Sign in or create your Relay account." },
      { property: "og:title", content: "Sign in — Relay" },
      { property: "og:description", content: "Sign in or create your Relay account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const NEXT_KEY = "relay.next";
const RESEND_WAIT = 60;

/** Reads an error the confirmation link left in the URL (e.g. link expired or already used). */
function readLinkError(): string | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const q = new URLSearchParams(window.location.search);
  const code = params.get("error_code") ?? q.get("error_code");
  const desc = params.get("error_description") ?? q.get("error_description");
  if (!code && !desc && !params.get("error") && !q.get("error")) return null;
  if (code === "otp_expired" || /expired|invalid/i.test(desc ?? "")) {
    return "This confirmation link has expired or was already used. Some work email systems open links automatically, which can use them up. Your email may already be confirmed — try signing in below. If that doesn't work, send yourself a new link.";
  }
  return desc ? desc.replace(/\+/g, " ") : "That link didn't work. Try signing in, or send yourself a new link.";
}

function AuthPage() {
  const { mode, next, confirmed } = Route.useSearch();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const isSignup = mode === "signup";
  const redirectTo = () =>
    `${window.location.origin}/auth?confirmed=1&next=${encodeURIComponent(safeNext(next))}`;

  useEffect(() => {
    const err = readLinkError();
    if (err) {
      setLinkError(err);
      history.replaceState(null, "", window.location.pathname + window.location.search.replace(/[?&]error[^&]*/g, ""));
    }
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  useEffect(() => {
    if (!session) return;
    const stored = sessionStorage.getItem(NEXT_KEY);
    sessionStorage.removeItem(NEXT_KEY);
    const go = () => navigate({ to: safeNext(next ?? stored) });
    if (confirmed) {
      const t = setTimeout(go, 2500);
      return () => clearTimeout(t);
    }
    go();
    return undefined;
  }, [session, next, confirmed, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: redirectTo() },
        });
        if (error) throw error;
        if (!data.session) {
          if (data.user && (data.user.identities?.length ?? 0) === 0) {
            toast.error("An account with this email already exists. Sign in instead.");
            navigate({ to: "/auth", search: { mode: "signin", next } });
          } else {
            setPending(email);
            setWait(RESEND_WAIT);
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error && /not confirmed/i.test(error.message)) {
          setPending(email);
          await resend(email);
          return;
        }
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function resend(addr: string) {
    const { error } = await supabase.auth.resend({
      type: "signup", email: addr, options: { emailRedirectTo: redirectTo() },
    });
    if (error) toast.error(/rate|seconds/i.test(error.message) ? "Please wait a minute before asking for another link." : error.message);
    else toast.success(`New confirmation link sent to ${addr}.`);
    setWait(RESEND_WAIT);
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

  const logo = (
    <Link to="/" className="flex items-center gap-2 font-display text-2xl font-bold text-primary"><img src={mark} alt="" width={32} height={32} /> Relay</Link>
  );

  // Arrived from the confirmation email with a working link.
  if (confirmed && session) {
    return (
      <Shell>
        {logo}
        <div className="mt-8 rounded-xl border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto size-14 text-accent" />
          <h1 className="mt-4 text-3xl font-semibold">Email confirmed</h1>
          <p className="mt-2 text-muted-foreground">You're signed in as <strong className="text-foreground">{session.user.email}</strong>. Taking you in now…</p>
          <Button className="mt-6 w-full" onClick={() => navigate({ to: safeNext(next) })}>Continue</Button>
        </div>
      </Shell>
    );
  }

  // Just signed up: make the next step impossible to miss.
  if (pending) {
    return (
      <Shell>
        {logo}
        <div className="mt-8 rounded-xl border bg-card p-8">
          <Mail className="mx-auto size-14 text-primary" />
          <h1 className="mt-4 text-center text-3xl font-semibold">Check your inbox</h1>
          <p className="mt-3 text-center text-muted-foreground">
            We sent a confirmation email to<br /><strong className="text-foreground">{pending}</strong>
          </p>
          <ol className="mt-6 space-y-3 text-sm">
            <li className="flex gap-3"><Step n={1} /> Open the email from <strong>Relay</strong> (subject: "Confirm your email"). Check your spam or junk folder if it isn't there in a minute or two.</li>
            <li className="flex gap-3"><Step n={2} /> Click <strong>Confirm my email</strong>. Open it in this same browser if you can.</li>
            <li className="flex gap-3"><Step n={3} /> You'll see "Email confirmed" and be signed in{next?.startsWith("/invite/") ? " and added to your team" : ""}.</li>
          </ol>
          <p className="mt-6 text-center text-sm text-muted-foreground">You won't be able to sign in until you confirm.</p>
          <Button variant="outline" className="mt-4 w-full" disabled={wait > 0} onClick={() => resend(pending)}>
            {wait > 0 ? `Resend email in ${wait}s` : "Resend confirmation email"}
          </Button>
          <div className="mt-4 flex justify-between text-sm">
            <button type="button" className="text-muted-foreground hover:underline" onClick={() => setPending(null)}>Wrong email? Start over</button>
            <Link to="/auth" search={{ mode: "signin", next }} onClick={() => setPending(null)} className="text-primary underline-offset-4 hover:underline">Already confirmed? Sign in</Link>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {logo}
      <h1 className="mt-8 text-3xl font-semibold">{isSignup ? "Create your account" : "Welcome back"}</h1>
      {next?.startsWith("/invite/") && !linkError && (
        <p className="mt-2 text-sm text-muted-foreground">
          {isSignup ? "Create an account with the email address your invite was sent to. We'll email you a link to confirm it." : "Sign in to accept your team invite."}
        </p>
      )}
      {linkError && (
        <div role="alert" className="mt-4 flex gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p>{linkError}</p>
            {email && <button type="button" onClick={() => { setPending(email); resend(email); }} className="mt-2 text-primary underline-offset-4 hover:underline">Send a new link to {email}</button>}
            {!email && <p className="mt-2 text-muted-foreground">To get a new link, enter your email and password below and press Sign in.</p>}
          </div>
        </div>
      )}
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
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{n}</span>;
}
