# Policy-to-Training Builder

A multi-organization web app. An admin uploads a policy (code of conduct, SOP), AI turns it into a branded training module, the admin edits it, and exports it as a slideshow, narrated video, or SCORM package for their LMS.

## What it takes to be "real-world ready"

1. **Accounts and organizations** - sign-up, separate workspaces per company, invite teammates, roles (Owner, Editor, Viewer). Each company's data is fully isolated.
2. **Document intake** - upload PDF, Word or text files up to about 20MB. Text is extracted and kept with the original file, privately.
3. **AI course generation** - produces an outline (modules, learning objectives), slides (headline, bullets, speaker notes), scenario examples, and a quiz with an answer key. It cites the policy section behind each slide so reviewers can check accuracy and nothing is made up.
4. **Branding kit per org** - logo, colors, fonts, and a default intro/outro slide applied to every course.
5. **Editor** - reorder, edit, add or delete slides; edit quiz questions; regenerate one slide with AI; change slide layouts; preview the slides full screen. Changes autosave, with version history.
6. **Exports**
   - Slideshow: in-app presenter, PDF, and PowerPoint (.pptx).
   - Narrated video: AI voiceover from speaker notes, synced to slides, rendered to MP4. Voice choice per org.
   - AI scene clips: optional short generated clips inserted into chosen slides (with a cost warning).
   - SCORM 1.2/2004 zip: slides plus quiz with pass score, which loads into most LMS platforms.
7. **Job handling** - video and SCORM builds run in the background with progress, retries, and email or in-app notice when done.
8. **Trust and compliance** - audit log of edits, "AI-generated, reviewed by X" approval step before export, data deletion, privacy policy and terms, plus a security review.
9. **Later (not in v1)** - paid plans, learner tracking inside the app, SSO, translations.

## Build phases

1. Foundation: accounts, organizations, invites, roles, branding kit, design system.
2. Upload and AI generation of outline, slides and quiz with source citations.
3. Slide editor, presenter view, version history, approval step.
4. Exports: PDF, PPTX, SCORM.
5. Narrated video export, then optional AI scene clips.
6. Hardening: audit log, usage limits per org, error states, tests, launch pages.

## Honest caveats

- Video rendering is the hardest part. Turning slides into a video requires a rendering service outside the app's normal servers, so we would need one extra provider for that step.
- AI voice and video cost money for each use, so we need usage limits per org even before paid plans.
- A legal/HR reviewer should always approve content. The app supports this, but it cannot guarantee accuracy.

## Technical details

- TanStack Start + Lovable Cloud (auth, Postgres with RLS per org, private storage buckets for documents, logos, exports).
- Tables: organizations, memberships (roles in separate table with has_role function), invites, brand_kits, documents, courses, course_versions, slides, quiz_questions, export_jobs, audit_events.
- AI via Lovable AI Gateway: default chat model with strict JSON-schema output for course structure; PDF input on Responses API; TTS default for narration; video model for scene clips.
- Slides rendered as 1920x1080 scaled React components using --slide-* tokens built from the brand kit; same renderer for editor, presenter, PDF print route.
- PPTX generated server-side (pptxgenjs-compatible with Workers, or rendered in the job service); SCORM zip built with imsmanifest.xml + static player.
- MP4 assembly (slide images + audio + clips) runs on an external render worker (FFmpeg-based) triggered by export_jobs and writing results back to storage; Workers cannot run FFmpeg.
