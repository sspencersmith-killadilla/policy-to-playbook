# Explainer videos that look like real video

Each explainer gets a **Video style** choice in the Explainer video window:
- **Animated** (default) — professional motion graphics, no extra AI cost.
- **AI footage** — each scene becomes a short AI video clip of a workplace moment, with on-screen words layered on top.

Per scene you can also override the style (e.g. animated key points, AI footage for the scenario). No presenter on screen; voice only.

## Animated style (what changes on screen)
- Smooth camera motion on every scene: slow push-in / drift (no static frames).
- Text builds in word-by-word or line-by-line, timed to the narration.
- Key points, steps and Do/Don't items slide and pop in one at a time with eased motion, check marks draw themselves.
- Big numbers count up; policy quotes type out with a highlight sweep.
- Pictures and photos get a gentle pan-and-zoom (respecting your saved focal point).
- Animated brand-colored backgrounds (moving gradient shapes) instead of flat fills.
- Scene changes use transitions (wipe, slide, cross-fade) instead of hard cuts.
- Lower-third scene labels and a progress bar in brand colors.
- Optional soft background music bed, ducked under the voice (on/off toggle).
- Video renders at full frame rate (30 fps) so motion is smooth.

## AI footage style
- "Make footage" creates a clip for each scene from a prompt written from its narration (reuses the existing clip-prompt rules: one workplace moment, no text/logos).
- Clips loop or slow down to fill the narration; key words and captions animate over them.
- Uses the existing AI clip allowance (20 per 30 days); the window shows how many scenes need clips and how many you have left before you start. Scenes without a clip fall back to Animated.
- You can still upload your own photo/video per scene instead.

## Also
- The closing "Thank you for watching" scene gets the same animation.
- Works for both MP4 download and SCORM package.
- User guide updated with the new styles.

## Technical details
- `courses.content.explainer` gains `style: "animated" | "footage"` and per-scene `style?` + `clip_path?`; saving doesn't reset approval (existing rule).
- `explainer-render.ts`: add a time-based animation layer (easing helpers, per-element entry times from narration timing, transitions between scenes, Ken Burns on images, animated backgrounds); render all scenes at 30 fps in the WebCodecs path. Pure timing/easing helpers go in `explainer.ts` with tests.
- Word timing estimated from narration length per scene (no extra AI call).
- Footage: new `suggestExplainerClipPrompts` + reuse existing clip generation server function in `ai.functions.ts` (editor role, clip cap enforced server-side); clips stored in org-scoped storage like slide clips.
- Music: a few bundled royalty-free loops mixed via the existing OfflineAudioContext at low volume with ducking.
- Tests: easing/timing helpers, style fallback when a clip is missing, clip-cap check.
