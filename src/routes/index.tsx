import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileText, Palette, Film, Package, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import mark from "@/assets/refrain-mark.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Refrain — Turn any policy into branded training" },
      { name: "description", content: "Upload a code of conduct or SOP. Refrain drafts an editable, branded training course with a quiz, then exports slides, narrated video or SCORM." },
      { property: "og:title", content: "Refrain — Turn any policy into branded training" },
      { property: "og:description", content: "Policy in, training out. Slides, narrated video and SCORM exports for your LMS." },
    ],
  }),
  component: Index,
});

const features = [
  { icon: FileText, title: "Upload the policy", text: "PDF, Word or text. Every slide cites the section it came from." },
  { icon: Palette, title: "Make it yours", text: "Your logo, colors and fonts. Edit any slide or quiz question." },
  { icon: Film, title: "Narrate it", text: "AI voiceover from the speaker notes, recorded into a video." },
  { icon: Package, title: "Ship it anywhere", text: "PowerPoint, PDF, video, or a SCORM package for your LMS." },
  { icon: ShieldCheck, title: "Reviewed by people", text: "Nothing exports until someone on your team approves it." },
  { icon: ArrowRight, title: "Every change logged", text: "Version history and an activity log for audits." },
];

function Index() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2 font-display text-2xl font-bold text-primary">
          <img src={mark} alt="" width={32} height={32} /> Refrain
        </span>
        <Button asChild><Link to="/auth">Sign in</Link></Button>
      </header>
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-[1.3fr_1fr]">
          <div>
            <span className="inline-block rounded-full bg-secondary px-3 py-1 text-xs text-accent-foreground">Policy in · training out · for any organization</span>
            <h1 className="mt-6 text-5xl leading-[1.05] md:text-6xl">
              Your policy, told once. <span className="text-gradient-brand">Remembered by everyone.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Refrain turns a code of conduct or SOP into a branded training course with scenarios and a quiz. Review it, approve it, and send it out as slides, video or a SCORM package.
            </p>
            <div className="mt-8 flex gap-3">
              <Button size="lg" asChild><Link to="/auth" search={{ mode: "signup" }}>Build your first course <ArrowRight /></Link></Button>
            </div>
          </div>
          <img src={mark} alt="Refrain logo" width={256} height={256} className="mx-auto w-56 md:w-72" />
        </section>
        <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-6 shadow-sm">
              <f.icon className="size-6 text-highlight" />
              <h3 className="mt-4 text-lg">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">Refrain · a Civic Plexus app</footer>
    </div>
  );
}
