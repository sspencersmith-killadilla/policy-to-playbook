# Narrated video option inside the SCORM package

## What you'll get
- Choosing **Export → SCORM 1.2 package** opens a small dialog with two choices:
  - **Slides** (current): learners click through slide images, then take the quiz.
  - **Narrated video**: learners watch the narrated video, including any AI scene clips, inside the LMS, then take the quiz.
- Video-mode player in the LMS:
  - Video player with play/pause, captions (built from the narration script), and a slide list beside it that jumps to each slide's point in the video.
  - **Require watching before the quiz** option, on by default: the quiz unlocks only after the learner reaches the end. Skipping ahead past unwatched parts is blocked while this is on.
  - Remembers where the learner stopped. If they leave and return, the video resumes there, using the LMS's saved progress.
  - Reports completion and the quiz score to the LMS, same as today.
- The export records the video in real time, like the Narrated video export: a 10-minute course takes about 10 minutes. Keep the tab open. Progress shows in the existing export window.
- Package size grows with the video (roughly 2-4 MB per minute). The dialog shows an estimate so admins can check their LMS upload limit.
- The User guide's export section explains the two options.

## Technical details
- `exportVideo` in `exports.ts` is refactored into `recordNarratedVideo(...)`, which returns `{ blob, ext, mime, chapters: { slideIndex, start, end }[] }` and does not download; the existing Narrated video export calls it and then downloads the result.
- `exportScorm` gains `mode: "slides" | "video"` and `requireFullView: boolean`. In video mode the zip contains `video.webm` (or `.mp4`), `captions.vtt` (cues from each slide's notes over its chapter time), and `chapters.json`. All files are listed in `imsmanifest.xml`.
- Player script: tracks the furthest position watched and blocks seeking past it while required; stores the position in `cmi.core.lesson_location` and the furthest position in `cmi.suspend_data`; sets `incomplete` until the quiz is passed, then `passed`/`failed` with `cmi.core.score.raw`. This matches current quiz logic.
- New `ScormOptionsDialog` in `courses.$courseId.tsx` feeds `run("scorm", opts)`; video mode renders slide images at 1280px, the same as the video export.
- Unchanged: the approval rule (export only when approved) and the slide-mode output.
