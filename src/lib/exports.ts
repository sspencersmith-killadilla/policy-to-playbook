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
export async function exportScorm(title: string, content: CourseContent, brand: Brand, images: string[], passScore: number) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  images.forEach((img, i) => zip.file(`slides/${i + 1}.jpg`, img.split(",")[1] ?? "", { base64: true }));
  const files = images.map((_, i) => `<file href="slides/${i + 1}.jpg"/>`).join("");
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
window.addEventListener('beforeunload',function(){if(API)API.LMSFinish("")});
slide();
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

export async function exportVideo(opts: {
  title: string;
  slides: Slide[];
  images: string[];
  narrate: (text: string) => Promise<string>;
  onProgress: (msg: string, pct: number) => void;
  signal: AbortSignal;
}) {
  const { slides, images, narrate, onProgress, signal } = opts;
  const audioCtx = new AudioContext();
  const buffers: (AudioBuffer | null)[] = [];
  for (let i = 0; i < slides.length; i++) {
    if (signal.aborted) throw new Error("Cancelled");
    onProgress(`Recording voiceover ${i + 1} of ${slides.length}…`, (i / slides.length) * 40);
    const text = slides[i]?.notes?.trim();
    buffers.push(text ? await audioCtx.decodeAudioData(b64ToArrayBuffer(await narrate(text))) : null);
  }
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

  let current = imgs[0]!;
  const draw = () => ctx.drawImage(current, 0, 0, 1280, 720);
  draw();
  const timer = setInterval(draw, 1000 / 15);
  rec.start(1000);
  const total = buffers.reduce((a, b) => a + (b?.duration ?? 3) + 0.8, 0);
  let elapsed = 0;
  try {
    for (let i = 0; i < slides.length; i++) {
      if (signal.aborted) throw new Error("Cancelled");
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
    }
  } finally {
    clearInterval(timer);
    rec.stop();
    await stopped;
    audioCtx.close();
  }
  const ext = mime.includes("mp4") ? "mp4" : "webm";
  download(new Blob(chunks, { type: mime || "video/webm" }), `${safeName(opts.title)}.${ext}`);
}
