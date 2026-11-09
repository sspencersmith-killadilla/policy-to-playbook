import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg, logAudit } from "@/lib/org";
import { BRAND_SLOTS, canEdit, DEFAULT_BRAND, FONT_CHOICES, VOICE_CHOICES, voiceLabel, type Brand, type BrandSlot, type Slide } from "@/lib/course";
import { CustomVoices } from "@/components/CustomVoices";
import { useOrgVoices } from "@/lib/useOrgVoices";
import { customVoiceValue } from "@/lib/voices";
import { SelectGroup, SelectLabel } from "@/components/ui/select";
import { ScaledSlide, useBrandFonts } from "@/components/SlideView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/brand")({
  head: () => ({
    meta: [
      { title: "Brand kits — Relay" },
      { name: "description", content: "Create four branded looks and choose one for each training course." },
      { property: "og:title", content: "Brand kits — Relay" },
      { property: "og:description", content: "Four logos, color palettes, fonts and narrator voices for your organization's courses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BrandPage,
});

const sample: Slide[] = [
  { id: "a", layout: "title", title: "Code of Conduct", subtitle: "How we work together", bullets: [], body: null, notes: "", source: "" },
  { id: "b", layout: "bullets", title: "Speak up safely", subtitle: null, bullets: ["Report concerns to your manager or HR", "Retaliation is never allowed", "Anonymous reporting is available"], body: null, notes: "", source: "Section 2" },
];

function BrandPage() {
  const { current, brandKits } = useOrg();
  const qc = useQueryClient();
  const [slot, setSlot] = useState<BrandSlot>("A");
  const kit = brandKits.find((k) => k.slot === slot) ?? brandKits[0];
  const [name, setName] = useState("Brand kit A");
  const [b, setB] = useState<Brand>(DEFAULT_BRAND);
  useEffect(() => {
    if (!kit) return;
    setB({ ...DEFAULT_BRAND, ...kit });
    setName(kit.name);
  }, [kit?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useBrandFonts(b);
  const editable = canEdit(current?.role);
  const team = useOrgVoices();
  const set = (p: Partial<Brand>) => setB((x) => ({ ...x, ...p }));

  function onLogo(f?: File) {
    if (!f) return;
    if (f.size > 400 * 1024) { toast.error("Logo must be under 400KB."); return; }
    const r = new FileReader();
    r.onload = () => set({ logo_url: r.result as string });
    r.readAsDataURL(f);
  }
  async function save() {
    if (!kit || !current) return;
    const cleanName = name.trim().slice(0, 60) || `Brand kit ${slot}`;
    const { error } = await supabase.from("brand_kits").update({ ...b, name: cleanName, updated_at: new Date().toISOString() }).eq("id", kit.id).eq("org_id", current.org_id);
    if (error) { toast.error(error.message); return; }
    setName(cleanName);
    await logAudit(current.org_id, "brand.updated", kit.id, { slot, name: cleanName });
    await qc.invalidateQueries({ queryKey: ["brand", current.org_id] });
    toast.success(`${cleanName} saved. Courses using it now have the updated look.`);
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
    <div className="mx-auto max-w-6xl px-8 py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold">Brand kits</h1>
        <p className="mt-2 text-muted-foreground">Set up four looks, then choose one on each course. Editing a kit updates only the courses that use it.</p>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BRAND_SLOTS.map((s) => {
            const option = brandKits.find((k) => k.slot === s);
            return <Button key={s} variant={slot === s ? "default" : "outline"} className="h-auto flex-col items-start px-4 py-3" onClick={() => setSlot(s)}><span className="text-xs opacity-75">Kit {s}</span><span className="max-w-full truncate font-medium">{option?.name ?? `Brand kit ${s}`}</span></Button>;
          })}
        </div>
      </div>
      <div className="grid gap-10 lg:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Kit name</Label>
            <Input value={name} maxLength={60} disabled={!editable} onChange={(e) => setName(e.target.value)} placeholder={`Brand kit ${slot}`} />
          </div>
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
                <SelectContent>{FONT_CHOICES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ))}
          <div className="space-y-1.5">
            <Label>Narrator voice</Label>
            <Select value={b.voice} disabled={!editable} onValueChange={(v) => set({ voice: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{team.voices.length > 0 && <SelectGroup><SelectLabel>Your team's voices</SelectLabel>{team.voices.map((v) => <SelectItem key={v.id} value={customVoiceValue(v.id)}>{v.name}</SelectItem>)}</SelectGroup>}<SelectGroup><SelectLabel>AI voices</SelectLabel>{VOICE_CHOICES.map((f) => <SelectItem key={f} value={f}>{voiceLabel(f)}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </div>
          {editable && <Button onClick={save} className="w-full">Save kit {slot}</Button>}
          <div className="border-t pt-5"><CustomVoices /></div>
        </div>
        <div className="space-y-6">
          {sample.map((s, i) => <ScaledSlide key={s.id} slide={s} brand={b} index={i} total={2} className="aspect-video w-full rounded-md border shadow-sm" />)}
        </div>
      </div>
    </div>
  );
}
