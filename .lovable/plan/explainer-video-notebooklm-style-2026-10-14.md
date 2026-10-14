# Explainer video (NotebookLM-style)

A new export, **Explainer video**, turns the whole course into a short video that teaches the material, separate from the narrated slideshow. AI writes it like a script, with a hook, the key ideas, a real-life scenario, and a recap. Then it's shown with moving illustrations, words that appear as the narrator speaks, simple diagrams, and quotes from the policy.

## What the user sees
1. On the course page, a new **Explainer video** button opens a short setup panel:
   - **Length:** about 2, 4 or 6 minutes.
   - **Tone:** friendly, formal or plain-spoken.
   - **Voice:** AI voice (same voices as today).
   - **Illustrations:** on or off. On means AI-drawn pictures in the brand colors, with a credit warning. Off uses icons and shapes only.
   - **Include my AI video clips:** reuses any scene clips already made.
2. **Write script.** AI creates 8–15 scenes. Each scene shows its narration text and the type of visual. The user can edit any scene's words, change its visual type, reorder scenes, or delete them before building.
3. **Build video.** Progress shows each step (voiceover, illustrations, rendering). The result is an MP4 to preview and download. It can also go into the SCORM package as a third choice: "Explainer video".
4. Like other exports, it needs the course to be approved first. The script is saved with the course, so you can make changes and build again without paying for it to be written again.

## Visual styles per scene
- **Title card:** big headline with an animated brand-gradient background.
- **Key points:** bullets appear one at a time as each is spoken.
- **Do / Don't:** two columns that fill in side by side.
- **Steps:** a numbered process path that lights up step by step.
- **Policy quote:** the exact policy wording with the section reference highlighted.
- **Big number / fact:** a large callout, for example "Report within 24 hours".
- **Illustration:** an AI picture that slowly zooms and pans, with a caption.
- **Scenario:** an illustration or video clip of the situation, followed by "What should you do?" and the answer.
- **Recap:** a checklist of what was learned.

Every scene uses the org's logo, colors and fonts, with smooth transitions and captions burned in (or as a separate captions file for SCORM).

## Limits
- Explainer scripts count toward the existing monthly AI generation limit.
- Illustrations are capped at 15 per video.

## Technical details
- `ai.functions.ts`: new `writeExplainerScript` (editor role, strict JSON schema: scenes[] with id, kind enum, narration, on-screen text fields, items[], quote + section, illustration_prompt) built from the course content and source policy, using the default chat model. New `makeIllustration` (editor role, default image model, flat-vector style in brand colors, no text in image, saved to private storage, cached per scene).
- `courses.content.explainer` holds the script plus illustration paths. Editing it does not reset approval of the slides, but a changed script needs a new build.
- `exports.ts`: new `encodeExplainerVideo` reuses the WebCodecs + mp4-muxer pipeline and the voiceover cache. Each scene kind is a canvas draw function `(ctx, t, scene, brand)` animated over time at 30 fps. Word reveal timing comes from the narration length per item. Ken Burns on illustrations; 0.5s crossfades. Falls back to MediaRecorder like the existing video.
- SCORM dialog gets a third option that packages the explainer MP4 with the same player, progress tracking and quiz.
- New UI: an Explainer panel/dialog in `courses.$courseId.tsx` with a scene list editor.
- Tests: scene timing (item reveal times add up to narration length) and script schema validation. User guide gets a new section.
