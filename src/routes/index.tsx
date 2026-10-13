import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileText, Palette, Film, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Coursewright — Turn any policy into branded training" },
      { name: "description", content: "Upload a code of conduct or SOP. Get an editable, branded training course with quiz, then export slides, narrated video or SCORM." },
      { property: "og:title", content: "Coursewright — Turn any policy into branded training" },
      { property: "og:description", content: "Policy in, training out. Slides, narrated video and SCORM exports for your LMS." },
    ],
  }),
  component: Index,
});

const steps = [
  { icon: FileText, title: "Upload the policy", text: "PDF, Word or text. Every slide cites the section it came from." },
  { icon: Palette, title: "Make it yours", text: "Your logo, colors and fonts. Edit any slide or quiz question." },
  { icon: Film, title: "Narrate it", text: "AI voiceover from the speaker notes, recorded into a video." },
  { icon: Package, title: "Ship it", text: "PowerPoint, PDF, video or a SCORM package for your LMS." },
];

function Index() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-2xl font-semibold">Coursewright</span>
        <div className="flex gap-2">
          <Button variant="ghost" asChild><Link to="/auth">Sign in</Link></Button>
          <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Get started</Link></Button>
        </div>
      </header>
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-highlight">Policy in. Training out.</p>
            <h1 className="mt-4 text-5xl font-semibold leading-[1.05] md:text-6xl">Your code of conduct, as a course people actually finish.</h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Upload a policy or SOP. Coursewright drafts a branded training module with scenarios and a quiz, you review and approve it, then export it anywhere.
            </p>
            <div className="mt-8 flex gap-3">
              <Button size="lg" asChild><Link to="/auth" search={{ mode: "signup" }}>Build your first course <ArrowRight /></Link></Button>
            </div>
          </div>
          <img src={hero} alt="A policy document turning into presentation slides" className="w-full rounded-lg border shadow-xl" width={1408} height={1056} />
        </section>
        <section className="border-y bg-card">
          <div className="mx-auto grid max-w-6xl gap-px px-6 py-14 md:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.title} className="p-4">
                <span className="font-display text-sm text-highlight">0{i + 1}</span>
                <s.icon className="mt-3 size-6 text-primary" />
                <h3 className="mt-3 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold">Built for review, not blind trust.</h2>
          <p className="mt-4 text-muted-foreground">
            AI only uses what's in your document, cites its sources, and nothing exports until someone on your team approves it. Every change is logged.
          </p>
        </section>
      </main>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">© {new Date().getFullYear()} Coursewright</footer>
    </div>
  );
}
