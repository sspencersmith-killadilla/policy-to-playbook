import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mic, Square, Trash2, Upload, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/org";
import { useAuth } from "@/lib/auth";
import { canEdit } from "@/lib/course";
import { createOrgVoice, deleteOrgVoice, getVoiceCloningStatus, narrateText } from "@/lib/ai.functions";
import { useOrgVoices } from "@/lib/useOrgVoices";
import { customVoiceValue, MAX_ORG_VOICES, VOICE_CONSENT_TEXT, VOICE_READING_SCRIPT } from "@/lib/voices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CustomVoices() {
  const { current } = useOrg();
  const { user } = useAuth();
  const status = useServerFn(getVoiceCloningStatus);
  const create = useServerFn(createOrgVoice);
  const remove = useServerFn(deleteOrgVoice);
  const narrate = useServerFn(narrateText);
  const team = useOrgVoices();
  const enabledQ = useQuery({ queryKey: ["voice-cloning-status"], queryFn: () => status() });
  const editable = canEdit(current?.role);
  const isOwner = current?.role === "owner";

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [sample, setSample] = useState<{ blob: Blob; ext: string } | null>(null);
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    if (!sample) { setSampleUrl(null); return; }
    const u = URL.createObjectURL(sample.blob); setSampleUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [sample]);
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = mr.mimeType || "audio/webm";
        setSample({ blob: new Blob(chunks, { type }), ext: type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm" });
      };
      rec.current = mr; setSeconds(0); mr.start(); setRecording(true);
    } catch { toast.error("Could not use your microphone. Check your browser's permission."); }
  }
  function stopRec() { rec.current?.stop(); setRecording(false); }

  async function submit() {
    if (!current || !sample) return;
    if (!consent) { toast.error("Please agree to the consent statement first."); return; }
    if (!name.trim()) { toast.error("Give your voice a name."); return; }
    setBusy(true);
    try {
      const path = `${current.org_id}/voice-samples/${crypto.randomUUID()}.${sample.ext}`;
      const up = await supabase.storage.from("documents").upload(path, sample.blob, { contentType: sample.blob.type || "audio/webm" });
      if (up.error) throw new Error(up.error.message);
      await create({ data: { orgId: current.org_id, name, samplePath: path, consented: consent } });
      toast.success("Your voice is ready. Pick it in any voice menu.");
      setOpen(false); setName(""); setConsent(false); setSample(null);
      team.refetch();
    } catch (e: any) { toast.error(e?.message ?? "Could not create the voice."); }
    finally { setBusy(false); }
  }

  async function preview(id: string) {
    if (!current) return;
    setPreviewing(id);
    try {
      const { wavBase64 } = await narrate({ data: { orgId: current.org_id, text: "Hello! This is how I sound reading your training.", voice: customVoiceValue(id) } });
      await new Audio(`data:audio/mpeg;base64,${wavBase64}`).play();
    } catch (e: any) { toast.error(e?.message ?? "Could not play the sample."); }
    finally { setPreviewing(null); }
  }
  async function del(id: string) {
    if (!confirm("Delete this voice? Slides that use it will go back to the brand kit voice.")) return;
    try { await remove({ data: { id } }); toast.success("Voice deleted"); team.refetch(); }
    catch (e: any) { toast.error(e?.message ?? "Could not delete the voice."); }
  }

  const enabled = enabledQ.data?.enabled;
  return (
    <div className="space-y-3 rounded-md border p-4">
      <div>
        <h2 className="font-semibold">Custom voices</h2>
        <p className="text-sm text-muted-foreground">Turn a team member's own voice into an AI voice for your training.</p>
      </div>
      {enabledQ.isLoading ? <Loader2 className="animate-spin" /> : !enabled ? (
        isOwner ? (
          <div className="space-y-2 rounded bg-muted p-3 text-sm">
            <p className="font-medium">Not set up yet. To turn it on:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Get a paid ElevenLabs plan with voice cloning (Starter or higher).</li>
              <li>In ElevenLabs: profile → API Keys → Create API key (allow Text to Speech and Voices), then copy it.</li>
              <li>In the Lovable editor chat, ask "connect ElevenLabs" and paste the key into the card that opens.</li>
            </ol>
            <a href="/guide#custom-voices" className="text-primary underline">Learn more</a>
          </div>
        ) : <p className="rounded bg-muted p-3 text-sm">Not set up yet. Ask an owner to set this up.</p>
      ) : (
        <>
          {team.voices.length === 0 && <p className="text-sm text-muted-foreground">No team voices yet.</p>}
          <ul className="space-y-2">
            {team.voices.map((v) => (
              <li key={v.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{v.name}<span className="block text-xs text-muted-foreground">{v.created_by_email ?? ""}</span></span>
                <Button size="icon" variant="ghost" aria-label={`Preview ${v.name}`} disabled={!!previewing} onClick={() => preview(v.id)}>{previewing === v.id ? <Loader2 className="animate-spin" /> : <Volume2 />}</Button>
                {(v.created_by === user?.id || isOwner) && <Button size="icon" variant="ghost" aria-label={`Delete ${v.name}`} onClick={() => del(v.id)}><Trash2 /></Button>}
              </li>
            ))}
          </ul>
          {editable && !open && team.voices.length < MAX_ORG_VOICES && <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Mic /> Create my voice</Button>}
          {team.voices.length >= MAX_ORG_VOICES && <p className="text-xs text-muted-foreground">Limit of {MAX_ORG_VOICES} voices reached.</p>}
          {open && (
            <div className="space-y-3 border-t pt-3">
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> {VOICE_CONSENT_TEXT}</label>
              <div className="space-y-1.5">
                <Label>1. Record 1–3 minutes reading this aloud (or upload a clip)</Label>
                <p className="max-h-32 overflow-auto rounded bg-muted p-2 text-xs leading-relaxed">{VOICE_READING_SCRIPT} {VOICE_READING_SCRIPT}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {recording
                    ? <Button size="sm" variant="destructive" onClick={stopRec}><Square /> Stop ({Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")})</Button>
                    : <Button size="sm" variant="outline" onClick={startRec} disabled={busy}><Mic /> Record</Button>}
                  <Button size="sm" variant="outline" asChild><label className="cursor-pointer"><Upload /> Upload audio
                    <input type="file" accept="audio/*" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0]; e.target.value = "";
                      if (!f) return;
                      if (f.size > 20 * 1024 * 1024) { toast.error("Audio must be under 20 MB."); return; }
                      setSample({ blob: f, ext: f.name.split(".").pop() || "mp3" });
                    }} /></label></Button>
                </div>
                {sampleUrl && <audio controls src={sampleUrl} className="h-10 w-full" />}
              </div>
              <div className="space-y-1.5"><Label>2. Name</Label><Input value={name} placeholder="e.g. Spencer Smith" onChange={(e) => setName(e.target.value)} /></div>
              <div className="flex gap-2">
                <Button size="sm" onClick={submit} disabled={busy || !sample || !consent || recording}>{busy && <Loader2 className="animate-spin" />} Create voice</Button>
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
