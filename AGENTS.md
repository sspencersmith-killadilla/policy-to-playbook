<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Multi-tenant: every app table has org_id; access is enforced by RLS via is_org_member/has_org_role (roles live in org_members). Why: org data isolation.
- Course slides and quiz live as JSON in courses.content; snapshots go to course_versions. Why: simple editing and version restore.
- AI calls (Responses API with strict JSON schema, TTS) live in src/lib/ai.server.ts and are exposed only through authenticated server functions in src/lib/ai.functions.ts. Why: keep keys server-side and verify org role.
- Exports (PPTX, SCORM, PDF print, narrated video via WebCodecs + mp4-muxer with MediaRecorder fallback) run in the browser in src/lib/exports.ts. Why: the server runtime cannot run FFmpeg or long jobs.
- Exports require course status "approved"; any edit resets to draft. Why: human review before distribution.

- Email: auth emails go through src/routes/lovable/email/auth/webhook.ts; app emails (e.g. team invites) are sent only from server functions via sendTemplateEmail, templates registered in src/lib/email-templates/registry.ts. Why: managed sending, no client-side send path.
- src/start.ts middleware must pass /lovable/* through untouched. Why: signed email webhooks must not hit app redirects/error pages.
- Explainer video: per-video style (animated | footage) with per-scene override and scene-owned clip_path; script lives in courses.content.explainer (saved without resetting approval); AI script/illustrations via ai.functions.ts; canvas scenes rendered and encoded in the browser by src/lib/explainer-render.ts, with pure timing helpers in src/lib/explainer.ts. Why: same browser-side export constraint as the narrated video.
- Explainer endings are enforced by the shared browser renderer with a pure scene-list helper, keeping original media aligned. Why: both video and SCORM exports must close consistently, including older saved scripts.
- Explainer media: scene voice_path references private org-scoped storage and overrides AI; image_frame is rendered with the shared photoCoverRect helper used by the crop preview. Why: uploaded narration and saved photo framing must match both video exports.
- Custom voices use only the organization credential in org_voice_credentials, AES-GCM encrypted with ORG_CREDENTIAL_ENCRYPTION_KEY and org_id as authenticated data; server-only table access follows caller membership/ownership checks. Owner-only settings use voice-connection.functions.ts; no shared connector fallback. Why: tenant billing and secret isolation; built-in voices remain unaffected.
