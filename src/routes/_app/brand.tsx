import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, logAudit } from "@/lib/org";
import { canEdit, FONT_CHOICES, VOICE_CHOICES, voiceLabel, type Brand, type Slide } from "@/lib/course";
import { ScaledSlide, useBrandFonts } from "@/components/SlideView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/brand")({
  head: () => ({
    meta: [
      { title: "Brand kit — Relay" },
      { name: "description", content: "Set your organization's logo, colors, fonts and narrator voice." },
      { property: "og:title", content: "Brand kit — Relay" },
      { property: "og:description", content: "Logo, colors, fonts and voice for every course." },
    ],
  }),
  component: BrandPage,
});

const sample: Slide[] = [
  { id: "a", layout: "title", title: "Code of Conduct", subtitle: "How we work together", bullets: [], body: null, notes: "", source: "" },
  { id: "b", layout: "bullets", title: "Speak up safely", subtitle: null, bullets: ["Report concerns to your manager or HR", "Retaliation is never allowed", "Anonymous reporting is available"], body: null, notes: "", source: "Section 2" },
];

function BrandPage() {
  const { current, brand } = useOrg();
  const qc = useQueryClient();
  const [b, setB] = useState<Brand>(brand);
  useEffect(() => setB(brand), [brand]);
  useBrandFonts(b);
  const editable = canEdit(current?.role);
  const set = (p: Partial<Brand>) => setB((x) => ({ ...x, ...p }));

  function onLogo(f?: File) {
    if (!f) return;
    if (f.size > 400 * 1024) { toast.error("Logo must be under 400KB."); return; }
    const r = new FileReader();
    r.onload = () => set({ logo_url: r.result as string });
    r.readAsDataURL(f);
  }
  async function save() {
    const { error } = await supabase.from("brand_kits").update({ ...b, updated_at: new Date().toISOString() }).eq("org_id", current!.org_id);
    if (error) { toast.error(error.message); return; }
    await logAudit(current!.org_id, "brand.updated");
    qc.invalidateQueries({ queryKey: ["brand", current!.org_id] });
    toast.success("Brand kit saved");
  }
  const color = (k: keyof Brand, label: string) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <input type="color" disabled={!editable} value={b[k] as string} onChange={(e) => set({ [k]: e.target.value } as Partial<Brand>)} className="h-9 w-12 cursor-pointer rounded border" />
        <Input disabled={!editable} value={b[k] as string} onChange={(e) => set({ [k]: e.target.value } as Partial<Brand>)} />
      </div>
    </div>
  );

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-8 py-10 lg:grid-cols-[360px_1fr]">
      <div className="space-y-5">
        <h1 className="text-4xl font-semibold">Brand kit</h1>
        <div className="space-y-1.5">
          <Label>Logo</Label>
          <Input type="file" accept="image/png,image/jpeg,image/svg+xml" disabled={!editable} onChange={(e) => onLogo(e.target.files?.[0])} />
          {b.logo_url && <Button size="sm" variant="ghost" onClick={() => set({ logo_url: null })}>Remove logo</Button>}
        </div>
        {color("primary_color", "Primary color")}
        {color("accent_color", "Accent color")}
        {color("background_color", "Background")}
        {color("text_color", "Text")}
        {(["heading_font", "body_font"] as const).map((k) => (
          <div key={k} className="space-y-1.5">
            <Label>{k === "heading_font" ? "Heading font" : "Body font"}</Label>
            <Select value={b[k]} disabled={!editable} onValueChange={(v) => set({ [k]: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FONT_CHOICES.map((f) => <SelectItem key={f} value={f}>{voiceLabel(f)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ))}
        <div className="space-y-1.5">
          <Label>Narrator voice</Label>
          <Select value={b.voice} disabled={!editable} onValueChange={(v) => set({ voice: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{VOICE_CHOICES.map((f) => <SelectItem key={f} value={f}>{voiceLabel(f)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {editable && <Button onClick={save} className="w-full">Save brand kit</Button>}
      </div>
      <div className="space-y-6">
        {sample.map((s, i) => <ScaledSlide key={s.id} slide={s} brand={b} index={i} total={2} className="aspect-video w-full rounded-md border shadow-sm" />)}
      </div>
    </div>
  );
}
