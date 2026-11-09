import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Clapperboard, Film, Download, ImageIcon, Loader2, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, logAudit } from "@/lib/org";
import {
  EXPLAINER_KINDS, MAX_ILLUSTRATIONS_PER_VIDEO, MONTHLY_CLIP_LIMIT, newId, sceneUsesPicture, type ExplainerStyle,
   type Brand, type CourseContent, type Explainer, type ExplainerKind, type ExplainerScene, type ExplainerTone,
} from "@/lib/course";
import { checkSceneClip, makeIllustration, narrateText, startSceneClip, suggestClipPrompts, writeExplainerScript } from "@/lib/ai.functions";
import { footageNeeded, sceneStyle } from "@/lib/explainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PhotoFraming } from "@/components/PhotoFraming";
import { ExplainerAudio } from "@/components/ExplainerAudio";

const DEFAULTS: Explainer = { length: 4, tone: "friendly", illustrations: true, includeClips: true, style: "animated", music: true, scenes: [] };
const LABELS = Object.fromEntries(EXPLAINER_KINDS.map((k) => [k.value, k.label]));
const safeName = (s: string) => s.replace(/[^\w-]+/g, "_").slice(0, 60) || "course";

async function signed(path: string | null | undefined) {
  if (!path) return null;
  return (await supabase.storage.from("documents").createSignedUrl(path, 3600)).data?.signedUrl ?? null;
}

export function ExplainerStudio({ open, onOpenChange, courseId, title, content, approved, editable, passScore, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; courseId: string; title: string; content: CourseContent;
  approved: boolean; editable: boolean; passScore: number; onSaved: (e: Explainer) => void;
}) {
  const { brand, current } = useOrg();
  const write = useServerFn(writeExplainerScript);
  const illustrate = useServerFn(makeIllustration);
  const narrate = useServerFn(narrateText);
  const suggest = useServerFn(suggestClipPrompts);
  const startClip = useServerFn(startSceneClip);
  const checkClip = useServerFn(checkSceneClip);
  const [filming, setFilming] = useState<string | null>(null);
  const clipsUsed = useQuery({
    queryKey: ["clips-used", current?.org_id], enabled: open && !!current,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const { count } = await supabase.from("audit_events").select("id", { count: "exact", head: true }).eq("org_id", current!.org_id).eq("action", "clip.generated").gte("created_at", since);
      return count ?? 0;
    },
  });
  const clipsLeft = Math.max(0, MONTHLY_CLIP_LIMIT - (clipsUsed.data ?? 0));
  const [ex, setEx] = useState<Explainer>(content.explainer ?? DEFAULTS);
  const [writing, setWriting] = useState(false);
  const [job, setJob] = useState<{ msg: string; pct: number } | null>(null);
  const [hd, setHd] = useState(false);
  const [requireView, setRequireView] = useState(true);
  const [drawing, setDrawing] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const dirty = useRef(false);
  const contentRef = useRef(content);
  contentRef.current = content;

  useEffect(() => { if (open) setEx(content.explainer ?? DEFAULTS); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save the script without changing the course's approval status.
  async function persist(next: Explainer) {
    const { error } = await supabase.from("courses").update({ content: { ...contentRef.current, explainer: next } as any }).eq("id", courseId);
    if (error) toast.error(error.message);
    else onSaved(next);
  }
  useEffect(() => {
    if (!dirty.current || !editable) return;
    const t = setTimeout(() => { dirty.current = false; persist(ex); }, 1000);
    return () => clearTimeout(t);
  }, [ex]); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (fn: (e: Explainer) => Explainer) => { if (!editable) return; dirty.current = true; setEx(fn); };
  const setScene = (id: string, p: Partial<ExplainerScene>) => change((e) => ({ ...e, scenes: e.scenes.map((s) => (s.id === id ? { ...s, ...p } : s)) }));
  const move = (i: number, d: number) => change((e) => {
    const a = [...e.scenes]; const j = i + d;
    if (j < 0 || j >= a.length) return e;
    [a[i], a[j]] = [a[j]!, a[i]!];
    return { ...e, scenes: a };
  });
  const clipSlides = content.slides.filter((s) => s.clip_path);
  const words = ex.scenes.reduce((a, s) => a + s.narration.split(/\s+/).filter(Boolean).length, 0);
  const estMin = Math.max(1, Math.round(words / 150 + ex.scenes.length * 0.015));
  const picCount = ex.scenes.filter((s) => s.image_path).length;

  async function writeScript() {
    if (ex.scenes.length && !confirm("Replace the current script with a new one? Your edits to it will be lost.")) return;
    setWriting(true);
    try {
      const r = await write({ data: { courseId, length: ex.length, tone: ex.tone, illustrations: ex.illustrations } });
      change((e) => ({ ...e, scenes: r.scenes }));
      toast.success(`Script written: ${r.scenes.length} scenes. Read it through and edit anything before building.`);
    } catch (e: any) { toast.error(e.message ?? "Couldn't write the script"); }
    finally { setWriting(false); }
  }

  async function drawPicture(s: ExplainerScene) {
    if (!s.illustration_prompt?.trim()) { toast.error("Describe the picture first."); return null; }
    if (!s.image_path && picCount >= MAX_ILLUSTRATIONS_PER_VIDEO) { toast.error(`An explainer can use up to ${MAX_ILLUSTRATIONS_PER_VIDEO} illustrations.`); return null; }
    setDrawing(s.id);
    try {
      const { path } = await illustrate({ data: { courseId, sceneId: s.id, prompt: s.illustration_prompt, primary: brand.primary_color, accent: brand.accent_color } });
      return path;
    } finally { setDrawing(null); }
  }

  // Make AI footage clips for scenes set to "AI footage" that don't have one yet.
  async function makeFootage(only?: ExplainerScene) {
    const todo = only ? [only] : footageNeeded(ex.scenes, ex.style);
    if (!todo.length) { toast.info("Every footage scene already has a clip."); return; }
    if (todo.length > clipsLeft) { toast.error(`${todo.length} clip${todo.length > 1 ? "s" : ""} needed, but your organization has ${clipsLeft} of ${MONTHLY_CLIP_LIMIT} left this month. Switch some scenes to Animated.`); return; }
    if (!confirm(`Make ${todo.length} AI footage clip${todo.length > 1 ? "s" : ""}? Each uses one of your ${clipsLeft} remaining clips this month and takes 1–3 minutes.`)) return;
    try {
      setFilming(only ? only.id : "all");
      const needPrompt = todo.filter((s) => !s.clip_prompt?.trim());
      const prompts = new Map(todo.map((s) => [s.id, s.clip_prompt ?? ""]));
      if (needPrompt.length) {
        const r = await suggest({ data: { courseId, slides: needPrompt.map((s) => ({ id: s.id, layout: "content" as any, title: s.heading, body: [s.quote, ...s.items, ...s.items2].filter(Boolean).join("; "), bullets: s.items, notes: s.narration })) } });
        r.forEach((x) => prompts.set(x.id, x.prompt));
      }
      // Start all clips, then poll them together.
      const jobs: { id: string; jobId: string; prompt: string }[] = [];
      for (const s of todo) {
        const prompt = prompts.get(s.id)?.trim();
        if (!prompt) continue;
        try { jobs.push({ id: s.id, prompt, jobId: (await startClip({ data: { courseId, prompt } })).jobId }); }
        catch (e: any) { toast.error(`Scene "${s.heading}": ${e.message ?? "couldn't start clip"}`); }
      }
      let pending = jobs;
      for (let round = 0; round < 60 && pending.length; round++) {
        await new Promise((r) => setTimeout(r, 7000));
        const next: typeof jobs = [];
        for (const j of pending) {
          try {
            const r = await checkClip({ data: { courseId, jobId: j.jobId } });
            if (r.status === "completed") setScene(j.id, { clip_path: r.path, clip_prompt: j.prompt });
            else if (r.status === "failed") toast.error(r.error ?? "Clip failed");
            else next.push(j);
          } catch { next.push(j); }
        }
        pending = next;
      }
      if (pending.length) toast.error(`${pending.length} clip${pending.length > 1 ? "s are" : " is"} still rendering. Try "Make footage" again in a few minutes.`);
      else toast.success("Footage ready.");
    } catch (e: any) { toast.error(e.message ?? "Footage failed"); }
    finally { setFilming(null); clipsUsed.refetch(); }
  }

  async function build(kind: "mp4" | "scorm") {
    if (!approved) { toast.error("Approve the course before exporting."); return; }
    if (!current) { toast.error("Choose your organization first."); return; }
    if (!ex.scenes.length) { toast.error("Write the script first."); return; }
    abort.current = new AbortController();
    const signal = abort.current.signal;
    try {
      // Illustrations still missing
      let scenes = ex.scenes;
      const missing = scenes.filter((s) => ex.illustrations && sceneUsesPicture(s) && s.illustration_prompt && !s.image_path && !(ex.includeClips && s.clip_slide_id));
      const room = Math.max(0, MAX_ILLUSTRATIONS_PER_VIDEO - picCount);
      if (missing.length && editable) {
        const todo = missing.slice(0, room);
        for (let k = 0; k < todo.length; k++) {
          if (signal.aborted) throw new Error("Cancelled");
          setJob({ msg: `Drawing illustration ${k + 1} of ${todo.length} (about 30 sec each)…`, pct: (k / todo.length) * 30 });
          try {
            const path = await drawPicture(todo[k]!);
            if (path) scenes = scenes.map((s) => (s.id === todo[k]!.id ? { ...s, image_path: path } : s));
          } catch (e: any) { toast.error(`Scene "${todo[k]!.heading}": ${e.message ?? "picture failed"}. Using a plain background.`); }
        }
        const next = { ...ex, scenes };
        setEx(next);
        await persist(next);
      }
      setJob({ msg: "Getting ready…", pct: 30 });
      const pictures = await Promise.all(scenes.map((s) => signed(s.image_path)));
      const recordings = await Promise.all(scenes.map(async (s) => {
        if (!s.voice_path) return null;
        const url = await signed(s.voice_path);
        if (!url) throw new Error(`Couldn't load audio for scene "${s.heading}".`);
        return url;
      }));
      const clips = await Promise.all(scenes.map((s) =>
        sceneStyle(s, ex.style) === "footage" && s.clip_path ? signed(s.clip_path)
          : ex.includeClips && s.clip_slide_id ? signed(content.slides.find((x) => x.id === s.clip_slide_id)?.clip_path) : Promise.resolve(null)));
      const noClip = footageNeeded(scenes, ex.style).length;
      if (noClip) toast.info(`${noClip} footage scene${noClip > 1 ? "s have" : " has"} no clip yet and will be animated instead.`);
      const { buildExplainerVideo } = await import("@/lib/explainer-render");
      const W = hd ? 1920 : 1280;
      const t0 = Date.now();
      const rec = await buildExplainerVideo({
        scenes, brand, pictures, recordings, clips, signal, width: W, height: W === 1920 ? 1080 : 720,
        burnCaptions: kind === "mp4", videoStyle: ex.style ?? "animated", music: ex.music ?? true, labels: LABELS,
        narrate: async (text, sc) => (await narrate({ data: { orgId: current.org_id, text, voice: sc.voice || brand.voice } })).wavBase64,
        onProgress: (msg, p) => {
          const pct = 30 + p * 0.68;
          const left = p > 40 ? ((Date.now() - t0) / p) * (100 - p) / 1000 : 0;
          setJob({ msg: msg + (left > 5 ? ` About ${left > 90 ? `${Math.round(left / 60)} min` : `${Math.round(left)} sec`} left.` : ""), pct });
        },
        onFallback: () => toast.info("This browser can't build video quickly, so it will record in real time. Keep this tab open and in front."),
      });
      const { download, exportScorm } = await import("@/lib/exports");
      if (kind === "mp4") download(rec.blob, `${safeName(title)}-explainer.${rec.ext}`);
      else {
        setJob({ msg: "Packaging SCORM file…", pct: 98 });
        await exportScorm(title, content, brand, [], passScore, { rec, requireFullView: requireView, vtt: rec.vtt, titles: rec.titles });
      }
      await logAudit(current.org_id, `course.exported.explainer_${kind}`, courseId);
      toast.success("Explainer video downloaded");
    } catch (e: any) {
      if (e.message !== "Cancelled") toast.error(e.message ?? "Build failed");
    } finally { setJob(null); }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clapperboard className="size-5" /> Explainer video</DialogTitle>
            <DialogDescription>A short video that teaches the policy like a documentary explainer, with animated diagrams, illustrations and voiceover. It's not a narrated slideshow.</DialogDescription>
          </DialogHeader>

          <section className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Length</Label>
              <Select value={String(ex.length)} disabled={!editable} onValueChange={(v) => change((e) => ({ ...e, length: Number(v) as 2 | 4 | 6 }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="2">About 2 minutes</SelectItem><SelectItem value="4">About 4 minutes</SelectItem><SelectItem value="6">About 6 minutes</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tone</Label>
              <Select value={ex.tone} disabled={!editable} onValueChange={(v) => change((e) => ({ ...e, tone: v as ExplainerTone }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="friendly">Friendly</SelectItem><SelectItem value="formal">Formal</SelectItem><SelectItem value="plain">Plain-spoken</SelectItem></SelectContent>
              </Select>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" disabled={!editable} checked={ex.illustrations} onChange={(e) => change((x) => ({ ...x, illustrations: e.target.checked }))} />
              <span><strong>AI illustrations</strong><span className="block text-muted-foreground">Pictures drawn in your brand colors (up to {MAX_ILLUSTRATIONS_PER_VIDEO}). Each uses AI credits. Off uses shapes and diagrams only.</span></span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" disabled={!editable || !clipSlides.length} checked={ex.includeClips && !!clipSlides.length} onChange={(e) => change((x) => ({ ...x, includeClips: e.target.checked }))} />
              <span><strong>Use my AI video clips</strong><span className="block text-muted-foreground">{clipSlides.length ? `${clipSlides.length} clip${clipSlides.length > 1 ? "s" : ""} can play behind matching scenario scenes.` : "No slides have video clips yet."}</span></span>
            </label>
            <div className="space-y-1.5">
              <Label>Video style</Label>
              <Select value={ex.style ?? "animated"} disabled={!editable} onValueChange={(v) => change((e) => ({ ...e, style: v as ExplainerStyle }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="animated">Animated (motion graphics)</SelectItem><SelectItem value="footage">AI video footage</SelectItem></SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{(ex.style ?? "animated") === "animated" ? "Moving text, diagrams and pictures with camera motion and transitions. No extra AI cost." : `Each scene gets a short AI clip with its words animated on top. Uses your clip allowance (${clipsLeft} of ${MONTHLY_CLIP_LIMIT} left this month).`} You can change the style for any scene.</p>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" disabled={!editable} checked={ex.music ?? true} onChange={(e) => change((x) => ({ ...x, music: e.target.checked }))} />
              <span><strong>Background music</strong><span className="block text-muted-foreground">A soft music bed that gets quieter while the narrator speaks.</span></span>
            </label>
            <p className="text-xs text-muted-foreground sm:col-span-2">Default voice: <strong>{brand.voice}</strong> (change it in Brand kit). You can pick a different voice for any scene below.</p>
            {editable && (
              <Button className="sm:col-span-2" onClick={writeScript} disabled={writing}>
                {writing ? <><Loader2 className="animate-spin" /> Writing script… (up to a minute)</> : <><Sparkles /> {ex.scenes.length ? "Rewrite script" : "Write script"}</>}
              </Button>
            )}
          </section>

          {ex.scenes.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-lg font-semibold">Script: {ex.scenes.length} scenes, about {estMin} min</h3>
                <span className="text-xs text-muted-foreground">Changes save automatically and don't affect approval.</span>
              </div>
              {editable && footageNeeded(ex.scenes, ex.style).length > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/50 p-3 text-sm">
                  <Film className="size-4" />
                  <span className="flex-1">{footageNeeded(ex.scenes, ex.style).length} footage scene(s) need a clip. You have {clipsLeft} of {MONTHLY_CLIP_LIMIT} clips left this month. Scenes without a clip are animated instead.</span>
                  <Button size="sm" disabled={!!filming} onClick={() => makeFootage()}>{filming === "all" ? <><Loader2 className="animate-spin" /> Making footage… (1–3 min)</> : <><Film /> Make footage</>}</Button>
                </div>
              )}
              {ex.scenes.map((s, i) => (
                <SceneCard key={s.id} s={s} i={i} n={ex.scenes.length} editable={editable} illustrations={ex.illustrations}
                  clipSlides={ex.includeClips ? clipSlides.map((c) => ({ id: c.id, title: c.title })) : []}
                  drawing={drawing === s.id} brandVoice={brand.voice} videoStyle={ex.style ?? "animated"}
                  filming={filming === s.id || filming === "all"} onFilm={() => makeFootage(s)}
                  onUpload={async (f) => { try { if (!current) throw new Error("Choose your organization first."); if (!f.type.startsWith("image/")) throw new Error("Choose a photo or image file."); if (f.size > 10e6) throw new Error("Photos can be up to 10 MB."); const ext = (f.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 5); const path = `${current.org_id}/explainer-photos/${s.id}-${newId()}.${ext}`; const up = await supabase.storage.from("documents").upload(path, f, { contentType: f.type }); if (up.error) throw new Error(up.error.message); setScene(s.id, { image_path: path, image_frame: null }); toast.success("Photo added"); } catch (e: any) { toast.error(e.message ?? "Upload failed"); } }}
                  onUploadAudio={async (f) => {
                    try {
                      if (!current) throw new Error("Choose your organization first.");
                      if (!f.type.startsWith("audio/")) throw new Error("Choose an audio file.");
                      if (f.size > 15 * 1024 * 1024) throw new Error("Audio files must be under 15 MB.");
                      const ctx = new AudioContext();
                      try { await ctx.decodeAudioData(await f.arrayBuffer()); }
                      catch { throw new Error("This browser can't play that audio. Try MP3 or WAV."); }
                      finally { await ctx.close(); }
                      const ext = (f.name.split(".").pop() || "wav").replace(/[^a-z0-9]/gi, "").slice(0, 5);
                      const path = `${current.org_id}/recordings/${s.id}-${newId()}.${ext}`;
                      const up = await supabase.storage.from("documents").upload(path, f, { contentType: f.type });
                      if (up.error) throw new Error(up.error.message);
                      setScene(s.id, { voice_path: path });
                      toast.success("Scene audio added");
                    } catch (e: any) { toast.error(e.message ?? "Audio upload failed"); }
                  }}
                  onChange={(p) => setScene(s.id, p)} onMove={(d) => move(i, d)}
                  onDelete={() => change((e) => ({ ...e, scenes: e.scenes.filter((x) => x.id !== s.id) }))}
                  onDraw={async () => { try { const p = await drawPicture(s); if (p) setScene(s.id, { image_path: p, image_frame: null }); } catch (e: any) { toast.error(e.message ?? "Picture failed"); } }} />
              ))}
              {editable && (
                <Button variant="outline" size="sm" onClick={() => change((e) => ({ ...e, scenes: [...e.scenes, { id: newId(), kind: "points", narration: "", heading: "New scene", items: [], items2: [], quote: null, source: null, illustration_prompt: null, image_path: null, clip_slide_id: null }] }))}>
                  <Plus /> Add scene
                </Button>
              )}
            </section>
          )}

          {ex.scenes.length > 0 && (
            <section className="space-y-3 rounded-lg border bg-card p-4">
              <h3 className="font-display text-lg font-semibold">Build</h3>
              {!approved && <p className="text-sm text-destructive">Approve the course before building the video.</p>}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hd} onChange={(e) => setHd(e.target.checked)} /> Full HD (1080p). Sharper, about twice the file size.</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={requireView} onChange={(e) => setRequireView(e.target.checked)} /> SCORM: require watching the whole video before the quiz</label>
              <p className="text-xs text-muted-foreground">
                {ex.illustrations && editable && ex.scenes.some((s) => sceneUsesPicture(s) && s.illustration_prompt && !s.image_path) ? "Missing illustrations are drawn first. " : ""}
                The video builds faster than real time in Chrome and Edge. You can switch tabs, but keep this one open.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={!approved || !!job} onClick={() => build("mp4")}><Download /> Download MP4 (captions included)</Button>
                <Button variant="outline" disabled={!approved || !!job} onClick={() => build("scorm")}><Download /> SCORM package with quiz</Button>
              </div>
            </section>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!job} onOpenChange={(o) => { if (!o) abort.current?.abort(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Building explainer video</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{job?.msg}</p>
          <Progress value={job?.pct ?? 0} />
          <p className="text-xs text-muted-foreground">Keep this tab open. Close this window to cancel.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SceneCard({ s, i, n, editable, illustrations, clipSlides, drawing, brandVoice, videoStyle, filming, onFilm, onChange, onMove, onDelete, onDraw, onUpload, onUploadAudio }: {
  s: ExplainerScene; i: number; n: number; editable: boolean; illustrations: boolean; clipSlides: { id: string; title: string }[]; drawing: boolean; brandVoice: string;
  videoStyle: ExplainerStyle; filming: boolean; onFilm: () => void;
  onChange: (p: Partial<ExplainerScene>) => void; onMove: (d: number) => void; onDelete: () => void; onDraw: () => void; onUpload: (f: File) => Promise<void>;
  onUploadAudio: (f: File) => Promise<void>;
}) {
  const footage = sceneStyle(s, videoStyle) === "footage";
  const clip = useQuery({ queryKey: ["signed", s.clip_path], enabled: footage && !!s.clip_path, queryFn: () => signed(s.clip_path), staleTime: 30 * 60e3 });
  const pic = useQuery({ queryKey: ["signed", s.image_path], enabled: !!s.image_path, queryFn: () => signed(s.image_path), staleTime: 30 * 60e3 });
  const audio = useQuery({ queryKey: ["signed", s.voice_path], enabled: !!s.voice_path, queryFn: () => signed(s.voice_path), staleTime: 30 * 60e3 });
  const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);
  const itemsLabel = s.kind === "dodont" ? "Do (one per line)" : s.kind === "steps" ? "Steps (one per line)" : s.kind === "scenario" ? "What to do (one per line)" : s.kind === "fact" || s.kind === "title" || s.kind === "illustration" || s.kind === "quote" ? "Subtitle (optional)" : "On-screen points (one per line)";
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{i + 1}</span>
        <Select value={s.kind} disabled={!editable} onValueChange={(v) => onChange({ kind: v as ExplainerKind })}>
          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{EXPLAINER_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={s.style ?? "default"} disabled={!editable} onValueChange={(v) => onChange({ style: v === "default" ? null : v as ExplainerStyle })}>
          <SelectTrigger className="h-8 w-40" aria-label="Scene style"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="default">Video style ({videoStyle === "footage" ? "footage" : "animated"})</SelectItem><SelectItem value="animated">Animated</SelectItem><SelectItem value="footage">AI footage</SelectItem></SelectContent>
        </Select>
        <Input value={s.heading} disabled={!editable} onChange={(e) => onChange({ heading: e.target.value })} className="h-8 min-w-0 flex-1 font-medium" aria-label="On-screen heading" />
        {editable && (
          <div className="flex">
            <Button size="icon" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => onMove(-1)}><ArrowUp /></Button>
            <Button size="icon" variant="ghost" aria-label="Move down" disabled={i === n - 1} onClick={() => onMove(1)}><ArrowDown /></Button>
            <Button size="icon" variant="ghost" aria-label="Delete scene" onClick={onDelete}><Trash2 /></Button>
          </div>
        )}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Narration</Label>
          <Textarea rows={4} value={s.narration} disabled={!editable} onChange={(e) => onChange({ narration: e.target.value })} />
          <ExplainerAudio scene={s} url={audio.data} editable={editable} brandVoice={brandVoice} onChange={onChange} onUpload={onUploadAudio} />
        </div>
        <div className="space-y-2">
          {s.kind === "quote" ? (
            <>
              <div className="space-y-1"><Label className="text-xs">Exact policy wording</Label><Textarea rows={3} value={s.quote ?? ""} disabled={!editable} onChange={(e) => onChange({ quote: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-xs">Policy section</Label><Input value={s.source ?? ""} disabled={!editable} onChange={(e) => onChange({ source: e.target.value })} /></div>
            </>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">{itemsLabel}</Label>
              <Textarea rows={s.kind === "dodont" ? 2 : 3} defaultValue={s.items.join("\n")} key={`${s.id}-i-${s.kind}`} disabled={!editable} onBlur={(e) => onChange({ items: lines(e.target.value) })} />
            </div>
          )}
          {s.kind === "dodont" && (
            <div className="space-y-1">
              <Label className="text-xs">Don't (one per line)</Label>
              <Textarea rows={2} defaultValue={s.items2.join("\n")} key={`${s.id}-d`} disabled={!editable} onBlur={(e) => onChange({ items2: lines(e.target.value) })} />
            </div>
          )}
        </div>
      </div>
      {footage && (
        <div className="mt-3 flex flex-wrap items-start gap-3 rounded-md bg-muted/50 p-3">
          {clip.data ? <video src={clip.data} muted loop autoPlay playsInline className="h-20 w-36 rounded object-cover" /> : <div className="flex h-20 w-36 items-center justify-center rounded bg-muted text-muted-foreground"><Film /></div>}
          <div className="min-w-0 flex-1 space-y-2">
            <Label className="text-xs">Footage description (leave empty to write it from the narration)</Label>
            <Textarea rows={2} value={s.clip_prompt ?? ""} disabled={!editable} onChange={(e) => onChange({ clip_prompt: e.target.value })} placeholder="e.g. A supervisor walks a new employee through a safety checklist on a warehouse floor, slow push-in" />
            {editable && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={filming} onClick={onFilm}>{filming ? <><Loader2 className="animate-spin" /> Making clip… (1–3 min)</> : <><Film /> {s.clip_path ? "Remake clip" : "Make clip"}</>}</Button>
                {s.clip_path && <Button size="sm" variant="ghost" onClick={() => onChange({ clip_path: null })}>Remove clip</Button>}
              </div>
            )}
            {!s.clip_path && <p className="text-xs text-muted-foreground">No clip yet, so this scene is animated in the video.</p>}
          </div>
        </div>
      )}
      {sceneUsesPicture(s) && !(footage && s.clip_path) && (
        <div className="mt-3 flex flex-wrap items-start gap-3 rounded-md bg-muted/50 p-3">
          {pic.data ? <img src={pic.data} alt="" className="h-20 w-30 rounded object-cover" /> : <div className="flex h-20 w-30 items-center justify-center rounded bg-muted text-muted-foreground"><ImageIcon /></div>}
          <div className="min-w-0 flex-1 space-y-2">
            {clipSlides.length > 0 && s.kind === "scenario" && (
              <Select value={s.clip_slide_id ?? "none"} disabled={!editable} onValueChange={(v) => onChange({ clip_slide_id: v === "none" ? null : v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">No video clip</SelectItem>{clipSlides.map((c) => <SelectItem key={c.id} value={c.id}>Clip from slide: {c.title}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {illustrations && !s.clip_slide_id && (
              <>
                <Input placeholder="Describe the picture, e.g. a nurse pausing at a shared computer to lock the screen" value={s.illustration_prompt ?? ""} disabled={!editable} onChange={(e) => onChange({ illustration_prompt: e.target.value })} />
                {editable && <Button size="sm" variant="outline" disabled={drawing} onClick={onDraw}>{drawing ? <><Loader2 className="animate-spin" /> Drawing… (about 30 sec)</> : <><Sparkles /> {s.image_path ? "Redraw picture" : "Draw picture"}</>}</Button>}
              </>
            )}
            {editable && !s.clip_slide_id && (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" asChild>
                  <label className="cursor-pointer"><Upload /> {s.image_path ? "Replace with my photo" : "Upload my own photo"}<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onUpload(f); }} /></label>
                </Button>
                 {s.image_path && <Button size="sm" variant="ghost" onClick={() => onChange({ image_path: null, image_frame: null })}>Remove picture</Button>}
              </div>
            )}
             {pic.data && !s.clip_slide_id && <PhotoFraming url={pic.data} frame={s.image_frame} disabled={!editable} onChange={(image_frame) => onChange({ image_frame })} />}
            {!illustrations && !s.clip_slide_id && !s.image_path && <p className="text-xs text-muted-foreground">AI illustrations are off. Upload a photo, or this scene uses a brand-color background.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
