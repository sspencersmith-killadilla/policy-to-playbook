import { useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { normalizePhotoFrame, photoCoverRect, type PhotoFrame } from "@/lib/explainer";

export function PhotoFraming({ url, frame, disabled, onChange }: { url: string; frame?: PhotoFrame | null; disabled: boolean; onChange: (frame: PhotoFrame) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const source = useRef<HTMLCanvasElement>(null);
  const f = normalizePhotoFrame(frame);
  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const ctx = canvas.current?.getContext("2d");
      const sourceCanvas = source.current;
      const sourceCtx = sourceCanvas?.getContext("2d");
      if (ctx) {
        const r = photoCoverRect(image.naturalWidth, image.naturalHeight, 640, 360, f);
        ctx.clearRect(0, 0, 640, 360);
        ctx.drawImage(image, r.x, r.y, r.width, r.height);
      }
      if (sourceCanvas && sourceCtx) {
        sourceCanvas.height = Math.round(640 * image.naturalHeight / image.naturalWidth);
        sourceCtx.drawImage(image, 0, 0, 640, sourceCanvas.height);
        const color = getComputedStyle(sourceCanvas).color;
        sourceCtx.strokeStyle = color;
        sourceCtx.lineWidth = 5;
        sourceCtx.beginPath();
        sourceCtx.arc(f.x * 640, f.y * sourceCanvas.height, 14, 0, Math.PI * 2);
        sourceCtx.stroke();
        sourceCtx.beginPath();
        sourceCtx.moveTo(f.x * 640 - 22, f.y * sourceCanvas.height);
        sourceCtx.lineTo(f.x * 640 + 22, f.y * sourceCanvas.height);
        sourceCtx.moveTo(f.x * 640, f.y * sourceCanvas.height - 22);
        sourceCtx.lineTo(f.x * 640, f.y * sourceCanvas.height + 22);
        sourceCtx.stroke();
      }
    };
    image.src = url;
    return () => { cancelled = true; };
  }, [url, f.x, f.y, f.zoom]);

  return (
    <div className="space-y-3" aria-label="Photo framing">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Focal point</Label>
          <canvas ref={source} width={640} height={360} role="img" aria-label="Original photo focal point" className="w-full cursor-crosshair rounded border text-highlight" onPointerDown={(e) => {
            if (disabled) return;
            const r = e.currentTarget.getBoundingClientRect();
            onChange(normalizePhotoFrame({ ...f, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }));
          }} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Video crop</Label>
          <canvas ref={canvas} width={640} height={360} role="img" aria-label="Photo video crop preview" className="aspect-video w-full rounded border" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2"><Label className="text-xs">Horizontal focal point</Label><Slider aria-label="Horizontal focal point" min={0} max={100} step={1} value={[Math.round(f.x * 100)]} disabled={disabled} onValueChange={([x]) => { if (x !== undefined) onChange({ ...f, x: x / 100 }); }} /></div>
        <div className="space-y-2"><Label className="text-xs">Vertical focal point</Label><Slider aria-label="Vertical focal point" min={0} max={100} step={1} value={[Math.round(f.y * 100)]} disabled={disabled} onValueChange={([y]) => { if (y !== undefined) onChange({ ...f, y: y / 100 }); }} /></div>
      </div>
      <div className="flex items-center gap-3">
        <Label className="shrink-0 text-xs">Zoom {f.zoom.toFixed(2)}×</Label>
        <Slider aria-label="Photo zoom" min={1} max={3} step={0.05} value={[f.zoom]} disabled={disabled} onValueChange={([zoom]) => { if (zoom !== undefined) onChange({ ...f, zoom }); }} />
        <Button variant="ghost" size="icon" disabled={disabled} title="Reset photo framing" aria-label="Reset photo framing" onClick={() => onChange({ x: 0.5, y: 0.5, zoom: 1 })}><RotateCcw /></Button>
      </div>
    </div>
  );
}