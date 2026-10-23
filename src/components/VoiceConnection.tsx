import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Loader2, Plug, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveVoiceConnection, testVoiceConnection, removeVoiceConnection } from "@/lib/voice-connection.functions";

export function VoiceConnection({ orgId, enabled, onChange }: { orgId: string; enabled: boolean; onChange: () => void }) {
  const [key, setKey] = useState("");
  const [editing, setEditing] = useState(!enabled);
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveVoiceConnection);
  const test = useServerFn(testVoiceConnection);
  const remove = useServerFn(removeVoiceConnection);
  async function action(kind: "save" | "test" | "remove") {
    if (kind === "remove" && !confirm("Remove your organization's ElevenLabs connection? Custom voices will be unavailable until an owner reconnects the same account. Existing voices will not be deleted.")) return;
    setBusy(true);
    const value = key;
    setKey("");
    try {
      if (kind === "save") await save({ data: { orgId, apiKey: value } });
      if (kind === "test") await test({ data: { orgId } });
      if (kind === "remove") await remove({ data: { orgId } });
      setEditing(kind === "remove");
      toast.success(kind === "remove" ? "ElevenLabs connection removed" : kind === "test" ? "ElevenLabs connection verified" : "ElevenLabs key securely saved");
      onChange();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update the connection."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3 border-b pb-4">
    <div className="flex items-center gap-2 text-sm font-medium"><Plug className="size-4" /> ElevenLabs · {enabled ? "Connected" : "Not connected"}</div>
    {enabled && <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => action("test")}><RefreshCw /> Test connection</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => { setKey(""); setEditing(!editing); }}><KeyRound /> Replace key</Button>
      <Button size="icon" variant="ghost" disabled={busy} aria-label="Remove ElevenLabs connection" title="Remove connection" onClick={() => action("remove")}><Trash2 /></Button>
    </div>}
    {editing && <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); action("save"); }}>
      <Label htmlFor="elevenlabs-key">ElevenLabs API key</Label>
      <Input id="elevenlabs-key" type="password" autoComplete="off" value={key} disabled={busy} onChange={(e) => setKey(e.target.value)} />
      <p className="text-xs text-muted-foreground">Encrypted and never shown again. Only used for this organization.</p>
      <p className="text-xs text-muted-foreground">In ElevenLabs → API Keys, allow Voices: Read and Write, and Text to Speech. Voice cloning requires a paid plan. Use the same account as your existing team voices.</p>
      <Button size="sm" type="submit" disabled={busy || !key.trim()}>{busy ? <Loader2 className="animate-spin" /> : <KeyRound />} Test & save key</Button>
    </form>}
  </div>;
}