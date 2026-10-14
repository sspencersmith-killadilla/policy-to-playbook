import type { Brand, CourseContent, Slide } from "./course";

const hex = (c: string) => c.replace("#", "").slice(0, 6);
const safeName = (s: string) => s.replace(/[^\w-]+/g, "_").slice(0, 60) || "course";

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function renderSlideImages(nodes: HTMLElement[], width = 1920): Promise<string[]> {
  const { toJpeg } = await import("html-to-image");
  const out: string[] = [];
  for (const n of nodes) {
    out.push(await toJpeg(n, { width: 1920, height: 1080, canvasWidth: width, canvasHeight: (width * 9) / 16, quality: 0.92, cacheBust: true }));
  }
  return out;
}

/* ---------------- PowerPoint (editable) ---------------- */
export async function exportPptx(title: string, content: CourseContent, brand: Brand) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pptx.title = title;
  const head = { fontFace: brand.heading_font, color: hex(brand.primary_color), bold: true };
  const body = { fontFace: brand.body_font, color: hex(brand.text_color) };

  content.slides.forEach((s, i) => {
    const dark = s.layout === "title" || s.layout === "section";
    const slide = pptx.addSlide();
    slide.background = { color: hex(dark ? brand.primary_color : brand.background_color) };
    slide.addShape("rect", { x: 0, y: 0, w: 0.16, h: 7.5, fill: { color: hex(brand.accent_color) }, line: { color: hex(brand.accent_color) } });
    if (brand.logo_url?.startsWith("data:")) slide.addImage({ data: brand.logo_url, x: 11.2, y: 0.4, w: 1.6, h: 0.5, sizing: { type: "contain", w: 1.6, h: 0.5 } });
    const fg = hex(dark ? brand.background_color : brand.text_color);
    if (dark) {
      slide.addText(s.title, { x: 1, y: 2.2, w: 11, h: 2, fontSize: 44, ...head, color: fg });
      if (s.subtitle) slide.addText(s.subtitle, { x: 1, y: 4.3, w: 11, h: 1, fontSize: 22, ...body, color: fg });
    } else if (s.layout === "key_point") {
      slide.addText(s.title.toUpperCase(), { x: 1, y: 1.6, w: 11, h: 0.5, fontSize: 14, ...body, color: hex(brand.accent_color), bold: true });
      slide.addText(s.body || s.subtitle || "", { x: 1, y: 2.2, w: 11, h: 2.8, fontSize: 34, ...head });
    } else {
      slide.addText(s.title, { x: 1, y: 0.7, w: 10, h: 1, fontSize: 32, ...head });
      if (s.layout === "scenario") {
        slide.addText(s.body ?? "", { x: 1, y: 2, w: 5.8, h: 4.3, fontSize: 18, fontFace: brand.body_font, color: hex(brand.background_color), fill: { color: hex(brand.primary_color) }, margin: 20, valign: "top" });
        slide.addText(s.bullets.map((b) => ({ text: b, options: { bullet: true } })), { x: 7.2, y: 2, w: 5.3, h: 4.3, fontSize: 18, ...body, valign: "top" });
      } else {
        slide.addText(s.bullets.map((b) => ({ text: b, options: { bullet: true, paraSpaceAfter: 10 } })), { x: 1, y: 2, w: 11, h: 4.5, fontSize: 22, ...body, valign: "top" });
      }
    }
    slide.addText(`${i + 1} / ${content.slides.length}`, { x: 11.5, y: 6.9, w: 1.3, h: 0.3, fontSize: 10, color: fg, align: "right" });
    if (s.notes) slide.addNotes(`${s.notes}${s.source ? `\n\nSource: ${s.source}` : ""}`);
  });

  if (content.quiz.length) {
    content.quiz.forEach((q, i) => {
      const slide = pptx.addSlide();
      slide.background = { color: hex(brand.background_color) };
      slide.addText(`Knowledge check ${i + 1}`, { x: 1, y: 0.5, w: 11, h: 0.5, fontSize: 14, color: hex(brand.accent_color), bold: true, fontFace: brand.body_font });
      slide.addText(q.question, { x: 1, y: 1.1, w: 11, h: 1.2, fontSize: 26, ...head });
      slide.addText(q.options.map((o, j) => ({ text: `${String.fromCharCode(65 + j)}. ${o}`, options: { breakLine: true } })), { x: 1, y: 2.6, w: 11, h: 3.5, fontSize: 20, ...body, valign: "top" });
      slide.addNotes(`Answer: ${String.fromCharCode(65 + q.correct_index)}. ${q.explanation}`);
    });
  }
  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  download(blob, `${safeName(title)}.pptx`);
}

/* ---------------- SCORM 1.2 package ---------------- */
export type Chapter = { slideIndex: number; start: number; end: number };
export type RecordedVideo = { blob: Blob; ext: string; mime: string; chapters: Chapter[]; duration: number };

export async function exportScorm(
  title: string, content: CourseContent, brand: Brand, images: string[], passScore: number,
  video?: { rec: RecordedVideo; requireFullView: boolean },
) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  let files = "";
  if (video) {
    const vname = `video.${video.rec.ext}`;
    zip.file(vname, video.rec.blob);
    zip.file("captions.vtt", buildVtt(content.slides, video.rec.chapters));
    zip.file("chapters.json", JSON.stringify(video.rec.chapters));
    files = `<file href="${vname}"/><file href="captions.vtt"/><file href="chapters.json"/>`;
  } else {
    images.forEach((img, i) => zip.file(`slides/${i + 1}.jpg`, img.split(",")[1] ?? "", { base64: true }));
    files = images.map((_, i) => `<file href="slides/${i + 1}.jpg"/>`).join("");
  }
  zip.file(
    "imsmanifest.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="cw_${Date.now()}" version="1.0" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="org1"><organization identifier="org1"><title>${esc(title)}</title>
    <item identifier="item1" identifierref="res1"><title>${esc(title)}</title><adlcp:masteryscore>${passScore}</adlcp:masteryscore></item>
  </organization></organizations>
  <resources><resource identifier="res1" type="webcontent" adlcp:scormtype="sco" href="index.html"><file href="index.html"/>${files}</resource></resources>
</manifest>`,
  );
  const data = {
    slides: content.slides.map((s) => ({ notes: s.notes })),
    quiz: content.quiz.map((q) => ({ q: q.question, o: q.options, c: q.correct_index, e: q.explanation })),
    pass: passScore,
    video: video ? { src: `video.${video.rec.ext}`, mime: video.rec.mime.split(";")[0], req: video.requireFullView, ch: video.rec.chapters, titles: content.slides.map((s) => s.title) } : null,
  };
  zip.file(
    "index.html",
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
body{margin:0;font-family:${JSON.stringify(brand.body_font)},system-ui,sans-serif;background:${brand.background_color};color:${brand.text_color}}
.wrap{max-width:1100px;margin:0 auto;padding:24px}
img{width:100%;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.12)}
.bar{display:flex;justify-content:space-between;align-items:center;margin-top:16px}
button{background:${brand.primary_color};color:${brand.background_color};border:0;padding:12px 22px;border-radius:6px;font-size:16px;cursor:pointer}
button:disabled{opacity:.4}
.notes{margin-top:16px;line-height:1.5;opacity:.8}
.q{background:#fff;padding:20px;border-radius:8px;margin:16px 0}
label{display:block;padding:8px 0;cursor:pointer}
video{width:100%;border-radius:8px;background:#000}
.vg{display:grid;grid-template-columns:1fr 260px;gap:20px}@media(max-width:800px){.vg{grid-template-columns:1fr}}
.ch{list-style:none;padding:0;margin:0;max-height:70vh;overflow:auto}.ch li{margin:0 0 6px}.cb{width:100%;text-align:left;background:#fff;color:${brand.text_color};padding:10px 12px;font-size:14px}.ch li.on .cb{background:${brand.primary_color};color:${brand.background_color}}
h1,h2{font-family:${JSON.stringify(brand.heading_font)},serif;color:${brand.primary_color}}
</style></head><body><div class="wrap" id="app"></div>
<script>
var D=${JSON.stringify(data)};
function findAPI(w){var n=0;while(w&&!w.API&&w.parent&&w.parent!==w&&n<10){w=w.parent;n++}return w&&w.API?w.API:(window.opener&&window.opener.API)||null}
var API=findAPI(window);if(API){API.LMSInitialize("");API.LMSSetValue("cmi.core.lesson_status","incomplete");}
var i=0,app=document.getElementById("app");
function slide(){app.innerHTML='<img src="slides/'+(i+1)+'.jpg" alt="Slide '+(i+1)+'"><p class="notes"></p><div class="bar"><button id="p">Back</button><span>'+(i+1)+' / '+D.slides.length+'</span><button id="n">'+(i===D.slides.length-1?(D.quiz.length?'Start quiz':'Finish'):'Next')+'</button></div>';
app.querySelector('.notes').textContent=D.slides[i].notes;
document.getElementById('p').disabled=i===0;document.getElementById('p').onclick=function(){i--;slide()};
document.getElementById('n').onclick=function(){if(i<D.slides.length-1){i++;slide()}else if(D.quiz.length){quiz()}else finish(100)};}
function quiz(){var h='<h1>Knowledge check</h1>';D.quiz.forEach(function(q,k){h+='<div class="q"><strong>'+(k+1)+'. </strong><span class="qt"></span>';q.o.forEach(function(o,j){h+='<label><input type="radio" name="q'+k+'" value="'+j+'"> <span class="ot" data-k="'+k+'" data-j="'+j+'"></span></label>'});h+='</div>'});
h+='<button id="s">Submit answers</button>';app.innerHTML=h;
app.querySelectorAll('.qt').forEach(function(el,k){el.textContent=D.quiz[k].q});
app.querySelectorAll('.ot').forEach(function(el){el.textContent=D.quiz[el.dataset.k].o[el.dataset.j]});
document.getElementById('s').onclick=function(){var c=0;D.quiz.forEach(function(q,k){var s=app.querySelector('input[name=q'+k+']:checked');if(s&&+s.value===q.c)c++});finish(Math.round(c/D.quiz.length*100))};}
function finish(score){var pass=score>=D.pass;if(API){API.LMSSetValue("cmi.core.score.raw",String(score));API.LMSSetValue("cmi.core.score.min","0");API.LMSSetValue("cmi.core.score.max","100");API.LMSSetValue("cmi.core.lesson_status",pass?"passed":"failed");API.LMSCommit("");}
app.innerHTML='<h1>'+(pass?'You passed':'Not quite')+'</h1><p>Your score: '+score+'%. Passing score: '+D.pass+'%.</p>'+(pass?'':'<button id="r">Review and retry</button>');
var r=document.getElementById('r');if(r)r.onclick=function(){i=0;slide()};}
window.addEventListener('beforeunload',function(){saveVid();if(API)API.LMSFinish("")});
var V=null,furthest=0,vel=null;
function fmt(t){t=Math.floor(t);return Math.floor(t/60)+':'+('0'+t%60).slice(-2)}
function saveVid(){if(!vel||!API)return;API.LMSSetValue("cmi.core.lesson_location",String(Math.floor(vel.currentTime)));API.LMSSetValue("cmi.suspend_data",JSON.stringify({f:Math.floor(furthest)}));API.LMSCommit("")}
function video(){var v=D.video;var h='<div class="vg"><div><video id="v" controls playsinline preload="auto"><source src="'+v.src+'" type="'+v.mime+'"><track kind="captions" src="captions.vtt" srclang="en" label="English" default></video>'+
'<div class="bar"><span id="st"></span><button id="q">'+(D.quiz.length?'Start quiz':'Finish')+'</button></div></div><ol class="ch" id="ch"></ol></div>';
app.innerHTML=h;vel=document.getElementById('v');var ch=document.getElementById('ch'),qb=document.getElementById('q'),st=document.getElementById('st');
v.ch.forEach(function(c){var li=document.createElement('li');var b=document.createElement('button');b.className='cb';b.textContent=(v.titles[c.slideIndex]||'Slide')+' · '+fmt(c.start);b.onclick=function(){if(v.req&&c.start>furthest+1){st.textContent='Watch up to this point first.';return}vel.currentTime=c.start;vel.play()};li.appendChild(b);ch.appendChild(li)});
function unlock(){var done=!v.req||furthest>=vel.duration-1.5;qb.disabled=!done;if(!done)st.textContent='Watch the full video to unlock the '+(D.quiz.length?'quiz':'finish')+'.';else st.textContent=''}
try{if(API){var sd=API.LMSGetValue("cmi.suspend_data");if(sd)furthest=JSON.parse(sd).f||0;var loc=+API.LMSGetValue("cmi.core.lesson_location")||0;vel.addEventListener('loadedmetadata',function(){if(loc>0&&loc<vel.duration-1)vel.currentTime=loc;unlock()},{once:true})}}catch(e){}
vel.addEventListener('loadedmetadata',unlock);
var seeking=false;vel.addEventListener('timeupdate',function(){if(!vel.seeking&&vel.currentTime>furthest&&vel.currentTime-furthest<2)furthest=vel.currentTime;var a=null;v.ch.forEach(function(c,k){if(vel.currentTime>=c.start)a=k});Array.prototype.forEach.call(ch.children,function(li,k){li.className=k===a?'on':''});unlock()});
vel.addEventListener('seeking',function(){if(v.req&&vel.currentTime>furthest+1){vel.currentTime=furthest;st.textContent='Skipping ahead is turned off for this course.'}});
vel.addEventListener('ended',function(){furthest=vel.duration;unlock();saveVid()});
vel.addEventListener('pause',saveVid);setInterval(saveVid,15000);
qb.onclick=function(){saveVid();if(D.quiz.length)quiz();else finish(100)};unlock();}
if(D.video){var _f=finish;finish=function(s){_f(s);var r=document.getElementById('r');if(r)r.onclick=function(){video()}}}
D.video?video():slide();
</script></body></html>`,
  );
  download(await zip.generateAsync({ type: "blob" }), `${safeName(title)}-scorm12.zip`);
}

/* ---------------- Narrated video (recorded in the browser) ---------------- */
function b64ToArrayBuffer(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function vttTime(t: number) {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = (t % 60).toFixed(3).padStart(6, "0");
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${sec}`;
}
/** Captions: each slide's narration split into ~12-word cues spread across its chapter. */
export function buildVtt(slides: Slide[], chapters: Chapter[]) {
  let out = "WEBVTT\n\n";
  for (const c of chapters) {
    const words = (slides[c.slideIndex]?.notes ?? "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const parts: string[] = [];
    for (let i = 0; i < words.length; i += 12) parts.push(words.slice(i, i + 12).join(" "));
    const span = (c.end - c.start) / parts.length;
    parts.forEach((p, k) => { out += `${vttTime(c.start + k * span)} --> ${vttTime(c.start + (k + 1) * span)}\n${p}\n\n`; });
  }
  return out;
}

export async function exportVideo(opts: Parameters<typeof buildNarratedVideo>[0] & { title: string }) {
  const r = await buildNarratedVideo(opts);
  download(r.blob, `${safeName(opts.title)}.${r.ext}`);
}

export async function recordNarratedVideo(opts: {
  slides: Slide[];
  images: string[];
  clips?: (string | null)[];
  narrate: (text: string) => Promise<string>;
  onProgress: (msg: string, pct: number) => void;
  signal: AbortSignal;
}): Promise<RecordedVideo> {
  const { slides, images, narrate, onProgress, signal } = opts;
  const audioCtx = new AudioContext();
  const buffers: (AudioBuffer | null)[] = [];
  for (let i = 0; i < slides.length; i++) {
    if (signal.aborted) throw new Error("Cancelled");
    onProgress(`Recording voiceover ${i + 1} of ${slides.length}…`, (i / slides.length) * 40);
    const text = slides[i]?.notes?.trim();
    buffers.push(text ? await audioCtx.decodeAudioData(b64ToArrayBuffer(await narrate(text))) : null);
  }
  const clipEls: (HTMLVideoElement | null)[] = await Promise.all(
    (opts.clips ?? []).map((src) => {
      if (!src) return Promise.resolve(null);
      return fetch(src).then((r) => r.blob()).then((b) => new Promise<HTMLVideoElement>((res, rej) => {
        const v = document.createElement("video");
        v.preload = "auto";
        v.playsInline = true;
        v.oncanplaythrough = () => res(v);
        v.onerror = () => rej(new Error("A scene clip could not be loaded."));
        v.src = URL.createObjectURL(b);
      }));
    }),
  );
  const imgs = await Promise.all(images.map((src) => new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; })));

  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d")!;
  const dest = audioCtx.createMediaStreamDestination();
  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));

  let current: CanvasImageSource = imgs[0]!;
  const draw = () => ctx.drawImage(current, 0, 0, 1280, 720);
  draw();
  const timer = setInterval(draw, 1000 / 30);
  rec.start(1000);
  const total = buffers.reduce((a, b) => a + (b?.duration ?? 3) + 0.8, 0) + clipEls.reduce((a, v) => a + (v?.duration ?? 0), 0);
  let elapsed = 0;
  const chapters: Chapter[] = [];
  const t0 = performance.now();
  const now = () => (performance.now() - t0) / 1000;
  try {
    for (let i = 0; i < slides.length; i++) {
      if (signal.aborted) throw new Error("Cancelled");
      const clip = clipEls[i];
      const start = now();
      if (clip) {
        onProgress(`Recording scene clip for slide ${i + 1}…`, 40 + (elapsed / total) * 60);
        audioCtx.createMediaElementSource(clip).connect(dest);
        current = clip;
        clip.currentTime = 0;
        await clip.play();
        await new Promise<void>((r) => (clip.onended = () => r()));
        elapsed += clip.duration;
      }
      current = imgs[i]!;
      draw();
      const buf = buffers[i];
      const dur = (buf?.duration ?? 3) + 0.8;
      onProgress(`Recording slide ${i + 1} of ${slides.length} (plays in real time)…`, 40 + (elapsed / total) * 60);
      if (buf) {
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(dest);
        src.start();
      }
      await new Promise((r) => setTimeout(r, dur * 1000));
      elapsed += dur;
      chapters.push({ slideIndex: i, start: Math.round(start * 10) / 10, end: Math.round(now() * 10) / 10 });
    }
  } finally {
    clearInterval(timer);
    rec.stop();
    await stopped;
    audioCtx.close();
  }
  const ext = mime.includes("mp4") ? "mp4" : "webm";
  const type = mime || "video/webm";
  return { blob: new Blob(chunks, { type }), ext, mime: type, chapters, duration: now() };
}

/* ---------------- Fast offline MP4 encoder (WebCodecs) ---------------- */
type EncodeOpts = Parameters<typeof recordNarratedVideo>[0] & { width?: number; height?: number };

export async function fastVideoSupported(width = 1280, height = 720) {
  if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined" || typeof VideoFrame === "undefined") return false;
  try {
    const v = await VideoEncoder.isConfigSupported({ codec: "avc1.640028", width, height, bitrate: 4_000_000, framerate: 30 });
    const a = await AudioEncoder.isConfigSupported({ codec: "mp4a.40.2", sampleRate: 48000, numberOfChannels: 2, bitrate: 128_000 });
    return !!(v.supported && a.supported);
  } catch {
    return false;
  }
}

/** Builds the narrated video faster than real time. Falls back to real-time recording when unsupported. */
export async function buildNarratedVideo(opts: EncodeOpts & { onFallback?: () => void }): Promise<RecordedVideo> {
  const w = opts.width ?? 1280, h = opts.height ?? 720;
  if (!(await fastVideoSupported(w, h))) {
    opts.onFallback?.();
    return recordNarratedVideo(opts);
  }
  return encodeNarratedVideo({ ...opts, width: w, height: h });
}

async function encodeNarratedVideo(opts: EncodeOpts & { width: number; height: number }): Promise<RecordedVideo> {
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const { slides, images, narrate, onProgress, signal, width: W, height: H } = opts;
  const SR = 48000;
  const decodeCtx = new OfflineAudioContext(2, 1, SR);
  const check = () => { if (signal.aborted) throw new Error("Cancelled"); };

  // 1. Narration audio
  const voice: (AudioBuffer | null)[] = [];
  for (let i = 0; i < slides.length; i++) {
    check();
    onProgress(`Recording voiceover ${i + 1} of ${slides.length}…`, (i / slides.length) * 40);
    const text = slides[i]?.notes?.trim();
    voice.push(text ? await decodeCtx.decodeAudioData(b64ToArrayBuffer(await narrate(text))) : null);
  }

  // 2. Scene clips (video element for frames, decoded audio track)
  const clips = await Promise.all((opts.clips ?? []).map(async (src) => {
    if (!src) return null;
    const buf = await (await fetch(src)).arrayBuffer();
    const audio = await decodeCtx.decodeAudioData(buf.slice(0)).catch(() => null);
    const el = await new Promise<HTMLVideoElement>((res, rej) => {
      const v = document.createElement("video");
      v.muted = true; v.preload = "auto"; v.playsInline = true;
      v.onloadeddata = () => res(v);
      v.onerror = () => rej(new Error("A scene clip could not be loaded."));
      v.src = URL.createObjectURL(new Blob([buf], { type: "video/mp4" }));
    });
    return { el, audio, duration: el.duration };
  }));
  const imgs = await Promise.all(images.map((src) => new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; })));

  // 3. Timeline
  const chapters: Chapter[] = [];
  const segs: { slide: number; clip: boolean; start: number; dur: number }[] = [];
  let t = 0;
  slides.forEach((_, i) => {
    const start = t;
    const c = clips[i];
    if (c) { segs.push({ slide: i, clip: true, start: t, dur: c.duration }); t += c.duration; }
    const d = (voice[i]?.duration ?? 3) + 0.8;
    segs.push({ slide: i, clip: false, start: t, dur: d }); t += d;
    chapters.push({ slideIndex: i, start: Math.round(start * 10) / 10, end: Math.round(t * 10) / 10 });
  });
  const total = t;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width: W, height: H, frameRate: 30 },
    audio: { codec: "aac", sampleRate: SR, numberOfChannels: 2 },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });
  let encErr: Error | null = null;
  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => (encErr = e as Error) });
  venc.configure({ codec: "avc1.640028", width: W, height: H, bitrate: W >= 1920 ? 8_000_000 : 4_000_000, framerate: 30, latencyMode: "quality" });
  const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => (encErr = e as Error) });
  aenc.configure({ codec: "mp4a.40.2", sampleRate: SR, numberOfChannels: 2, bitrate: 128_000 });

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const us = (s: number) => Math.round(s * 1e6);
  const pushFrame = async (ts: number, dur: number, key: boolean) => {
    if (encErr) throw encErr;
    while (venc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
    const f = new VideoFrame(canvas, { timestamp: us(ts), duration: us(dur) });
    venc.encode(f, { keyFrame: key });
    f.close();
  };

  // 4. Video frames
  const SLIDE_FPS = 5, CLIP_FPS = 30;
  for (const s of segs) {
    check();
    onProgress(`Building video: slide ${s.slide + 1} of ${slides.length}${s.clip ? " (scene clip)" : ""}…`, 40 + (s.start / total) * 55);
    if (s.clip) {
      const el = clips[s.slide]!.el;
      const n = Math.max(1, Math.floor(s.dur * CLIP_FPS));
      for (let k = 0; k < n; k++) {
        el.currentTime = Math.min(k / CLIP_FPS, s.dur - 0.01);
        await new Promise<void>((r) => (el.onseeked = () => r()));
        ctx.drawImage(el, 0, 0, W, H);
        await pushFrame(s.start + k / CLIP_FPS, 1 / CLIP_FPS, k === 0);
      }
    } else {
      ctx.drawImage(imgs[s.slide]!, 0, 0, W, H);
      const n = Math.max(1, Math.ceil(s.dur * SLIDE_FPS));
      for (let k = 0; k < n; k++) await pushFrame(s.start + k / SLIDE_FPS, Math.min(1 / SLIDE_FPS, s.dur - k / SLIDE_FPS), k % (SLIDE_FPS * 4) === 0);
    }
  }

  // 5. Audio mix
  const len = Math.ceil(total * SR);
  const L = new Float32Array(len), R = new Float32Array(len);
  const mix = (b: AudioBuffer | null, at: number) => {
    if (!b) return;
    const off = Math.round(at * SR);
    const l = b.getChannelData(0), r = b.numberOfChannels > 1 ? b.getChannelData(1) : l;
    for (let i = 0; i < l.length && off + i < len; i++) { L[off + i]! += l[i]!; R[off + i]! += r[i]!; }
  };
  for (const s of segs) mix(s.clip ? clips[s.slide]!.audio : voice[s.slide] ?? null, s.start);
  const CH = SR; // 1-second chunks
  for (let off = 0; off < len; off += CH) {
    check();
    const n = Math.min(CH, len - off);
    const data = new Float32Array(n * 2);
    data.set(L.subarray(off, off + n), 0);
    data.set(R.subarray(off, off + n), n);
    const ad = new AudioData({ format: "f32-planar", sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: us(off / SR), data });
    aenc.encode(ad);
    ad.close();
  }

  onProgress("Finishing MP4…", 97);
  await venc.flush();
  await aenc.flush();
  if (encErr) throw encErr;
  muxer.finalize();
  clips.forEach((c) => c && URL.revokeObjectURL(c.el.src));
  return { blob: new Blob([target.buffer], { type: "video/mp4" }), ext: "mp4", mime: "video/mp4", chapters, duration: total };
}
