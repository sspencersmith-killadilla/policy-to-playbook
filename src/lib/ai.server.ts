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
      contents: [{ role: "user", parts: [{ text: `Read in a clear, warm, professional training-narrator voice: ${text}` }] }],
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
