import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VOICE_CHOICES, voiceLabel, type ExplainerScene } from "@/lib/course";

export function ExplainerAudio({ scene, url, editable, brandVoice, onChange, onUpload }: {
  scene: ExplainerScene; url: string | null | undefined; editable: boolean; brandVoice: string;
  onChange: (p: Partial<ExplainerScene>) => void; onUpload: (file: File) => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  return (
    <div className="space-y-2">
      <Label className="text-xs">Voiceover</Label>
      <Select value={scene.voice_path ? "uploaded" : "ai"} disabled={!editable || uploading} onValueChange={(value) => { if (value === "ai") onChange({ voice_path: null }); }}>
        <SelectTrigger aria-label="Scene voiceover source"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="ai">AI voice</SelectItem>{scene.voice_path && <SelectItem value="uploaded">My uploaded audio</SelectItem>}</SelectContent>
      </Select>
      {!scene.voice_path && <Select value={scene.voice || "brand"} disabled={!editable || uploading} onValueChange={(value) => onChange({ voice: value === "brand" ? null : value })}>
        <SelectTrigger aria-label="AI voice for this scene"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="brand">Voice: {voiceLabel(brandVoice)} (brand kit)</SelectItem>{VOICE_CHOICES.map((v) => <SelectItem key={v} value={v}>{voiceLabel(v)}</SelectItem>)}</SelectContent>
      </Select>}
      {url && scene.voice_path && <audio controls src={url} className="h-10 w-full" aria-label="Uploaded scene audio" />}
      {editable && <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" asChild><label className={uploading ? "pointer-events-none opacity-50" : "cursor-pointer"}>
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />} {uploading ? "Uploading audio…" : scene.voice_path ? "Replace audio" : "Upload my audio"}
          <input type="file" accept="audio/*" className="hidden" disabled={uploading} onChange={async (e) => {
            const file = e.target.files?.[0]; e.target.value = "";
            if (!file) return;
            setUploading(true);
            try { await onUpload(file); } finally { setUploading(false); }
          }} />
        </label></Button>
        {scene.voice_path && <Button size="sm" variant="ghost" disabled={uploading} onClick={() => onChange({ voice_path: null })}>Remove audio</Button>}
      </div>}
    </div>
  );
}