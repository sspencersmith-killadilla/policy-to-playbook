const GATEWAY = "https://ai.gateway.lovable.dev/v1";
export const TEXT_MODEL = "openai/gpt-6-astra";
export const TTS_MODEL = "google/gemini-3.1-flash-tts-preview";

export class AiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function key() {
  const k = process.env["LOVABLE_API_KEY"];
  if (!k) throw new AiError("AI is not configured.", 401);
  return k;
}

async function failure(res: Response): Promise<never> {
  const text = await res.text().catch(() => "");
  console.error(`AI gateway error [${res.status}]: ${text}`);
  let msg = "The AI request failed.";
  try {
    const j = JSON.parse(text);
    msg = j?.error?.message || j?.message || msg;
  } catch {}
  if (res.status === 402) msg = "Your workspace is out of AI credits. Add credits to continue.";
  if (res.status === 429) msg = "Too many AI requests right now. Please wait a minute and try again.";
  throw new AiError(msg, res.status);
}

/** Streams a Responses call with a strict JSON schema and returns the parsed object. */
export async function structuredResponse<T>(opts: {
  instructions: string;
  content: Record<string, unknown>[];
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const res = await fetch(`${GATEWAY}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key(), "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: TEXT_MODEL,
      instructions: opts.instructions,
      input: [{ role: "user", content: opts.content }],
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name: opts.schemaName, strict: true, schema: opts.schema } },
    }),
  });
  if (!res.ok || !res.body) await failure(res);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let out = "";
  let finalText: string | null = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let evt: any;
      try { evt = JSON.parse(data); } catch { continue; }
      if (evt.type === "response.output_text.delta") out += evt.delta ?? "";
      else if (evt.type === "response.output_text.done" && typeof evt.text === "string") finalText = evt.text;
      else if (evt.type === "response.failed" || evt.type === "error") {
        const m = evt.response?.error?.message || evt.error?.message || evt.message || "The AI could not finish.";
        throw new AiError(m, 500);
      } else if (evt.type === "response.refusal.delta" || evt.type === "response.refusal.done") {
        throw new AiError("The AI declined to process this document.", 422);
      }
    }
  }
  const text = finalText ?? out;
  if (!text.trim()) throw new AiError("The AI returned an empty result.", 502);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AiError("The AI returned an unreadable result. Please try again.", 502);
  }
}

/** Returns a complete WAV file (base64) for the given narration text. */
export async function synthesizeSpeech(text: string, voice: string): Promise<string> {
  const res = await fetch(`${GATEWAY}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL,
      contents: [{ role: "user", parts: [{ text: `Read this clearly at a natural pace: ${text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
      stream_format: "audio",
    }),
  });
  if (!res.ok) await failure(res);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return toBase64(bytes);
}

export function toBase64(bytes: Uint8Array) {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

export const VIDEO_MODEL = "google/gemini-omni-1.1-flash";

export type VideoJob = { id: string; status: string; progress?: number; error?: { code: string; message: string } };

async function videoJson(res: Response): Promise<VideoJob> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    console.error(`Video gateway error [${res.status}]`, body);
    let msg = body?.message ?? `Video request failed (${res.status})`;
    if (res.status === 429) msg = "A clip is already generating or the limit was reached. Wait for it to finish, then try again.";
    throw new AiError(msg, res.status);
  }
  return (await res.json()) as VideoJob;
}

export async function createClipJob(prompt: string) {
  return videoJson(
    await fetch(`${GATEWAY}/videos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VIDEO_MODEL,
        input: `${prompt}. Realistic, professional workplace training footage with natural lighting, in a single continuous shot, no scene cuts. Consider micro-detail, expression and timing. Audio: soft ambient room tone and a light, calm background music bed. No dialogue. No captions, no on-screen text.`,
        response_format: { type: "video", resolution: "720p", duration: "6s", aspect_ratio: "16:9" },
      }),
    }),
  );
}

export async function pollClipJob(id: string) {
  return videoJson(await fetch(`${GATEWAY}/videos/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key()}` } }));
}

export async function downloadClip(id: string) {
  const res = await fetch(`${GATEWAY}/videos/${encodeURIComponent(id)}/content`, { headers: { Authorization: `Bearer ${key()}` } });
  if (!res.ok) throw new AiError(`Could not download the clip (${res.status})`, res.status);
  return new Uint8Array(await res.arrayBuffer());
}

export const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";

/** Generates one 3:2 illustration and returns the finished PNG bytes. */
export async function generateIllustration(prompt: string): Promise<Uint8Array> {
  const res = await fetch(`${GATEWAY}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: IMAGE_MODEL, prompt, size: "1536x1024", quality: "medium", stream: true }),
  });
  if (!res.ok || !res.body) await failure(res);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let b64: string | null = null;
  let err: AiError | null = null;
  const handle = (line: string) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    let evt: any;
    try { evt = JSON.parse(data); } catch { return; }
    if (evt.type === "image_generation.completed" && evt.b64_json) b64 = evt.b64_json;
    else if (evt.type === "error" || evt.error) {
      const code = evt.error?.code ?? "";
      err = new AiError(
        /content_policy|moderation/.test(code) ? "The picture was blocked by safety filters. Try describing it differently." : evt.error?.message ?? "The picture could not be made.",
        /content_policy|moderation/.test(code) ? 400 : 502,
      );
    }
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) { handle(buf.slice(0, idx).trim()); buf = buf.slice(idx + 1); }
  }
  handle(buf.trim());
  if (err) throw err;
  if (!b64) throw new AiError("The picture could not be made. Please try again.", 502);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// ---- Custom (cloned) voices via the organization's own ElevenLabs account ----
const ELEVEN = "https://api.elevenlabs.io/v1";
async function elevenFailure(res: Response): Promise<never> {
  const text = await res.text().catch(() => "");
  console.error(`ElevenLabs request failed [${res.status}]`);
  let msg = "The voice service request failed.";
  let missingPermissions = false;
  try { const j = JSON.parse(text); missingPermissions = j?.detail?.status === "missing_permissions"; } catch {}
  if (res.status === 401 || res.status === 403) msg = missingPermissions ? "The ElevenLabs key needs Voices: Read and Write, and Text to Speech access. An owner can update the key in Brand kit." : "ElevenLabs did not accept the key. An owner can replace it in Brand kit.";
  if (res.status === 402) msg = "The voice-cloning account is out of credits or its plan doesn't include voice cloning.";
  if (res.status === 429) msg = "The voice service is busy. Please wait a minute and try again.";
  throw new AiError(typeof msg === "string" ? msg : "The voice service request failed.", res.status);
}
export async function cloneVoice(name: string, sample: Blob, filename: string, apiKey: string): Promise<string> {
  const fd = new FormData();
  fd.append("name", name);
  fd.append("files", sample, filename);
  fd.append("remove_background_noise", "true");
  const res = await fetch(`${ELEVEN}/voices/add`, { method: "POST", headers: { "xi-api-key": apiKey }, body: fd });
  if (!res.ok) await elevenFailure(res);
  const j = (await res.json()) as { voice_id: string };
  return j.voice_id;
}
export async function deleteClonedVoice(id: string, apiKey: string) {
  const res = await fetch(`${ELEVEN}/voices/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "xi-api-key": apiKey } });
  if (!res.ok && res.status !== 404) await elevenFailure(res);
}
/** Returns MP3 bytes as base64 (browsers decode MP3 the same way as WAV). */
export async function synthesizeCustomSpeech(text: string, voiceId: string, apiKey: string): Promise<string> {
  const res = await fetch(`${ELEVEN}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.55, similarity_boost: 0.8, use_speaker_boost: true } }),
  });
  if (!res.ok) await elevenFailure(res);
  return toBase64(new Uint8Array(await res.arrayBuffer()));
}
