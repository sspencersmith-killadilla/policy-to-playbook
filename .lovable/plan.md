# Play AI clips once, then hand off to a matching slide

## What changes
When a scene's AI clip is shorter than its voiceover, the clip plays once and stops looping. Then the video moves smoothly to an animated slide for the rest of that scene. The slide shows the scene's on-screen words (key points, steps, quote or headline), so the narration keeps going over a visual that backs it up.

- **Explainer videos (MP4 and SCORM):** the clip plays to its end, then a short crossfade or zoom brings in the scene's animated card in brand colors. Its words build in time with the rest of the narration.
- **Narrated slideshow video:** the clip plays once, then the slide itself appears for the rest of that slide's audio. Nothing repeats.
- If the clip is longer than the narration, nothing changes: it's trimmed as it is today.
- A very short leftover gap (under about 1 second) holds the clip's last frame instead of flashing a slide.
- If a footage scene has no on-screen words, the follow-up slide uses the scene title plus a short line taken from the narration.

## Technical details
- `src/lib/explainer.ts`: pure helper `clipHandoff(sceneDur, clipDur)` that returns `{ clipEnd, handoffStart, mode: "none" | "hold" | "slide" }`, with a 1 s threshold and a 0.5 s transition. Unit tests go in `src/test/explainer.test.ts`.
- `src/lib/explainer-render.ts`:
  - Offline encode: replace the modulo seek (`% clip.duration`) with `min(local, clipDur - 0.01)`.
  - Draw path: after `handoffStart`, render the scene's animated (non-footage) layout, timed from the handoff point, with a crossfade.
  - Real-time fallback: remove `clip.loop = true` and use the same timing.
- `src/lib/exports.ts` (narrated slideshow): stop seeking or looping clips past their end, then draw the slide frame for the remaining time.
- Update the User guide's footage section with one line about this.
