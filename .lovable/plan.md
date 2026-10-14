# Auto-write the scene clip prompt from each slide's narration

## What you'll get
- In the **AI scene clip** box on each slide, a new **Write prompt from narration** button.
- It reads the slide's narration (speaker notes), title, scenario text and bullets, and writes a ready-to-use scene description into the box. You can edit it before clicking **Generate clip**.
- The suggestion follows what works best for 6-second clips:
  - One moment, one place, one main action: who, where, what happens.
  - A single camera move (for example a slow push-in or a locked-off wide shot).
  - Shows the right behavior from the slide, or the situation the narration describes.
  - No speech, captions, signs, brand names, real people, injuries or violence, so safety filters don't block it.
  - Neutral, inclusive casting and a realistic workplace that fits the audience.
- Writing a suggestion uses very few AI credits and does not make a video. Credits for a clip are only used when you click **Generate clip**.
- **Write prompts for all scenario slides** button in the editor: fills in a suggested prompt on every scenario slide that doesn't have one yet, so you only need to review them and generate.
- The user guide's clip section explains the new buttons.

## Technical details
- New `suggestClipPrompt` server function in `ai.functions.ts` (editor check, same pattern as `regenerateSlide`). It calls `structuredResponse` with the existing text model, a strict schema `{ prompt: string }`, and instructions holding the clip prompting rules above (40-90 words, one shot, no on-screen text or dialogue). Optional course audience/title as context.
- It accepts one slide or a batch (up to 18 slides) in one call, returning `{ id, prompt }[]` so "all scenario slides" uses a single request.
- `SceneClip` in `courses.$courseId.tsx`: button fills the textarea; stores the result in `clip_prompt` through the existing autosave.
- `createClipJob` wrapper (realism, continuous shot, ambient audio, no text) stays as is.
- Counts toward the existing monthly generation limit? No: it's a light text call, so it gets no separate cap.
