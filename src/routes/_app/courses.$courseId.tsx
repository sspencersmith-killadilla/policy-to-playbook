import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Copy, Trash2, Plus, Sparkles, Play, Download, CheckCircle2, Volume2, Loader2, History, Clapperboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, logAudit } from "@/lib/org";
import { canEdit, emptySlide, VOICE_CHOICES, voiceLabel, LAYOUTS, newId, normalizeContent, type CourseContent, type Slide, type QuizQuestion } from "@/lib/course";
import { useOrgVoices } from "@/lib/useOrgVoices";
import { customVoiceValue } from "@/lib/voices";
import { regenerateSlide, narrateText, startSceneClip, checkSceneClip, suggestClipPrompts } from "@/lib/ai.functions";
import { exportPptx, exportScorm, exportVideo, buildNarratedVideo, renderSlideImages } from "@/lib/exports";
import { ScaledSlide, SlideView, useBrandFonts } from "@/components/SlideView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ExplainerStudio } from "@/components/ExplainerStudio";

export const Route = createFileRoute("/_app/courses/$courseId")({
  head: () => ({
    meta: [
      { title: "Edit course — Relay" },
      { name: "description", content: "Edit, approve and export your training course." },
      { property: "og:title", content: "Edit course — Relay" },
      { property: "og:description", content: "Edit, approve and export your training course." },
    ],
  }),
  component: Editor,
});

function Editor() {
  const { courseId } = Route.useParams();
  const { current, brand } = useOrg();
  useBrandFonts(brand);
  const qc = useQueryClient();
  const editable = canEdit(current?.role);
  const q = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("id", courseId).single();
      if (error) throw error;
      return data;
    },
  });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState<CourseContent | null>(null);
  const [status, setStatus] = useState("draft");
  const [sel, setSel] = useState(0);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [explainerOpen, setExplainerOpen] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (q.data && !content) {
      setTitle(q.data.title);
      setContent(normalizeContent(q.data.content));
      setStatus(q.data.status);
    }
  }, [q.data, content]);

  // Autosave
  useEffect(() => {
    if (!dirty.current || !content || !editable) return;
    setSaving("saving");
    const t = setTimeout(async () => {
      const patch: Record<string, unknown> = { title, content, updated_at: new Date().toISOString() };
      if (status === "approved") {
        patch["status"] = "draft";
        patch["approved_by"] = null;
        patch["approved_at"] = null;
        patch["approved_by_email"] = null;
        setStatus("draft");
        toast.info("Edits moved this course back to draft. Approve again before exporting.");
      }
      const { error } = await supabase.from("courses").update(patch as any).eq("id", courseId);
      if (error) toast.error(error.message);
      dirty.current = false;
      setSaving("saved");
      qc.invalidateQueries({ queryKey: ["courses"] });
    }, 1200);
    return () => clearTimeout(t);
  }, [content, title]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isLoading || !content) return <p className="p-10 text-muted-foreground">Loading…</p>;
  if (q.error) return <p className="p-10 text-destructive">{(q.error as Error).message}</p>;

  const update = (fn: (c: CourseContent) => CourseContent) => {
    if (!editable) return;
    dirty.current = true;
    setContent((c) => (c ? fn(c) : c));
  };
  const slides = content.slides;
  const slide = slides[Math.min(sel, slides.length - 1)]!;
  const setSlide = (s: Slide) => update((c) => ({ ...c, slides: c.slides.map((x) => (x.id === s.id ? s : x)) }));
  const move = (i: number, d: number) =>
    update((c) => {
      const arr = [...c.slides];
      const j = i + d;
      if (j < 0 || j >= arr.length) return c;
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      setSel(j);
      return { ...c, slides: arr };
    });

  async function approve() {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("courses")
      .update({ status: "approved", approved_by: u.user!.id, approved_by_email: u.user!.email ?? null, approved_at: new Date().toISOString() })
      .eq("id", courseId);
    if (error) { toast.error(error.message); return; }
    await supabase.from("course_versions").insert({ course_id: courseId, org_id: current!.org_id, title, content: content as any, note: "Approved", created_by: u.user!.id });
    await logAudit(current!.org_id, "course.approved", courseId);
    setStatus("approved");
    qc.invalidateQueries({ queryKey: ["course", courseId] });
    qc.invalidateQueries({ queryKey: ["versions", courseId] });
    toast.success("Approved. Exports are unlocked.");
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b bg-card px-6 py-3">
        <Input value={title} disabled={!editable} onChange={(e) => { dirty.current = true; setTitle(e.target.value); }} className="font-display max-w-xl border-transparent text-xl font-semibold shadow-none focus-visible:border-input" />
        <Badge variant={status === "approved" ? "default" : "secondary"} className="capitalize">{status}</Badge>
        <span className="text-xs text-muted-foreground">{saving === "saving" ? "Saving…" : saving === "saved" ? "All changes saved" : ""}</span>
        <div className="ml-auto flex gap-2">
          {editable && status !== "approved" && <Button variant="outline" onClick={approve}><CheckCircle2 /> Approve</Button>}
          <Button variant="outline" asChild><Link to="/present/$courseId" params={{ courseId }}><Play /> Present</Link></Button>
          <Button variant="outline" onClick={() => setExplainerOpen(true)}><Clapperboard /> Explainer video</Button>
          <ExportMenu courseId={courseId} title={title} content={content} approved={status === "approved"} passScore={q.data!.pass_score} />
          <ExplainerStudio open={explainerOpen} onOpenChange={setExplainerOpen} courseId={courseId} title={title} content={content}
            approved={status === "approved"} editable={editable} passScore={q.data!.pass_score}
            onSaved={(explainer) => setContent((c) => (c ? { ...c, explainer } : c))} />
        </div>
      </header>
      {status === "approved" && q.data?.approved_by_email && (
        <div className="border-b bg-accent px-6 py-1.5 text-xs text-accent-foreground">AI-generated, reviewed and approved by {q.data.approved_by_email} on {new Date(q.data.approved_at!).toLocaleDateString()}</div>
      )}
      <Tabs defaultValue="slides" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-6 mt-3 w-fit">
          <TabsTrigger value="slides">Slides ({slides.length})</TabsTrigger>
          <TabsTrigger value="quiz">Quiz ({content.quiz.length})</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
        </TabsList>
        <TabsContent value="slides" className="flex min-h-0 flex-1">
          <div className="w-56 shrink-0 space-y-3 overflow-y-auto border-r p-3">
            {slides.map((s, i) => (
              <button key={s.id} onClick={() => setSel(i)} className={`block w-full rounded border-2 text-left ${i === sel ? "border-highlight" : "border-transparent"}`}>
                <ScaledSlide slide={s} brand={brand} index={i} total={slides.length} />
                <span className="block truncate px-1 py-0.5 text-xs text-muted-foreground">{i + 1}. {s.title}</span>
              </button>
            ))}
            {editable && <BulkClipPrompts courseId={courseId} slides={slides} onDone={(m) => update((c) => ({ ...c, slides: c.slides.map((x) => (m[x.id] ? { ...x, clip_prompt: m[x.id] ?? null } : x)) }))} />}
            {editable && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => { update((c) => ({ ...c, slides: [...c.slides.slice(0, sel + 1), emptySlide(), ...c.slides.slice(sel + 1)] })); setSel(sel + 1); }}>
                <Plus /> Add slide
              </Button>
            )}
          </div>
          {slide ? (
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 xl:grid-cols-[1fr_380px]">
              <div>
                <ScaledSlide slide={slide} brand={brand} index={sel} total={slides.length} className="aspect-video w-full rounded-md border shadow-sm" />
                {editable && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => move(sel, -1)}><ArrowUp /> Up</Button>
                    <Button size="sm" variant="ghost" onClick={() => move(sel, 1)}><ArrowDown /> Down</Button>
                    <Button size="sm" variant="ghost" onClick={() => { update((c) => ({ ...c, slides: [...c.slides.slice(0, sel + 1), { ...slide, id: newId() }, ...c.slides.slice(sel + 1)] })); setSel(sel + 1); }}><Copy /> Duplicate</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" disabled={slides.length <= 1} onClick={() => { update((c) => ({ ...c, slides: c.slides.filter((x) => x.id !== slide.id) })); setSel(Math.max(0, sel - 1)); }}><Trash2 /> Delete</Button>
                  </div>
                )}
              </div>
              <SlideForm key={slide.id} slide={slide} onChange={setSlide} disabled={!editable} courseId={courseId} />
            </div>
          ) : <p className="p-6">No slides.</p>}
        </TabsContent>
        <TabsContent value="quiz" className="min-h-0 flex-1 overflow-y-auto">
          <QuizEditor quiz={content.quiz} disabled={!editable} onChange={(quiz) => update((c) => ({ ...c, quiz }))} />
        </TabsContent>
        <TabsContent value="versions" className="min-h-0 flex-1 overflow-y-auto">
          <Versions courseId={courseId} disabled={!editable} onRestore={(t, c) => { dirty.current = true; setTitle(t); setContent(normalizeContent(c)); setSel(0); }} currentTitle={title} currentContent={content} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SlideForm({ slide, onChange, disabled, courseId }: { slide: Slide; onChange: (s: Slide) => void; disabled: boolean; courseId: string }) {
  const regen = useServerFn(regenerateSlide);
  const narrate = useServerFn(narrateText);
  const { current, brand } = useOrg();
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const set = (p: Partial<Slide>) => onChange({ ...slide, ...p });

  async function rewrite() {
    setBusy(true);
    try {
      onChange(await regen({ data: { courseId, slide, instruction } }));
      setInstruction("");
      toast.success("Slide rewritten");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function preview() {
    setPlaying(true);
    try {
      const { wavBase64 } = await narrate({ data: { orgId: current!.org_id, text: slide.notes, voice: slide.voice || brand.voice } });
      const a = new Audio(`data:audio/wav;base64,${wavBase64}`);
      a.onended = () => setPlaying(false);
      await a.play();
    } catch (e: any) {
      toast.error(e.message);
      setPlaying(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Layout</Label>
        <Select value={slide.layout} disabled={disabled} onValueChange={(v) => set({ layout: v as Slide["layout"] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{LAYOUTS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Field label="Title"><Input disabled={disabled} value={slide.title} onChange={(e) => set({ title: e.target.value })} /></Field>
      <Field label="Subtitle"><Input disabled={disabled} value={slide.subtitle ?? ""} onChange={(e) => set({ subtitle: e.target.value || null })} /></Field>
      <Field label="Bullets (one per line)"><Textarea disabled={disabled} rows={4} value={slide.bullets.join("\n")} onChange={(e) => set({ bullets: e.target.value.split("\n") })} onBlur={() => set({ bullets: slide.bullets.filter((b) => b.trim()) })} /></Field>
      <Field label="Body text"><Textarea disabled={disabled} rows={3} value={slide.body ?? ""} onChange={(e) => set({ body: e.target.value || null })} /></Field>
      <Field label="Narration script">
        <Textarea disabled={disabled} rows={5} value={slide.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
      <VoiceoverBox slide={slide} disabled={disabled} playing={playing} onPreviewAI={preview} onChange={(p) => set(p)} />
      <Field label="Policy source"><Input disabled={disabled} value={slide.source} onChange={(e) => set({ source: e.target.value })} /></Field>
      <SceneClip slide={slide} courseId={courseId} disabled={disabled} onChange={(p) => set(p)} />
      {!disabled && (
        <div className="rounded-md border bg-card p-3">
          <Label>Rewrite with AI</Label>
          <Input className="mt-1.5" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="e.g. Shorter, friendlier, add an example" />
          <Button size="sm" className="mt-2" onClick={rewrite} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Rewrite slide</Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function QuizEditor({ quiz, onChange, disabled }: { quiz: QuizQuestion[]; onChange: (q: QuizQuestion[]) => void; disabled: boolean }) {
  const set = (i: number, p: Partial<QuizQuestion>) => onChange(quiz.map((q, j) => (j === i ? { ...q, ...p } : q)));
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {quiz.map((q, i) => (
        <div key={q.id} className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="font-display text-sm text-highlight">Question {i + 1}</span>
            {!disabled && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onChange(quiz.filter((_, j) => j !== i))}><Trash2 /></Button>}
          </div>
          <Textarea disabled={disabled} className="mt-2" value={q.question} onChange={(e) => set(i, { question: e.target.value })} />
          <div className="mt-3 space-y-2">
            {q.options.map((o, j) => (
              <div key={j} className="flex items-center gap-2">
                <input type="radio" disabled={disabled} checked={q.correct_index === j} onChange={() => set(i, { correct_index: j })} aria-label="Correct answer" className="accent-[var(--highlight)]" />
                <Input disabled={disabled} value={o} onChange={(e) => set(i, { options: q.options.map((x, k) => (k === j ? e.target.value : x)) })} />
              </div>
            ))}
          </div>
          <Label className="mt-3 block">Explanation</Label>
          <Input disabled={disabled} className="mt-1" value={q.explanation} onChange={(e) => set(i, { explanation: e.target.value })} />
          <p className="mt-2 text-xs text-muted-foreground">Source: {q.source}</p>
        </div>
      ))}
      {!disabled && (
        <Button variant="outline" onClick={() => onChange([...quiz, { id: newId(), question: "New question", options: ["", "", "", ""], correct_index: 0, explanation: "", source: "" }])}>
          <Plus /> Add question
        </Button>
      )}
    </div>
  );
}

function Versions({ courseId, onRestore, disabled, currentTitle, currentContent }: { courseId: string; onRestore: (t: string, c: unknown) => void; disabled: boolean; currentTitle: string; currentContent: CourseContent }) {
  const { current } = useOrg();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["versions", courseId],
    queryFn: async () => (await supabase.from("course_versions").select("id, title, note, created_at, content").eq("course_id", courseId).order("created_at", { ascending: false })).data ?? [],
  });
  async function snapshot() {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("course_versions").insert({ course_id: courseId, org_id: current!.org_id, title: currentTitle, content: currentContent as any, note: "Manual save", created_by: u.user!.id });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["versions", courseId] });
    toast.success("Version saved");
  }
  return (
    <div className="mx-auto max-w-2xl p-6">
      {!disabled && <Button variant="outline" onClick={snapshot}><History /> Save a version now</Button>}
      <ul className="mt-4 divide-y rounded-lg border bg-card">
        {q.data?.map((v) => (
          <li key={v.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{v.note ?? "Version"} — {v.title}</p>
              <p className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</p>
            </div>
            {!disabled && <Button size="sm" variant="ghost" onClick={() => { onRestore(v.title, v.content); toast.success("Version restored"); }}>Restore</Button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExportMenu({ courseId, title, content, approved, passScore }: { courseId: string; title: string; content: CourseContent; approved: boolean; passScore: number }) {
  const { brand, current } = useOrg();
  const narrate = useServerFn(narrateText);
  const hiddenRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [job, setJob] = useState<{ msg: string; pct: number } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const nodes = async () => {
    setMounted(true);
    await new Promise((r) => setTimeout(r, 400));
    await document.fonts.ready;
    return Array.from(hiddenRef.current!.querySelectorAll<HTMLElement>(".slide-content"));
  };

  const [scormOpen, setScormOpen] = useState(false);
  const [scormMode, setScormMode] = useState<"slides" | "video">("video");
  const [requireView, setRequireView] = useState(true);
  const [hd, setHd] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const estMin = Math.max(1, Math.round(content.slides.reduce((a, s) => a + (s.notes.split(/\s+/).filter(Boolean).length / 2.5 + 0.8), 0) / 60 + content.slides.filter((s) => s.clip_path).length * 0.1));
  async function run(kind: "pptx" | "scorm" | "video" | "pdf", scorm?: { mode: "slides" | "video"; requireFullView: boolean }) {
    if (!approved) { toast.error("Approve the course before exporting."); return; }
    if (kind === "pdf") { window.open(`/print/${courseId}`, "_blank"); return; }
    abort.current = new AbortController();
    try {
      if (kind === "pptx") {
        setJob({ msg: "Building PowerPoint…", pct: 50 });
        await exportPptx(title, content, brand);
      } else {
        setJob({ msg: "Rendering slides…", pct: 5 });
        const asVideo = kind === "video" || scorm?.mode === "video";
        const W = asVideo && hd ? 1920 : 1280;
        const imgs = await renderSlideImages(await nodes(), asVideo ? W : 1600);
        const t0 = Date.now();
        const eta = (pct: number) => {
          if (pct < 42) return "";
          const left = ((Date.now() - t0) / pct) * (100 - pct) / 1000;
          return left > 5 ? ` About ${left > 90 ? `${Math.round(left / 60)} min` : `${Math.round(left)} sec`} left.` : "";
        };
        const videoOpts = asVideo ? {
            slides: content.slides, images: imgs, signal: abort.current.signal,
            clips: await Promise.all(content.slides.map(async (s) => s.clip_path ? (await supabase.storage.from("documents").createSignedUrl(s.clip_path, 3600)).data?.signedUrl ?? null : null)),
            narrate: async (text: string, slide: Slide) => slide.voice_path ? await recordingBase64(slide.voice_path) : (await narrate({ data: { orgId: current!.org_id, text, voice: slide.voice || brand.voice } })).wavBase64,
            onProgress: (msg: string, pct: number) => setJob({ msg: msg + eta(pct), pct: pct * (kind === "scorm" ? 0.95 : 1) }),
            width: W, height: W === 1920 ? 1080 : 720,
            onFallback: () => toast.info("This browser can't use fast video building, so the video will record in real time. Keep this tab open and in front."),
          } : null;
        if (kind === "scorm" && scorm?.mode === "video") {
          const rec = await buildNarratedVideo(videoOpts!);
          setJob({ msg: "Packaging SCORM file…", pct: 97 });
          await exportScorm(title, content, brand, imgs, passScore, { rec, requireFullView: scorm.requireFullView });
        } else if (kind === "scorm") await exportScorm(title, content, brand, imgs, passScore);
        else await exportVideo({ ...videoOpts!, title });
      }
      await logAudit(current!.org_id, `course.exported.${kind}`, courseId);
      toast.success("Export downloaded");
      if (document.hidden) { const old = document.title; document.title = "✓ Export ready — Relay"; const back = () => { document.title = old; document.removeEventListener("visibilitychange", back); }; document.addEventListener("visibilitychange", back); }
    } catch (e: any) {
      if (e.message !== "Cancelled") toast.error(e.message ?? "Export failed");
    } finally {
      setJob(null);
      setMounted(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button><Download /> Export</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {!approved && <><DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Approve the course to unlock exports</DropdownMenuLabel><DropdownMenuSeparator /></>}
          <DropdownMenuItem disabled={!approved} onClick={() => run("pdf")}>PDF handout</DropdownMenuItem>
          <DropdownMenuItem disabled={!approved} onClick={() => run("pptx")}>PowerPoint (.pptx)</DropdownMenuItem>
          <DropdownMenuItem disabled={!approved} onClick={() => setVideoOpen(true)}>Narrated video (MP4)…</DropdownMenuItem>
          <DropdownMenuItem disabled={!approved} onClick={() => setScormOpen(true)}>SCORM 1.2 package (LMS)…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={scormOpen} onOpenChange={setScormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>SCORM package for your LMS</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {([["video", "Narrated video", `Learners watch the narrated video (with scene clips and captions), then take the quiz. About ${estMin} min of video; package roughly ${estMin * (hd ? 4 : 2)}–${estMin * (hd ? 7 : 4)} MB.`], ["slides", "Slides", "Learners click through slide images with the narration text, then take the quiz. Quick to build, small file."]] as const).map(([v, l, d]) => (
              <label key={v} className={`flex cursor-pointer gap-3 rounded-md border p-3 ${scormMode === v ? "border-primary bg-accent/10" : ""}`}>
                <input type="radio" name="scorm-mode" checked={scormMode === v} onChange={() => setScormMode(v)} className="mt-1" />
                <span><span className="font-medium">{l}</span><span className="block text-sm text-muted-foreground">{d}</span></span>
              </label>
            ))}
            {scormMode === "video" && (
              <label className="flex items-center gap-2 pt-1 text-sm">
                <input type="checkbox" checked={requireView} onChange={(e) => setRequireView(e.target.checked)} />
                Require watching the whole video before the quiz (no skipping ahead)
              </label>
            )}
            {scormMode === "video" && <label className="flex items-center gap-2 pt-1 text-sm"><input type="checkbox" checked={hd} onChange={(e) => setHd(e.target.checked)} /> Full HD (1080p). Sharper, about twice the file size.</label>}
            {scormMode === "video" && <p className="text-xs text-muted-foreground">The video builds faster than real time. You can switch tabs, but don't close this one until it finishes.</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setScormOpen(false)}>Cancel</Button>
            <Button onClick={() => { setScormOpen(false); run("scorm", { mode: scormMode, requireFullView: requireView }); }}><Download /> Build package</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Narrated video</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">An MP4 with voiceover for every slide and any scene clips. About {estMin} min long. It builds faster than real time; you can switch tabs, but keep this one open.</p>
          <label className="flex items-center gap-2 pt-1 text-sm"><input type="checkbox" checked={hd} onChange={(e) => setHd(e.target.checked)} /> Full HD (1080p). Sharper, about twice the file size.</label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setVideoOpen(false)}>Cancel</Button>
            <Button onClick={() => { setVideoOpen(false); run("video"); }}><Download /> Build video</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!job} onOpenChange={(o) => { if (!o) abort.current?.abort(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Exporting</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{job?.msg}</p>
          <Progress value={job?.pct ?? 0} />
          <p className="text-xs text-muted-foreground">You can switch tabs, but keep this one open. Close this window to cancel.</p>
        </DialogContent>
      </Dialog>
      {mounted && (
        <div ref={hiddenRef} aria-hidden style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
          {content.slides.map((s, i) => <SlideView key={s.id} slide={s} brand={brand} index={i} total={content.slides.length} />)}
        </div>
      )}
    </>
  );
}

async function recordingBase64(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("documents").download(path);
  if (error || !data) throw new Error("Could not load the recorded voiceover.");
  const bytes = new Uint8Array(await data.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function VoiceoverBox({ slide, disabled, playing, onPreviewAI, onChange }: { slide: Slide; disabled: boolean; playing: boolean; onPreviewAI: () => void; onChange: (p: Partial<Slide>) => void }) {
  const team = useOrgVoices();
  const { current } = useOrg();
  const [mode, setMode] = useState<"ai" | "own">(slide.voice_path ? "own" : "ai");
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { setMode(slide.voice_path ? "own" : "ai"); }, [slide.id]);
  useEffect(() => {
    setUrl(null);
    if (!slide.voice_path) return;
    supabase.storage.from("documents").createSignedUrl(slide.voice_path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [slide.voice_path]);
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setSecs((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [rec]);

  async function save(blob: Blob) {
    setUploading(true);
    try {
      const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
      const path = `${current!.org_id}/recordings/${slide.id}-${newId()}.${ext}`;
      const up = await supabase.storage.from("documents").upload(path, blob, { contentType: blob.type || "audio/webm" });
      if (up.error) throw new Error(up.error.message);
      onChange({ voice_path: path });
      toast.success("Recording saved");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }
  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => { stream.getTracks().forEach((t) => t.stop()); setRec(null); save(new Blob(chunks, { type: r.mimeType })); };
      r.start();
      setSecs(0);
      setRec(r);
    } catch {
      toast.error("Couldn't use your microphone. Allow microphone access in your browser and try again.");
    }
  }
  async function upload(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("audio/")) { toast.error("Choose an audio file."); return; }
    if (f.size > 15 * 1024 * 1024) { toast.error("Audio files must be under 15 MB."); return; }
    await save(f);
  }

  return (
    <div className="rounded-md border bg-card p-3 space-y-2">
      <Label>Voiceover</Label>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5"><input type="radio" checked={mode === "ai"} disabled={disabled} onChange={() => { setMode("ai"); if (slide.voice_path) onChange({ voice_path: null }); }} /> AI voice</label>
        <label className="flex items-center gap-1.5"><input type="radio" checked={mode === "own"} disabled={disabled} onChange={() => setMode("own")} /> My own recording</label>
      </div>
      {mode === "ai" ? (
        <div className="flex flex-wrap items-center gap-2">
        <select aria-label="AI voice" className="h-8 rounded-md border bg-background px-2 text-sm" value={slide.voice ?? ""} disabled={disabled} onChange={(e) => onChange({ voice: e.target.value || null })}>
          <option value="">Brand kit voice</option>
          {team.voices.length > 0 && <optgroup label="Your team's voices">{team.voices.map((v) => <option key={v.id} value={customVoiceValue(v.id)}>{v.name}</option>)}</optgroup>}
          <optgroup label="AI voices">{VOICE_CHOICES.map((v) => <option key={v} value={v}>{voiceLabel(v)}</option>)}</optgroup>
        </select>
        <Button size="sm" variant="ghost" onClick={onPreviewAI} disabled={playing || !slide.notes.trim()}>
          {playing ? <Loader2 className="animate-spin" /> : <Volume2 />} Hear AI voiceover
        </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {!disabled && <p className="text-xs text-muted-foreground">Read the narration script above aloud. Your recording is used in the video and SCORM exports instead of the AI voice.</p>}
          {url && <audio controls src={url} className="w-full h-9" />}
          {!disabled && (
            <div className="flex flex-wrap items-center gap-2">
              {rec ? (
                <Button size="sm" variant="destructive" onClick={() => rec.stop()}>Stop recording ({Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")})</Button>
              ) : (
                <Button size="sm" onClick={start} disabled={uploading}>{uploading ? <Loader2 className="animate-spin" /> : <Volume2 />} {slide.voice_path ? "Re-record" : "Record"}</Button>
              )}
              <label className="text-sm underline cursor-pointer text-muted-foreground">
                or upload audio
                <input type="file" accept="audio/*" className="hidden" disabled={!!rec || uploading} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              {slide.voice_path && !rec && <Button size="sm" variant="ghost" onClick={() => onChange({ voice_path: null })}>Remove</Button>}
            </div>
          )}
          {!slide.voice_path && !rec && <p className="text-xs text-muted-foreground">No recording yet, so the AI voice is used for now.</p>}
        </div>
      )}
    </div>
  );
}

function SceneClip({ slide, courseId, disabled, onChange }: { slide: Slide; courseId: string; disabled: boolean; onChange: (p: Partial<Slide>) => void }) {
  const start = useServerFn(startSceneClip);
  const check = useServerFn(checkSceneClip);
  const suggest = useServerFn(suggestClipPrompts);
  const [writing, setWriting] = useState(false);
  useEffect(() => { if (slide.clip_prompt) setPrompt(slide.clip_prompt); }, [slide.clip_prompt]);
  async function writeFromNarration() {
    setWriting(true);
    try {
      const [r] = await suggest({ data: { courseId, slides: [slide] } });
      if (!r) throw new Error("No prompt came back. Try again.");
      setPrompt(r.prompt);
      onChange({ clip_prompt: r.prompt });
      toast.success("Prompt written. Review it, then generate the clip.");
    } catch (e: any) { toast.error(e.message); } finally { setWriting(false); }
  }
  const [prompt, setPrompt] = useState(slide.clip_prompt ?? (slide.layout === "scenario" ? slide.body ?? "" : ""));
  const [busy, setBusy] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    if (!slide.clip_path) return;
    supabase.storage.from("documents").createSignedUrl(slide.clip_path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [slide.clip_path]);

  async function generate() {
    if (!confirm("Scene clips cost noticeably more AI credits than text. Generate a 6-second clip?")) return;
    setBusy("Starting…");
    try {
      const { jobId } = await start({ data: { courseId, prompt } });
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 7000));
        const r = await check({ data: { courseId, jobId } });
        if (r.status === "failed") throw new Error(r.error ?? "Clip failed");
        if (r.status === "completed") {
          onChange({ clip_path: r.path, clip_prompt: prompt });
          toast.success("Scene clip added. It plays before this slide in the narrated video.");
          return;
        }
        setBusy(`Generating clip… ${Math.round(r.progress ?? 0)}%`);
      }
      throw new Error("The clip is taking too long. Try again later.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  if (disabled && !slide.clip_path) return null;
  return (
    <div className="rounded-md border bg-card p-3">
      <Label>AI scene clip (video only)</Label>
      <p className="mt-1 text-xs text-muted-foreground">A short generated scene that plays right before this slide in the narrated video.</p>
      {url && <video src={url} controls className="mt-2 w-full rounded" />}
      {!disabled && (
        <>
          <Button size="sm" variant="outline" className="mt-2" onClick={writeFromNarration} disabled={writing || !!busy || !(slide.notes.trim() || slide.body?.trim())}>
            {writing ? <Loader2 className="animate-spin" /> : <Sparkles />} Write prompt from narration
          </Button>
          <Textarea className="mt-2" rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. A warehouse worker notices a spill near a forklift lane and places a caution sign" />
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={generate} disabled={!!busy || prompt.trim().length < 10}>
              {busy ? <><Loader2 className="animate-spin" /> {busy}</> : <><Sparkles /> {slide.clip_path ? "Replace clip" : "Generate clip"}</>}
            </Button>
            {slide.clip_path && !busy && <Button size="sm" variant="ghost" onClick={() => onChange({ clip_path: null })}>Remove</Button>}
          </div>
        </>
      )}
    </div>
  );
}

function BulkClipPrompts({ courseId, slides, onDone }: { courseId: string; slides: Slide[]; onDone: (m: Record<string, string>) => void }) {
  const suggest = useServerFn(suggestClipPrompts);
  const [busy, setBusy] = useState(false);
  const targets = slides.filter((s) => s.layout === "scenario" && !s.clip_prompt?.trim() && !s.clip_path);
  if (!targets.length) return null;
  async function run() {
    setBusy(true);
    try {
      const r = await suggest({ data: { courseId, slides: targets } });
      onDone(Object.fromEntries(r.map((p) => [p.id, p.prompt])));
      toast.success(`Wrote ${r.length} clip prompt${r.length === 1 ? "" : "s"}. Review each scenario slide, then generate.`);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  return (
    <Button variant="outline" size="sm" className="h-auto w-full whitespace-normal py-1.5" onClick={run} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Write prompts for all scenario slides ({targets.length})
    </Button>
  );
}
