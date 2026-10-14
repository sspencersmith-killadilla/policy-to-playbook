# Faster narrated video builds

## What you'll get
- Narrated video and SCORM video exports build several times faster than real time. A 10-minute course takes about 1-3 minutes instead of 10.
- The tab can be in the background or minimized while it builds; it just can't be closed. A notice appears when the build is done.
- The video is saved as **MP4**, which plays everywhere, including PowerPoint, phones and every LMS. Today's file is WebM.
- Quality is the same or better: no dropped frames, sharp slides, the same voice and clips. A **Full HD (1080p)** option is added; 720p stays the default for smaller files.
- Browsers that can't use the faster method (some older ones) fall back automatically to today's real-time recording, with a message saying so.
- The export window shows the time remaining. The User guide is updated.

## Later option (not in this plan)
- Rendering in the background on a server so you can close the tab entirely. This needs a paid outside video service (roughly $0.10-$0.50 per video minute). We can add it once you pick a provider.

## Technical details
- New `encodeNarratedVideo` in `exports.ts` uses WebCodecs (`VideoEncoder` H.264 + `AudioEncoder` AAC) with the `mp4-muxer` package. It builds the timeline offline:
  - Slide images are encoded as frames at 30 fps (at about 2 fps for static stretches, with keyframes per slide).
  - Narration WAVs are decoded and mixed into one `OfflineAudioContext` buffer, then encoded.
  - Scene clips are decoded frame by frame by seeking a hidden `<video>` with `requestVideoFrameCallback`. Their audio is taken with `decodeAudioData` on the clip file.
- It returns the same `RecordedVideo` shape (blob, chapters, duration), so both the SCORM video mode and the plain video export use it unchanged.
- Feature-detects `VideoEncoder.isConfigSupported`; otherwise it calls the existing `recordNarratedVideo`.
- Resolution choice (720p/1080p) is passed to `renderSlideImages` and the encoder; the SCORM size estimate is updated.
