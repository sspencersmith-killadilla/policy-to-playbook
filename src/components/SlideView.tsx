import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Brand, Slide } from "@/lib/course";

export function useBrandFonts(brand: Brand) {
  useEffect(() => {
    const fams = Array.from(new Set([brand.heading_font, brand.body_font]))
      .map((f) => `family=${encodeURIComponent(f)}:wght@400;600;700`)
      .join("&");
    const id = `brand-fonts-${fams}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${fams}&display=swap`;
    document.head.appendChild(link);
  }, [brand.heading_font, brand.body_font]);
}

/** Renders one slide at 1920x1080 using the organization's brand. */
export function SlideView({ slide, brand, index, total }: { slide: Slide; brand: Brand; index: number; total: number }) {
  const heading: CSSProperties = { fontFamily: `"${brand.heading_font}", serif`, color: brand.primary_color, fontWeight: 600 };
  const bodyFont = `"${brand.body_font}", sans-serif`;
  const dark = slide.layout === "title" || slide.layout === "section";
  const bg = dark ? brand.primary_color : brand.background_color;
  const fg = dark ? brand.background_color : brand.text_color;

  return (
    <div className="slide-content" style={{ background: bg, color: fg, fontFamily: bodyFont }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 24, background: brand.accent_color }} />
      {brand.logo_url && (
        <img src={brand.logo_url} alt="" style={{ position: "absolute", top: 64, right: 96, maxHeight: 72, maxWidth: 280, objectFit: "contain" }} />
      )}
      <div style={{ position: "absolute", inset: "140px 140px 120px 160px", display: "flex", flexDirection: "column", justifyContent: dark || slide.layout === "key_point" ? "center" : "flex-start" }}>
        {slide.layout === "title" && (
          <>
            <div className="slide-kicker" style={{ color: brand.accent_color, marginBottom: 32 }}>Training</div>
            <h1 className="slide-title-lg" style={{ ...heading, color: fg, maxWidth: 1450 }}>{slide.title}</h1>
            {slide.subtitle && <p className="slide-subtitle" style={{ marginTop: 40, opacity: 0.85, maxWidth: 1300 }}>{slide.subtitle}</p>}
          </>
        )}
        {slide.layout === "section" && (
          <>
            <div style={{ width: 120, height: 8, background: brand.accent_color, marginBottom: 48 }} />
            <h2 className="slide-title-lg" style={{ ...heading, color: fg }}>{slide.title}</h2>
            {slide.subtitle && <p className="slide-subtitle" style={{ marginTop: 32, opacity: 0.8 }}>{slide.subtitle}</p>}
          </>
        )}
        {slide.layout === "bullets" && (
          <>
            <h2 className="slide-title" style={heading}>{slide.title}</h2>
            {slide.subtitle && <p className="slide-body-lg" style={{ marginTop: 20, opacity: 0.75 }}>{slide.subtitle}</p>}
            <ul style={{ marginTop: 64, display: "flex", flexDirection: "column", gap: 36, maxWidth: 1400 }}>
              {slide.bullets.map((b, i) => (
                <li key={i} className="slide-body-lg" style={{ display: "flex", gap: 32, alignItems: "baseline" }}>
                  <span style={{ flex: "none", width: 20, height: 20, background: brand.accent_color, borderRadius: 4, transform: "translateY(-6px)" }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            {slide.body && <p className="slide-body" style={{ marginTop: 48, maxWidth: 1300, opacity: 0.85 }}>{slide.body}</p>}
          </>
        )}
        {slide.layout === "scenario" && (
          <>
            <div className="slide-kicker" style={{ color: brand.accent_color }}>Scenario</div>
            <h2 className="slide-title" style={{ ...heading, marginTop: 16 }}>{slide.title}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 64, marginTop: 56 }}>
              <div style={{ background: brand.primary_color, color: brand.background_color, padding: 56, borderRadius: 16 }}>
                <p className="slide-body-lg">{slide.body}</p>
              </div>
              <div>
                <div className="slide-kicker" style={{ color: brand.primary_color, marginBottom: 28 }}>What to do</div>
                <ul style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                  {slide.bullets.map((b, i) => (
                    <li key={i} className="slide-body" style={{ borderLeft: `6px solid ${brand.accent_color}`, paddingLeft: 28 }}>{b}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
        {slide.layout === "key_point" && (
          <>
            <div className="slide-kicker" style={{ color: brand.accent_color, marginBottom: 32 }}>{slide.title}</div>
            <p className="slide-title" style={{ ...heading, maxWidth: 1500 }}>{slide.body || slide.subtitle}</p>
            {slide.bullets.length > 0 && (
              <ul style={{ marginTop: 56, display: "flex", gap: 48, flexWrap: "wrap" }}>
                {slide.bullets.map((b, i) => <li key={i} className="slide-body" style={{ opacity: 0.85 }}>— {b}</li>)}
              </ul>
            )}
          </>
        )}
      </div>
      <div className="slide-caption" style={{ position: "absolute", left: 160, right: 96, bottom: 52, display: "flex", justifyContent: "space-between", opacity: 0.6 }}>
        <span>{slide.source && slide.source !== "General" ? `Source: ${slide.source}` : ""}</span>
        <span>{index + 1} / {total}</span>
      </div>
    </div>
  );
}

/** Scales the 1920x1080 slide to fit its parent container. */
export function ScaledSlide(props: { slide: Slide; brand: Brand; index: number; total: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(el.clientWidth / 1920, el.clientHeight / 1080)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={`relative overflow-hidden ${props.className ?? "aspect-video w-full"}`}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 1920, height: 1080, marginLeft: -960, marginTop: -540, transform: `scale(${scale})` }}>
        <SlideView slide={props.slide} brand={props.brand} index={props.index} total={props.total} />
      </div>
    </div>
  );
}
