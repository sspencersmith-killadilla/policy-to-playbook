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
- Exports (PPTX, SCORM, PDF print, narrated video via MediaRecorder) run in the browser in src/lib/exports.ts. Why: the server runtime cannot run FFmpeg or long jobs.
- Exports require course status "approved"; any edit resets to draft. Why: human review before distribution.
