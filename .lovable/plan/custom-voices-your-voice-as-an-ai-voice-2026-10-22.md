# Custom voices ("Your voice as an AI voice")

Build the full voice-cloning feature now, but leave it switched off until someone connects a voice-cloning account (ElevenLabs). Once it's connected, any team member can choose to turn their own voice into an AI voice for their org.

## What people will see

**Before it's set up**
- A new "Custom voices" section on the Brand kit page says: "Not set up yet — an owner can connect a voice-cloning account to turn this on." Nothing else changes; the 12 built-in voices keep working.

**After it's set up**
- **Create my voice** (any owner or editor, for themselves only):
  1. Read a short consent statement and tick "I agree my voice can be used for this organization's training."
  2. Record 1–3 minutes in the browser (a reading script is shown) or upload an audio file.
  3. Name it (e.g. "Spencer Smith"), then Create. Takes under a minute.
- The new voice appears in every voice menu — brand kit, each slide, each explainer scene — under a "Your team's voices" heading.
- **Preview** button plays a sample sentence.
- **Delete my voice**: the owner of the voice (or an org owner) can remove it any time; it's deleted from the voice service too. Slides that used it fall back to the brand kit voice.
- Each voice records who made it and when they consented; creation and deletion show up in the Activity log.

**Limits**
- Up to 10 custom voices per organization.
- Voiceovers using custom voices count toward the voice service's own monthly allowance, billed by that service.

## How to turn it on later
An owner asks to "connect ElevenLabs" in Lovable chat (needs a paid ElevenLabs plan with voice cloning, about $5–22/month). Nothing else is needed.

## Technical details
- New table `org_voices` (org_id, created_by, name, provider_voice_id, consent_text, consented_at, sample_path) with RLS: members read; insert only as self with editor role; delete by creator or org owner.
- `ai.server.ts`: `voiceCloningEnabled()` checks `ELEVENLABS_API_KEY`; `cloneVoice(samples)` → POST `/v1/voices/add`; `deleteClonedVoice(id)`; `synthesizeCustomSpeech(text, voiceId)` → `/v1/text-to-speech/{id}` (eleven_multilingual_v2, MP3 converted/returned so existing WAV pipeline decodes it).
- `ai.functions.ts`: `getVoiceCloningStatus`, `createOrgVoice`, `deleteOrgVoice`, `previewOrgVoice`; `narrateText` routes voice values prefixed `custom:<org_voice_id>` to ElevenLabs after verifying the voice belongs to the caller's org. Cache key keeps using voice+text so the existing cache works.
- Voice pickers (brand, slide, ExplainerAudio) merge built-in `VOICE_CHOICES` with org voices; unknown/deleted custom voices fall back to brand voice.
- Samples stored in the private documents bucket under `{org_id}/voice-samples/`.
- Errors: missing key → "Custom voices aren't set up"; provider 401/402/429 surfaced with plain messages; no automatic retries except 429/5xx (existing rule).
- Tests: custom-voice fallback when deleted; limit of 10 per org; consent required before creation.
- User guide gains a "Custom voices" section.
