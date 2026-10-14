import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MONTHLY_CLIP_LIMIT, MONTHLY_GENERATION_LIMIT, newId, type CourseContent, type Slide } from "./course";

const slideSchema = {
  type: "object",
  additionalProperties: false,
  required: ["layout", "title", "subtitle", "bullets", "body", "notes", "source"],
  properties: {
    layout: { type: "string", enum: ["title", "section", "bullets", "scenario", "key_point"] },
    title: { type: "string" },
    subtitle: { type: ["string", "null"] },
    bullets: { type: "array", items: { type: "string" } },
    body: { type: ["string", "null"] },
    notes: { type: "string", description: "Narration script for this slide, 40-110 words, spoken to the learner." },
    source: { type: "string", description: "Section/heading of the policy this slide is based on, or 'General' for intro/outro." },
  },
};

const courseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description", "objectives", "slides", "quiz"],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    objectives: { type: "array", items: { type: "string" } },
    slides: { type: "array", items: slideSchema },
    quiz: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "options", "correct_index", "explanation", "source"],
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correct_index: { type: "integer" },
          explanation: { type: "string" },
          source: { type: "string" },
        },
      },
    },
  },
};

const INSTRUCTIONS = `You are an expert instructional designer who converts organizational policies, codes of conduct and SOPs into clear, engaging employee training.
Rules:
- Use ONLY facts in the provided document. Never invent rules, numbers, names, contacts or consequences. If something is unclear, leave it out.
- Every slide and quiz question must cite the document section it came from in "source".
- Build 10-18 slides: start with a "title" slide, then 3-5 learning objectives slide ("bullets"), group content by topic with "section" dividers, use "bullets" (max 4 short bullets, <= 14 words each), "key_point" (one memorable rule in body) and at least two "scenario" slides (realistic workplace situation in body, the right action in bullets).
- End with a "key_point" summary slide.
- "notes" is the narrator script for that slide, conversational, 40-110 words.
- Write 5-8 multiple-choice quiz questions with exactly 4 options, one correct (correct_index 0-3), and a short explanation.
- Plain, inclusive language at an 8th-grade reading level.`;

async function assertEditor(supabase: any, orgId: string, userId: string) {
  const { data, error } = await supabase.rpc("has_org_role", { _org: orgId, _user: userId, _roles: ["owner", "editor"] });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("You need editor access in this organization.");
}

async function assertMember(supabase: any, orgId: string, userId: string) {
  const { data, error } = await supabase.rpc("is_org_member", { _org: orgId, _user: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("You are not a member of this organization.");
}

export const generateCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { documentId: string; audience?: string }) => {
    if (!d?.documentId) throw new Error("documentId required");
    return { documentId: d.documentId, audience: (d.audience ?? "").slice(0, 300) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context as any;
    const { structuredResponse, toBase64 } = await import("./ai.server");

    const { data: doc, error } = await supabase.from("documents").select("*").eq("id", data.documentId).single();
    if (error || !doc) throw new Error("Document not found.");
    await assertEditor(supabase, doc.org_id, userId);

    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const { count } = await supabase
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("org_id", doc.org_id)
      .eq("action", "course.generated")
      .gte("created_at", since);
    if ((count ?? 0) >= MONTHLY_GENERATION_LIMIT)
      throw new Error(`Your organization reached its limit of ${MONTHLY_GENERATION_LIMIT} AI generations in 30 days.`);

    const content: Record<string, unknown>[] = [];
    if (doc.extracted_text) {
      content.push({ type: "input_text", text: `Policy document "${doc.title}":\n\n${doc.extracted_text.slice(0, 180000)}` });
    } else if (doc.file_path && doc.mime === "application/pdf") {
      const { data: file, error: dlErr } = await supabase.storage.from("documents").download(doc.file_path);
      if (dlErr || !file) throw new Error("Could not read the uploaded file.");
      const b64 = toBase64(new Uint8Array(await file.arrayBuffer()));
      content.push({ type: "input_text", text: `Policy document "${doc.title}" is attached.` });
      content.push({ type: "input_file", filename: "policy.pdf", file_data: `data:application/pdf;base64,${b64}` });
    } else throw new Error("This document has no readable text.");
    content.push({
      type: "input_text",
      text: `Create the training course now.${data.audience ? ` Target audience: ${data.audience}.` : ""}`,
    });

    const result = await structuredResponse<{
      title: string;
      description: string;
      objectives: string[];
      slides: Omit<Slide, "id">[];
      quiz: { question: string; options: string[]; correct_index: number; explanation: string; source: string }[];
    }>({ instructions: INSTRUCTIONS, content, schemaName: "training_course", schema: courseSchema });

    const courseContent: CourseContent = {
      objectives: result.objectives,
      slides: result.slides.map((s) => ({ ...s, id: newId() })),
      quiz: result.quiz.map((q) => ({
        ...q,
        id: newId(),
        correct_index: Math.min(Math.max(0, q.correct_index), Math.max(0, q.options.length - 1)),
      })),
    };

    const { data: course, error: cErr } = await supabase
      .from("courses")
      .insert({
        org_id: doc.org_id,
        document_id: doc.id,
        title: result.title,
        description: result.description,
        content: courseContent,
        created_by: userId,
      })
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);
    await supabase.from("course_versions").insert({
      course_id: course.id, org_id: doc.org_id, title: result.title, content: courseContent, note: "AI draft", created_by: userId,
    });
    await supabase.from("audit_events").insert({
      org_id: doc.org_id, actor: userId, actor_email: claims?.email ?? null, action: "course.generated", target: course.id,
    });
    return { courseId: course.id as string };
  });

export const regenerateSlide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId: string; slide: Slide; instruction: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { structuredResponse } = await import("./ai.server");
    const { data: course } = await supabase.from("courses").select("org_id, document_id").eq("id", data.courseId).single();
    if (!course) throw new Error("Course not found.");
    await assertEditor(supabase, course.org_id, userId);
    let policy = "";
    if (course.document_id) {
      const { data: doc } = await supabase.from("documents").select("extracted_text").eq("id", course.document_id).single();
      policy = doc?.extracted_text?.slice(0, 60000) ?? "";
    }
    const out = await structuredResponse<Omit<Slide, "id">>({
      instructions: INSTRUCTIONS + "\nYou are rewriting ONE slide. Keep facts grounded in the policy.",
      content: [
        { type: "input_text", text: `${policy ? `Policy excerpt:\n${policy}\n\n` : ""}Current slide JSON:\n${JSON.stringify(data.slide)}\n\nRequested change: ${data.instruction.slice(0, 500) || "Make it clearer and more engaging."}` },
      ],
      schemaName: "slide",
      schema: slideSchema,
    });
    return { ...out, id: data.slide.id } as Slide;
  });

export const narrateText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; text: string; voice: string }) => {
    const text = (d.text ?? "").trim().slice(0, 1500);
    if (!text) throw new Error("Nothing to narrate.");
    return { orgId: d.orgId, text, voice: /^[A-Za-z]+$/.test(d.voice) ? d.voice : "Kore" };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertMember(supabase, data.orgId, userId);
    const { synthesizeSpeech } = await import("./ai.server");
    return { wavBase64: await synthesizeSpeech(data.text, data.voice) };
  });

export const startSceneClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId: string; prompt: string }) => {
    const prompt = (d.prompt ?? "").trim().slice(0, 800);
    if (prompt.length < 10) throw new Error("Describe the scene in a sentence or two.");
    return { courseId: d.courseId, prompt };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context as any;
    const { data: course } = await supabase.from("courses").select("org_id").eq("id", data.courseId).single();
    if (!course) throw new Error("Course not found.");
    await assertEditor(supabase, course.org_id, userId);
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const { count } = await supabase.from("audit_events").select("id", { count: "exact", head: true })
      .eq("org_id", course.org_id).eq("action", "clip.generated").gte("created_at", since);
    if ((count ?? 0) >= MONTHLY_CLIP_LIMIT) throw new Error(`Your organization reached its limit of ${MONTHLY_CLIP_LIMIT} scene clips in 30 days.`);
    const { createClipJob } = await import("./ai.server");
    const job = await createClipJob(data.prompt);
    await supabase.from("audit_events").insert({ org_id: course.org_id, actor: userId, actor_email: claims?.email ?? null, action: "clip.generated", target: data.courseId });
    return { jobId: job.id };
  });

export const checkSceneClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId: string; jobId: string }) => {
    if (!/^[\w-]+$/.test(d.jobId ?? "")) throw new Error("Invalid job");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: course } = await supabase.from("courses").select("org_id").eq("id", data.courseId).single();
    if (!course) throw new Error("Course not found.");
    await assertEditor(supabase, course.org_id, userId);
    const { pollClipJob, downloadClip } = await import("./ai.server");
    const job = await pollClipJob(data.jobId);
    if (job.status === "failed") {
      const m = job.error?.code === "moderation_blocked" ? "The clip was blocked by safety filters. Try describing the scene differently." : job.error?.message ?? "Clip generation failed.";
      return { status: "failed" as const, error: m, path: null };
    }
    if (job.status !== "completed") return { status: "pending" as const, progress: job.progress ?? 0, path: null, error: null };
    const path = `${course.org_id}/clips/${data.jobId}.mp4`;
    const { data: existing } = await supabase.storage.from("documents").list(`${course.org_id}/clips`, { search: `${data.jobId}.mp4` });
    if (!existing?.length) {
      const bytes = await downloadClip(data.jobId);
      const up = await supabase.storage.from("documents").upload(path, bytes, { contentType: "video/mp4", upsert: true });
      if (up.error) throw new Error(up.error.message);
    }
    return { status: "completed" as const, path, error: null };
  });

const CLIP_PROMPT_RULES = `You write prompts for 6-second AI-generated video clips used in workplace training videos. Each clip plays just before a slide, while the slide's narration explains it.
For each slide, write one scene description (40-90 words) that:
- Shows ONE moment in ONE realistic workplace setting with ONE main action: who (generic roles like "an employee", "a supervisor"), where, and what visibly happens.
- Illustrates the situation or the correct behavior described in the slide's narration and content. Prefer showing the right action.
- Names exactly one camera move (e.g. "slow push-in", "locked-off medium shot", "slow pan left").
- Describes body language and expressions so the moment reads without words.
- Uses diverse, neutral casting and settings that fit the audience.
- Contains NO dialogue, speech, captions, signs, readable text, logos, brand names, real or famous people, injuries, blood, weapons or violence.
Return plain descriptive prose only, no quotes or labels.`;

export const suggestClipPrompts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { courseId: string; slides: Pick<Slide, "id" | "title" | "body" | "bullets" | "notes" | "layout">[] }) => {
    const slides = (d.slides ?? []).slice(0, 18).map((s) => ({
      id: String(s.id), layout: s.layout, title: String(s.title ?? "").slice(0, 200), body: String(s.body ?? "").slice(0, 800),
      bullets: (s.bullets ?? []).slice(0, 6).map((b) => String(b).slice(0, 200)), notes: String(s.notes ?? "").slice(0, 1200),
    }));
    if (!slides.length) throw new Error("No slides to write prompts for.");
    return { courseId: d.courseId, slides };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: course } = await supabase.from("courses").select("org_id, title").eq("id", data.courseId).single();
    if (!course) throw new Error("Course not found.");
    await assertEditor(supabase, course.org_id, userId);
    const { structuredResponse } = await import("./ai.server");
    const out = await structuredResponse<{ prompts: { id: string; prompt: string }[] }>({
      instructions: CLIP_PROMPT_RULES,
      content: [{ type: "input_text", text: `Course: ${course.title}\n\nSlides (JSON):\n${JSON.stringify(data.slides)}\n\nWrite one prompt per slide, using each slide's id.` }],
      schemaName: "clip_prompts",
      schema: {
        type: "object", additionalProperties: false, required: ["prompts"],
        properties: { prompts: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "prompt"], properties: { id: { type: "string" }, prompt: { type: "string" } } } } },
      },
    });
    const ids = new Set(data.slides.map((s) => s.id));
    return out.prompts.filter((p) => ids.has(p.id) && p.prompt.trim()).map((p) => ({ id: p.id, prompt: p.prompt.trim().slice(0, 800) }));
  });
