# Fix slow SCORM video export and "AI request failed" error

## What's happening (so far)
- Before the video is built, the app asks the AI for each slide's voiceover, one slide at a time. That step is the slow part, and if any single slide's voiceover fails, the whole export stops with "The AI request failed."
- The AI request log for this project shows no recorded requests in the last 7 days, so the exact cause isn't confirmed yet. Step 1 finds it.

## What you'll get
1. **Find the real cause first**: run a SCORM video export signed in, read the server error for the failing voiceover, and fix that cause (for example an over-long slide script, a voice setting, or too many requests at once).
2. **Voiceovers saved and reused**: each slide's voiceover is saved after it's made. Exporting again, or exporting both the video and SCORM, reuses it instead of asking the AI again. A slide is only re-voiced when its script or voice changes. This makes repeat exports much faster.
3. **Several slides voiced at once**: up to 3 slides at a time instead of one by one.
4. **Automatic retry**: if a voiceover hits a temporary "busy" error, it waits and tries again up to 3 times before giving up.
5. **Clear error message**: if it still fails, the message names the slide ("Voiceover for slide 7 failed: ...") and the reason, so you can fix that slide. Slides that already worked are kept, so trying again picks up where it left off.
6. **Clearer progress**: the export window shows "Making voiceover 4 of 15", then "Building video", then "Packaging SCORM".

## Technical details
- Diagnose via server function logs for `narrateText` and a Playwright export run; fix the root cause found.
- Cache: store WAVs in the private `documents` bucket at `{org_id}/narration/{sha256(voice+text)}.wav`. `narrateText` checks for the file first, returns it if present, otherwise synthesizes and uploads. Member check stays.
- `encodeNarratedVideo` / `recordNarratedVideo`: replace the sequential loop with a concurrency-3 pool; per-slide error wraps the slide number.
- Retry only on 429/5xx with backoff (honor Retry-After); other errors stop immediately. No retry on 402/403.
- Add a small test for the cache key (same text+voice gives same key; different voice gives different key) and the retry rule (retries 429/503, not 400/402).
