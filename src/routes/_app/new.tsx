import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, logAudit } from "@/lib/org";
import { canEdit } from "@/lib/course";
import { generateCourse } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/new")({
  head: () => ({
    meta: [
      { title: "New course — Coursewright" },
      { name: "description", content: "Upload a policy document to generate a training course." },
      { property: "og:title", content: "New course — Coursewright" },
      { property: "og:description", content: "Upload a policy document to generate a training course." },
    ],
  }),
  component: NewCourse,
});

const MAX = 20 * 1024 * 1024;

async function extractText(file: File): Promise<string | null> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".md")) return await file.text();
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return r.value;
  }
  return null; // PDFs are read directly by the AI
}

function NewCourse() {
  const { current } = useOrg();
  const navigate = useNavigate();
  const gen = useServerFn(generateCourse);
  const [file, setFile] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("");
  const [stage, setStage] = useState<string | null>(null);

  if (!canEdit(current?.role)) return <p className="p-10 text-muted-foreground">Viewers can't create courses. Ask an owner for editor access.</p>;

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return;
    if (!file && !pasted.trim()) { toast.error("Upload a file or paste the policy text."); return; }
    if (file && file.size > MAX) { toast.error("Files must be under 20MB."); return; }
    const lower = file?.name.toLowerCase() ?? "";
    if (file && !/\.(pdf|docx|txt|md)$/.test(lower)) { toast.error("Use a PDF, Word (.docx), or text file."); return; }
    try {
      setStage("Reading document…");
      let text = pasted.trim() || null;
      let path: string | null = null;
      let mime: string | null = "text/plain";
      if (file) {
        text = await extractText(file);
        mime = lower.endsWith(".pdf") ? "application/pdf" : file.type || "text/plain";
        path = `${current.org_id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const up = await supabase.storage.from("documents").upload(path, file, { contentType: mime });
        if (up.error) throw up.error;
      }
      if (text !== null && text.trim().length < 200) throw new Error("This document is too short to build a course from.");
      const { data: user } = await supabase.auth.getUser();
      const { data: doc, error } = await supabase
        .from("documents")
        .insert({
          org_id: current.org_id,
          title: title || file?.name.replace(/\.[^.]+$/, "") || "Pasted policy",
          file_path: path, mime, extracted_text: text, created_by: user.user!.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      await logAudit(current.org_id, "document.uploaded", doc.id);
      setStage("Designing your course… this usually takes 30–90 seconds.");
      const r = await gen({ data: { documentId: doc.id, audience } });
      toast.success("Draft ready. Review it before exporting.");
      navigate({ to: "/courses/$courseId", params: { courseId: r.courseId } });
    } catch (err: any) {
      toast.error(err.message ?? "Generation failed");
      setStage(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <h1 className="text-4xl font-semibold">New course</h1>
      <p className="mt-2 text-muted-foreground">Upload a code of conduct, handbook section or SOP. The AI only uses what's in your document.</p>
      <form onSubmit={run} className="mt-8 space-y-6">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-card p-10 text-center hover:border-highlight">
          <Upload className="size-8 text-highlight" />
          <span className="mt-3 font-medium">{file ? file.name : "Choose a PDF, Word or text file"}</span>
          <span className="text-sm text-muted-foreground">Up to 20MB</span>
          <input type="file" accept=".pdf,.docx,.txt,.md" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {!file && (
          <div className="space-y-1.5">
            <Label>Or paste the policy text</Label>
            <Textarea rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste policy text here…" />
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Document title (optional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Code of Conduct 2026" />
          </div>
          <div className="space-y-1.5">
            <Label>Audience (optional)</Label>
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="New warehouse staff" />
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={!!stage}>
          {stage ? <><Loader2 className="animate-spin" /> {stage}</> : "Generate training"}
        </Button>
      </form>
    </div>
  );
}
