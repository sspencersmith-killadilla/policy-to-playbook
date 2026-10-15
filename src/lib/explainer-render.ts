// Browser-only renderer for the explainer video: animated canvas scenes + narration, encoded to MP4.
import type { Brand, ExplainerScene } from "./course";
import type { Chapter, RecordedVideo } from "./exports";
import { captionCues, cuesToVtt, revealTimes, sceneDuration, type Cue } from "./explainer";

export type ExplainerVideo = RecordedVideo & { vtt: string; titles: string[] };

type Assets = { pic: ImageBitmap | null; clip: HTMLVideoElement | null; clipAudio: AudioBuffer | null };

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const appear = (t: number, at: number, len = 0.5) => ease((t - at) / len);

function b64ToArrayBuffer(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function cover(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, W: number, H: number, zoom: number, panX: number) {
  const s = Math.max(W / sw, H / sh) * zoom;
  const w = sw * s, h = sh * s;
  ctx.drawImage(src, (W - w) / 2 + panX, (H - h) / 2, w, h);
}

class Painter {
  S: number;
  constructor(public ctx: CanvasRenderingContext2D, public W: number, public H: number, public brand: Brand, public logo: ImageBitmap | null, public burnCaptions: boolean) {
    this.S = W / 1280;
  }
  font(px: number, weight = 600, heading = true, italic = false) {
    const fam = heading ? this.brand.heading_font : this.brand.body_font;
    return `${italic ? "italic " : ""}${weight} ${Math.round(px * this.S)}px "${fam}", system-ui, sans-serif`;
  }
  bg(t: number) {
    const { ctx, W, H, S, brand } = this;
    ctx.fillStyle = brand.background_color;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = brand.primary_color;
    ctx.beginPath(); ctx.arc(W * 0.9 + Math.sin(t * 0.3) * 30 * S, H * 0.15, 260 * S, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = brand.accent_color;
    ctx.beginPath(); ctx.arc(W * 0.05, H * 0.95 + Math.cos(t * 0.25) * 25 * S, 220 * S, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  heading(text: string, t: number, y = 110, color = this.brand.primary_color) {
    const { ctx, S } = this;
    const a = appear(t, 0.1, 0.6);
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    ctx.font = this.font(50, 700);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    wrap(ctx, text, this.W - 200 * S).slice(0, 2).forEach((l, i) => ctx.fillText(l, 80 * S, (y + i * 58) * S + (1 - a) * 20 * S));
    ctx.globalAlpha = 1;
    return wrap(ctx, text, this.W - 200 * S).slice(0, 2).length;
  }
  logoMark() {
    if (!this.logo) return;
    const h = 40 * this.S, w = (this.logo.width / this.logo.height) * h;
    this.ctx.drawImage(this.logo, this.W - w - 40 * this.S, 36 * this.S, w, h);
  }
  textLines(text: string, x: number, y: number, maxW: number, px: number, color: string, maxLines = 3, heading = false, weight = 500) {
    const { ctx, S } = this;
    ctx.font = this.font(px, weight, heading);
    ctx.fillStyle = color;
    const lines = wrap(ctx, text, maxW).slice(0, maxLines);
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * px * 1.3 * S));
    return lines.length;
  }
  caption(cues: Cue[], gt: number) {
    if (!this.burnCaptions) return;
    const cue = cues.find((c) => gt >= c.start && gt < c.end);
    if (!cue) return;
    const { ctx, W, H, S } = this;
    ctx.font = this.font(24, 500, false);
    const lines = wrap(ctx, cue.text, W - 360 * S).slice(0, 2);
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 40 * S;
    const h = (lines.length * 32 + 20) * S;
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    rrect(ctx, (W - w) / 2, H - h - 28 * S, w, h, 10 * S); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.textAlign = "center";
    lines.forEach((l, i) => ctx.fillText(l, W / 2, H - h - 28 * S + (36 + i * 32) * S));
    ctx.textAlign = "left";
  }

  scene(sc: ExplainerScene, t: number, d: number, a: Assets) {
    const { ctx, W, H, S, brand } = this;
    const R = (n: number) => revealTimes(n, d);
    switch (sc.kind) {
      case "title": {
        const g = ctx.createLinearGradient(0, 0, W, H);
        const shift = (Math.sin(t * 0.4) + 1) / 2;
        g.addColorStop(0, brand.primary_color);
        g.addColorStop(0.55 + shift * 0.35, brand.accent_color);
        g.addColorStop(1, brand.primary_color);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        if (this.logo) { const h = 56 * S, w = (this.logo.width / this.logo.height) * h; ctx.drawImage(this.logo, 80 * S, 64 * S, w, h); }
        const k = appear(t, 0.2, 0.8);
        ctx.globalAlpha = k; ctx.textAlign = "center";
        ctx.font = this.font(68, 700);
        ctx.fillStyle = brand.background_color;
        const lines = wrap(ctx, sc.heading, W - 240 * S).slice(0, 3);
        const top = H / 2 - ((lines.length - 1) * 80 * S) / 2 - 10 * S;
        lines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * 80 * S + (1 - k) * 30 * S));
        if (sc.items[0]) { ctx.globalAlpha = appear(t, 1, 0.8) * 0.9; ctx.font = this.font(30, 500, false); ctx.fillText(sc.items[0], W / 2, top + lines.length * 80 * S + 20 * S); }
        ctx.globalAlpha = 1; ctx.textAlign = "left";
        return;
      }
      case "points":
      case "recap": {
        this.bg(t); this.logoMark();
        const hl = this.heading(sc.heading, t);
        const items = sc.items.slice(0, 5), rt = R(items.length);
        const y0 = (110 + hl * 58 + 30) * S, rowH = Math.min(96 * S, (H - y0 - 110 * S) / Math.max(1, items.length));
        items.forEach((it, i) => {
          const k = appear(t, rt[i]!);
          if (k <= 0) return;
          const y = y0 + i * rowH;
          ctx.globalAlpha = k;
          ctx.fillStyle = "#ffffff";
          rrect(ctx, 80 * S + (1 - k) * 40 * S, y, W - 160 * S, rowH - 14 * S, 14 * S); ctx.fill();
          const cx = 120 * S + (1 - k) * 40 * S, cy = y + (rowH - 14 * S) / 2;
          ctx.fillStyle = sc.kind === "recap" ? brand.accent_color : brand.primary_color;
          ctx.beginPath(); ctx.arc(cx, cy, 20 * S, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = brand.background_color; ctx.fillStyle = brand.background_color; ctx.lineWidth = 4 * S;
          if (sc.kind === "recap") {
            const p = appear(t, rt[i]! + 0.2, 0.4);
            ctx.beginPath(); ctx.moveTo(cx - 9 * S, cy); ctx.lineTo(cx - 9 * S + 6 * S * Math.min(1, p * 2), cy + 7 * S * Math.min(1, p * 2));
            if (p > 0.5) ctx.lineTo(cx - 3 * S + 13 * S * (p - 0.5) * 2, cy + 7 * S - 15 * S * (p - 0.5) * 2);
            ctx.stroke();
          } else { ctx.font = this.font(20, 700); ctx.textAlign = "center"; ctx.fillText(String(i + 1), cx, cy + 7 * S); ctx.textAlign = "left"; }
          ctx.font = this.font(28, 500, false);
          ctx.fillStyle = brand.text_color;
          const ls = wrap(ctx, it, W - 320 * S).slice(0, 2);
          ls.forEach((l, j) => ctx.fillText(l, cx + 44 * S, cy + 10 * S - ((ls.length - 1) * 17 * S) + j * 34 * S));
          ctx.globalAlpha = 1;
        });
        return;
      }
      case "dodont": {
        this.bg(t); this.logoMark();
        const hl = this.heading(sc.heading, t);
        const cols = [{ label: "Do", items: sc.items.slice(0, 4), color: brand.accent_color, mark: "✓" }, { label: "Don't", items: sc.items2.slice(0, 4), color: "#b42318", mark: "✕" }];
        const total = cols[0]!.items.length + cols[1]!.items.length;
        const rt = R(total + 2);
        const y0 = (110 + hl * 58 + 30) * S, cw = (W - 200 * S) / 2;
        let n = 1;
        cols.forEach((c, ci) => {
          const x = 80 * S + ci * (cw + 40 * S);
          const k = appear(t, rt[0]!);
          ctx.globalAlpha = k;
          ctx.fillStyle = c.color;
          rrect(ctx, x, y0, cw, 64 * S, 12 * S); ctx.fill();
          ctx.fillStyle = "#ffffff"; ctx.font = this.font(30, 700);
          ctx.fillText(`${c.mark}  ${c.label}`, x + 24 * S, y0 + 43 * S);
          ctx.globalAlpha = 1;
        });
        const maxLen = Math.max(cols[0]!.items.length, cols[1]!.items.length);
        for (let i = 0; i < maxLen; i++) cols.forEach((c, ci) => {
          if (!c.items[i]) return;
          const k = appear(t, rt[n++]!);
          if (k <= 0) return;
          const x = 80 * S + ci * (cw + 40 * S), y = y0 + 84 * S + i * 104 * S;
          ctx.globalAlpha = k;
          ctx.fillStyle = "#ffffff";
          rrect(ctx, x, y + (1 - k) * 20 * S, cw, 90 * S, 12 * S); ctx.fill();
          ctx.fillStyle = c.color; ctx.fillRect(x, y + (1 - k) * 20 * S, 6 * S, 90 * S);
          this.textLines(c.items[i]!, x + 28 * S, y + 40 * S + (1 - k) * 20 * S, cw - 50 * S, 24, brand.text_color, 2);
          ctx.globalAlpha = 1;
        });
        return;
      }
      case "steps": {
        this.bg(t); this.logoMark();
        this.heading(sc.heading, t);
        const items = sc.items.slice(0, 6), n = Math.max(1, items.length), rt = R(n);
        const slot = (W - 160 * S) / n, cy = H * 0.5;
        ctx.strokeStyle = brand.primary_color; ctx.globalAlpha = 0.2; ctx.lineWidth = 6 * S;
        ctx.beginPath(); ctx.moveTo(80 * S + slot / 2, cy); ctx.lineTo(80 * S + slot * (n - 0.5), cy); ctx.stroke();
        ctx.globalAlpha = 1;
        const lit = rt.filter((r) => t >= r).length;
        if (lit > 1) {
          const seg = Math.min(lit - 1, n - 1) - 1 + appear(t, rt[Math.min(lit - 1, n - 1)]!, 0.6);
          ctx.strokeStyle = brand.accent_color;
          ctx.beginPath(); ctx.moveTo(80 * S + slot / 2, cy); ctx.lineTo(80 * S + slot / 2 + slot * Math.max(0, seg), cy); ctx.stroke();
        }
        items.forEach((it, i) => {
          const k = appear(t, rt[i]!);
          const cx = 80 * S + slot * (i + 0.5);
          ctx.fillStyle = k > 0 ? brand.primary_color : "#ffffff";
          ctx.strokeStyle = brand.primary_color; ctx.lineWidth = 4 * S;
          ctx.beginPath(); ctx.arc(cx, cy, (38 + 8 * k) * S, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = k > 0 ? brand.background_color : brand.primary_color;
          ctx.font = this.font(30, 700); ctx.textAlign = "center";
          ctx.fillText(String(i + 1), cx, cy + 11 * S);
          ctx.globalAlpha = 0.25 + 0.75 * k;
          ctx.font = this.font(22, 500, false); ctx.fillStyle = brand.text_color;
          wrap(ctx, it, slot - 24 * S).slice(0, 4).forEach((l, j) => ctx.fillText(l, cx, cy + 90 * S + j * 28 * S));
          ctx.globalAlpha = 1; ctx.textAlign = "left";
        });
        return;
      }
      case "quote": {
        this.bg(t); this.logoMark();
        ctx.fillStyle = brand.accent_color; ctx.globalAlpha = appear(t, 0, 0.6);
        ctx.font = this.font(220, 700); ctx.fillText("“", 70 * S, 260 * S);
        ctx.globalAlpha = 1;
        const text = sc.quote || sc.heading;
        ctx.font = this.font(38, 500, true, true);
        const lines = wrap(ctx, text, W - 300 * S).slice(0, 6);
        const words = lines.join(" ").split(" ").length;
        let shown = Math.ceil(words * clamp(t / Math.max(1, d * 0.6)));
        ctx.fillStyle = brand.text_color;
        lines.forEach((l, i) => {
          const ws = l.split(" ");
          const vis = ws.slice(0, Math.max(0, shown)).join(" ");
          shown -= ws.length;
          if (vis) ctx.fillText(vis, 160 * S, (240 + i * 54) * S);
        });
        if (sc.source) {
          const k = appear(t, d * 0.6);
          ctx.globalAlpha = k;
          ctx.font = this.font(22, 600, false);
          const w = ctx.measureText(sc.source).width + 40 * S;
          const y = (240 + lines.length * 54 + 30) * S;
          ctx.fillStyle = brand.primary_color; rrect(ctx, 160 * S, y, w, 44 * S, 22 * S); ctx.fill();
          ctx.fillStyle = brand.background_color; ctx.fillText(sc.source, 180 * S, y + 30 * S);
          ctx.globalAlpha = 1;
        }
        return;
      }
      case "fact": {
        this.bg(t); this.logoMark();
        const k = appear(t, 0.2, 0.9);
        ctx.save();
        ctx.translate(W / 2, H * 0.47);
        ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
        ctx.globalAlpha = k; ctx.textAlign = "center";
        ctx.font = this.font(sc.heading.length > 18 ? 80 : 120, 800);
        const g = ctx.createLinearGradient(-W / 3, 0, W / 3, 0);
        g.addColorStop(0, brand.primary_color); g.addColorStop(1, brand.accent_color);
        ctx.fillStyle = g;
        wrap(ctx, sc.heading, W - 200 * S).slice(0, 2).forEach((l, i, arr) => ctx.fillText(l, 0, (i - (arr.length - 1) / 2) * 110 * S));
        ctx.restore();
        if (sc.items[0]) {
          ctx.globalAlpha = appear(t, 1.2); ctx.textAlign = "center";
          ctx.font = this.font(30, 500, false); ctx.fillStyle = brand.text_color;
          wrap(ctx, sc.items[0], W - 300 * S).slice(0, 2).forEach((l, i) => ctx.fillText(l, W / 2, H * 0.7 + i * 40 * S));
          ctx.globalAlpha = 1; ctx.textAlign = "left";
        }
        return;
      }
      case "illustration":
      case "scenario": {
        const visual = a.clip ?? a.pic;
        if (visual) {
          const sw = a.clip ? a.clip.videoWidth : a.pic!.width, sh = a.clip ? a.clip.videoHeight : a.pic!.height;
          const p = clamp(t / d);
          cover(ctx, visual, sw, sh, W, H, 1.04 + 0.1 * p, (p - 0.5) * -40 * S);
        } else {
          const g = ctx.createLinearGradient(0, 0, W, H);
          g.addColorStop(0, brand.primary_color); g.addColorStop(1, brand.accent_color);
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        }
        const shade = ctx.createLinearGradient(0, H * 0.45, 0, H);
        shade.addColorStop(0, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(0,0,0,0.7)");
        ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
        const split = sc.kind === "scenario" && sc.items.length ? d * 0.45 : d + 1;
        const k = appear(t, 0.3, 0.7) * (1 - appear(t, split - 0.3, 0.4));
        if (k > 0) {
          ctx.globalAlpha = k;
          if (sc.kind === "scenario") {
            ctx.font = this.font(20, 700, false);
            const w = ctx.measureText("SCENARIO").width + 32 * S;
            ctx.fillStyle = brand.accent_color; rrect(ctx, 80 * S, H - 300 * S, w, 38 * S, 19 * S); ctx.fill();
            ctx.fillStyle = "#ffffff"; ctx.fillText("SCENARIO", 96 * S, H - 274 * S);
          }
          ctx.font = this.font(48, 700);
          ctx.fillStyle = "#ffffff";
          wrap(ctx, sc.heading, W - 300 * S).slice(0, 2).forEach((l, i) => ctx.fillText(l, 80 * S, H - 210 * S + i * 56 * S + (1 - k) * 20 * S));
          if (sc.kind === "illustration" && sc.items[0]) { ctx.font = this.font(26, 500, false); ctx.fillText(sc.items[0], 80 * S, H - 100 * S); }
          ctx.globalAlpha = 1;
        }
        if (t >= split - 0.3) {
          const pk = appear(t, split - 0.3, 0.6);
          const pw = 560 * S, x = W - pw * pk - 40 * S;
          ctx.fillStyle = brand.background_color; ctx.globalAlpha = 0.97;
          rrect(ctx, x, 60 * S, pw, H - 200 * S, 18 * S); ctx.fill(); ctx.globalAlpha = 1;
          ctx.fillStyle = brand.primary_color; ctx.font = this.font(34, 700);
          ctx.fillText("What should you do?", x + 36 * S, 130 * S);
          const items = sc.items.slice(0, 4), rt = revealTimes(items.length, d - split).map((r) => r + split);
          let y = 190 * S;
          items.forEach((it, i) => {
            const ik = appear(t, rt[i]!);
            ctx.globalAlpha = ik;
            ctx.fillStyle = brand.accent_color;
            ctx.beginPath(); ctx.arc(x + 50 * S, y - 8 * S, 12 * S, 0, Math.PI * 2); ctx.fill();
            const used = this.textLines(it, x + 76 * S, y, pw - 110 * S, 24, brand.text_color, 3);
            y += (used * 32 + 26) * S;
            ctx.globalAlpha = 1;
          });
        }
        return;
      }
    }
  }
}

async function loadBitmap(url: string | null): Promise<ImageBitmap | null> {
  if (!url) return null;
  try { return await createImageBitmap(await (await fetch(url)).blob()); } catch { return null; }
}

export async function buildExplainerVideo(opts: {
  scenes: ExplainerScene[];
  brand: Brand;
  pictures: (string | null)[];
  clips: (string | null)[];
  narrate: (text: string, scene: ExplainerScene) => Promise<string>;
  onProgress: (msg: string, pct: number) => void;
  signal: AbortSignal;
  width: number;
  height: number;
  burnCaptions: boolean;
  onFallback?: () => void;
}): Promise<ExplainerVideo> {
  const { scenes, brand, signal, onProgress, width: W, height: H } = opts;
  const check = () => { if (signal.aborted) throw new Error("Cancelled"); };
  const SR = 48000;
  const decodeCtx = new OfflineAudioContext(2, 1, SR);
  const { pool } = await import("./narration");

  // 1. Voiceover
  let done = 0;
  onProgress(`Making voiceover 1 of ${scenes.length}…`, 2);
  const voice = await pool(scenes.length, 3, async (i) => {
    check();
    const text = scenes[i]!.narration.trim();
    let buf: AudioBuffer | null = null;
    if (text) {
      try { buf = await decodeCtx.decodeAudioData(b64ToArrayBuffer(await opts.narrate(text, scenes[i]!))); }
      catch (e: any) { check(); throw new Error(`Voiceover for scene ${i + 1} failed: ${e?.message ?? "unknown error"}`); }
    }
    done++;
    onProgress(`Making voiceover ${Math.min(done + 1, scenes.length)} of ${scenes.length}…`, 2 + (done / scenes.length) * 33);
    return buf;
  });

  // 2. Pictures, clips, logo, fonts
  onProgress("Loading pictures…", 36);
  await Promise.all([`700 40px "${brand.heading_font}"`, `500 24px "${brand.body_font}"`, `italic 500 38px "${brand.heading_font}"`].map((f) => document.fonts.load(f).catch(() => null)));
  const logo = await loadBitmap(brand.logo_url);
  const assets: Assets[] = await Promise.all(scenes.map(async (_, i) => {
    const pic = await loadBitmap(opts.pictures[i] ?? null);
    let clip: HTMLVideoElement | null = null, clipAudio: AudioBuffer | null = null;
    const src = opts.clips[i];
    if (src) {
      try {
        const buf = await (await fetch(src)).arrayBuffer();
        clipAudio = await decodeCtx.decodeAudioData(buf.slice(0)).catch(() => null);
        clip = await new Promise<HTMLVideoElement>((res, rej) => {
          const v = document.createElement("video");
          v.muted = true; v.preload = "auto"; v.playsInline = true;
          v.onloadeddata = () => res(v);
          v.onerror = () => rej(new Error("clip"));
          v.src = URL.createObjectURL(new Blob([buf], { type: "video/mp4" }));
        });
      } catch { clip = null; }
    }
    return { pic, clip, clipAudio };
  }));

  // 3. Timeline
  const chapters: Chapter[] = [];
  const cues: Cue[] = [];
  let t = 0;
  const starts: number[] = [], durs: number[] = [];
  scenes.forEach((s, i) => {
    const d = sceneDuration(voice[i]?.duration);
    starts.push(t); durs.push(d);
    chapters.push({ slideIndex: i, start: Math.round(t * 10) / 10, end: Math.round((t + d) * 10) / 10 });
    cues.push(...captionCues(s.narration, t, d));
    t += d;
  });
  const total = t;
  const sceneAt = (gt: number) => { let i = 0; while (i < scenes.length - 1 && gt >= starts[i + 1]!) i++; return i; };

  // 4. Audio mix (narration + quiet clip ambience)
  const len = Math.ceil(total * SR);
  const L = new Float32Array(len), Rr = new Float32Array(len);
  const mix = (b: AudioBuffer | null, at: number, gain: number, maxDur: number) => {
    if (!b) return;
    const off = Math.round(at * SR), lim = Math.min(b.length, Math.round(maxDur * SR));
    const l = b.getChannelData(0), r = b.numberOfChannels > 1 ? b.getChannelData(1) : l;
    for (let i = 0; i < lim && off + i < len; i++) { L[off + i]! += l[i]! * gain; Rr[off + i]! += r[i]! * gain; }
  };
  scenes.forEach((_, i) => { mix(voice[i] ?? null, starts[i]! + 0.2, 1, durs[i]!); mix(assets[i]!.clipAudio, starts[i]!, 0.25, durs[i]!); });

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const painter = new Painter(ctx, W, H, brand, logo, opts.burnCaptions);
  const drawAt = (gt: number) => {
    const i = sceneAt(gt), lt = gt - starts[i]!;
    ctx.save();
    painter.scene(scenes[i]!, lt, durs[i]!, assets[i]!);
    ctx.restore();
    painter.caption(cues, gt);
    if (i > 0 && lt < 0.4) { ctx.globalAlpha = 1 - lt / 0.4; ctx.fillStyle = brand.background_color; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  };
  const titles = scenes.map((s) => s.heading);
  const vtt = cuesToVtt(cues);
  const cleanup = () => assets.forEach((a) => a.clip && URL.revokeObjectURL(a.clip.src));

  const { fastVideoSupported } = await import("./exports");
  if (!(await fastVideoSupported(W, H))) {
    opts.onFallback?.();
    try { return { ...(await recordRealtime(canvas, drawAt, assets, starts, L, Rr, SR, total, onProgress, check)), chapters, vtt, titles }; }
    finally { cleanup(); }
  }

  // 5. Fast offline encode
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: "avc", width: W, height: H, frameRate: 30 }, audio: { codec: "aac", sampleRate: SR, numberOfChannels: 2 }, fastStart: "in-memory", firstTimestampBehavior: "offset" });
  let encErr: Error | null = null;
  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => (encErr = e as Error) });
  venc.configure({ codec: "avc1.640028", width: W, height: H, bitrate: W >= 1920 ? 8_000_000 : 4_000_000, framerate: 30, latencyMode: "quality" });
  const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => (encErr = e as Error) });
  aenc.configure({ codec: "mp4a.40.2", sampleRate: SR, numberOfChannels: 2, bitrate: 128_000 });
  const us = (s: number) => Math.round(s * 1e6);
  const FPS = 30, frames = Math.ceil(total * FPS);
  try {
    for (let f = 0; f < frames; f++) {
      if (f % 15 === 0) { check(); onProgress(`Animating scene ${sceneAt(f / FPS) + 1} of ${scenes.length}…`, 38 + (f / frames) * 57); }
      if (encErr) throw encErr;
      const gt = f / FPS, i = sceneAt(gt), clip = assets[i]!.clip;
      if (clip && clip.duration) {
        clip.currentTime = Math.min(((gt - starts[i]!) % clip.duration), clip.duration - 0.01);
        await new Promise<void>((r) => (clip.onseeked = () => r()));
      }
      drawAt(gt);
      while (venc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
      const vf = new VideoFrame(canvas, { timestamp: us(gt), duration: us(1 / FPS) });
      venc.encode(vf, { keyFrame: f % (FPS * 2) === 0 });
      vf.close();
    }
    for (let off = 0; off < len; off += SR) {
      check();
      const n = Math.min(SR, len - off);
      const data = new Float32Array(n * 2);
      data.set(L.subarray(off, off + n), 0);
      data.set(Rr.subarray(off, off + n), n);
      const ad = new AudioData({ format: "f32-planar", sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: us(off / SR), data });
      aenc.encode(ad);
      ad.close();
    }
    onProgress("Finishing MP4…", 97);
    await venc.flush();
    await aenc.flush();
    if (encErr) throw encErr;
    muxer.finalize();
  } finally {
    cleanup();
  }
  return { blob: new Blob([target.buffer], { type: "video/mp4" }), ext: "mp4", mime: "video/mp4", chapters, duration: total, vtt, titles };
}

/** Fallback for browsers without WebCodecs: plays the animation in real time and records it. */
async function recordRealtime(
  canvas: HTMLCanvasElement, drawAt: (t: number) => void, assets: Assets[], starts: number[],
  L: Float32Array, R: Float32Array, SR: number, total: number,
  onProgress: (m: string, p: number) => void, check: () => void,
) {
  const audioCtx = new AudioContext({ sampleRate: SR });
  const buf = audioCtx.createBuffer(2, L.length, SR);
  buf.copyToChannel(L as Float32Array<ArrayBuffer>, 0);
  buf.copyToChannel(R as Float32Array<ArrayBuffer>, 1);
  const dest = audioCtx.createMediaStreamDestination();
  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
  assets.forEach((a) => { if (a.clip) { a.clip.loop = true; a.clip.play().catch(() => {}); } });
  void starts;
  drawAt(0);
  rec.start(1000);
  const src = audioCtx.createBufferSource();
  src.buffer = buf; src.connect(dest); src.start();
  const t0 = performance.now();
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setInterval(() => {
        const gt = (performance.now() - t0) / 1000;
        try { check(); } catch (e) { clearInterval(timer); reject(e); return; }
        if (gt >= total) { clearInterval(timer); resolve(); return; }
        drawAt(gt);
        onProgress("Recording explainer (plays in real time)…", 38 + (gt / total) * 60);
      }, 1000 / 30);
    });
  } finally {
    rec.stop();
    await stopped;
    audioCtx.close();
    assets.forEach((a) => a.clip?.pause());
  }
  const ext = mime.includes("mp4") ? "mp4" : "webm";
  const type = mime || "video/webm";
  return { blob: new Blob(chunks, { type }), ext, mime: type, duration: total };
}
