/**
 * LinkedIn-filmen, 15 sekunder: en användare skriver, sajten svarar.
 *
 * Varje kort är ett utsnitt ur en riktig skärmbild av maskinval.se (fångad
 * med scripts/fanga-linkedin.mjs och fanga-sajten.mjs). Det enda som läggs
 * ovanpå är skrivandet -- en vit skylt som drar sig undan tecken för tecken
 * över text som redan står i fångsten -- och brickan i scen 5, som citerar
 * sajtens egen varning ordagrant. Inga påhittade gränssnitt, inga priser:
 * katalogen har inga ännu.
 */
import React from "react";
import {
  AbsoluteFill, Audio, Easing, Img, interpolate, staticFile,
  useCurrentFrame, useVideoConfig,
} from "remotion";
import { loadFont as laddaSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as laddaMono } from "@remotion/google-fonts/IBMPlexMono";
import T from "./tidslinje.json";

const { fontFamily: SANS } = laddaSans("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
const { fontFamily: SANS_KURSIV } = laddaSans("italic", { weights: ["600", "700"], subsets: ["latin"] });
const { fontFamily: MONO } = laddaMono("normal", { weights: ["500", "600"], subsets: ["latin"] });

const F = {
  grund: "#0b1324", grundLjus: "#17243f", text: "#f4f6fb", dampad: "#9aa6c0",
  guld: "#e0973d", rod: "#d93f3f", rodYta: "#fde9e9",
};
const KURVA = Easing.bezier(0.32, 0.72, 0, 1);
const MJUK = Easing.bezier(0.45, 0, 0.55, 1);
const in_ = (t: number, fran: number, langd = 0.5) =>
  interpolate(t, [fran, fran + langd], [0, 1], { easing: KURVA, extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** Rektangel i sidans CSS-pixlar: [x0, y0, x1, y1]. */
type Rect = [number, number, number, number];

interface Scen {
  fil: string;
  bildH: number;            // bildens höjd i CSS-px (helsidesfångster är högre än 1080)
  fran: Rect; till: Rect;   // det som ska synas, i början och i slutet av scenen
  minY?: number;            // navigeringsfältet hålls utanför
  maxX?: number;            // stycklistans motiveringskolumn hålls utanför
  etikett: string;
  rubrik: string;
  rubrik2?: { text: string; fran: number };
  sudda?: Rect;             // Siemens-logotyperna i startsidans bakgrundsfoto
  skriv?: { ruta: Rect; tecken: number; fran: number; till: number };
  tryck?: { ruta: Rect; t: number };
  rader?: { fran: number; till: number; forsta: number };
  bricka?: number;          // tid då varningsbrickan visas
}

const SIDA_B = 1920;

const SCENER: Scen[] = [
  {
    fil: "hem-skrivet.png", bildH: 1080, minY: 64,
    fran: [370, 175, 1120, 500], till: [374, 380, 1112, 500],
    etikett: "01 · Sök", rubrik: "Ett sök. Åtta fabrikat.",
    sudda: [1075, 128, 1360, 200],
    skriv: { ruta: [393, 440, 486, 464], tecken: 12, fran: T.skriv[0].fran, till: T.skriv[0].till },
    tryck: { ruta: [986, 429, 1052, 473], t: T.tryck },
  },
  {
    fil: "sok-cyl40-hel.png", bildH: 8596, minY: 64,
    fran: [370, 80, 1550, 830], till: [370, 560, 1550, 1310],
    etikett: "02 · Välj", rubrik: "Flera fabrikat. En träfflista.",
  },
  {
    fil: "jamfor-4-hel.png", bildH: 1799, minY: 64,
    fran: [400, 180, 1524, 740], till: [400, 690, 1524, 1180],
    etikett: "03 · Jämför", rubrik: "Fyra fabrikat. Data mot data.",
  },
  {
    fil: "bygg-beskrivning.png", bildH: 1080, minY: 66,
    fran: [526, 80, 1384, 430], till: [540, 225, 1250, 345],
    etikett: "04 · Bygg maskin", rubrik: "Eller beskriv vad den ska göra.",
    skriv: { ruta: [560, 266, 1236, 293], tecken: 105, fran: T.skriv[1].fran, till: T.skriv[1].till },
  },
  {
    // Överkanten låses vid tabellhuvudet: varningspanelen ovanför har långa
    // meningar som skulle skäras av i högerkanten, och dess innehåll visas i
    // stället ordagrant i brickan.
    fil: "bygg-stycklista.png", bildH: 1080, minY: 268, maxX: 1135,
    fran: [590, 264, 1130, 610], till: [590, 266, 1130, 590],
    etikett: "05 · Stycklista", rubrik: "Artikelnummer, prövade mot kraven.",
    rubrik2: { text: "Den säger ifrån när det inte går.", fran: T.varning },
    rader: { fran: T.rader[0], till: T.rader[1], forsta: 300 },
    bricka: T.varning,
  },
];

/** Det utsnitt av sidan som fyller kortet, med fokus mitt i. */
function region(f: Rect, A: number, bildH: number, minY = 0, maxX = SIDA_B) {
  const fw = f[2] - f[0], fh = f[3] - f[1];
  let w = Math.max(fw, fh * A), h = w / A;
  const maxH = bildH - minY;
  if (h > maxH) { h = maxH; w = h * A; }
  if (w > maxX) { w = maxX; h = w / A; }
  const cx = (f[0] + f[2]) / 2, cy = (f[1] + f[3]) / 2;
  const x = Math.min(Math.max(cx - w / 2, 0), maxX - w);
  const y = Math.min(Math.max(cy - h / 2, minY), bildH - h);
  return { x, y, w, h };
}
const lerp = (a: Rect, b: Rect, p: number): Rect =>
  [0, 1, 2, 3].map((i) => a[i] + (b[i] - a[i]) * p) as Rect;

export const LinkedinFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const t = frame / fps;
  const u = Math.min(W, H) / 100;
  const portratt = H > W * 1.2;
  const kvadrat = !portratt && W < H * 1.2;

  // Kortets plats och textens plats per format.
  const kort = portratt
    ? { x: 6 * u, y: H * 0.25, w: W - 12 * u, h: H * 0.67 }
    : kvadrat
      ? { x: 6 * u, y: 27 * u, w: W - 12 * u, h: H - 33 * u }
      : (() => { const x0 = W * 0.39, w = W - x0 - 5 * u, h = Math.min(H - 14 * u, w / 1.45); return { x: x0, y: (H - h) / 2, w, h }; })();
  const text = portratt
    ? { x: 7 * u, y: H * 0.1, w: W - 14 * u }
    : kvadrat
      ? { x: 6 * u, y: 7 * u, w: W - 12 * u }
      : { x: 6 * u, y: H * 0.36, w: W * 0.3 };
  const rubrikStorlek = portratt ? 6.2 * u : kvadrat ? 5.4 * u : 4.4 * u;

  const slut = T.slut.rad1;
  const sceneSlut = (i: number) => (i < SCENER.length - 1 ? T.scener[i + 1] : slut);

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 85% 75% at 50% 35%, ${F.grundLjus}, ${F.grund})`, fontFamily: SANS, color: F.text }}>
      <Audio src={staticFile("ljud-linkedin.wav")} />
      {/* Ett varmt sken som vandrar långsamt -- rörelse utan att störa. */}
      <div style={{
        position: "absolute", width: W * 0.7, height: W * 0.7, borderRadius: "50%",
        left: interpolate(t, [0, T.langd], [-0.25 * W, 0.55 * W]), top: H * 0.15,
        background: `radial-gradient(circle, ${F.guld}22, transparent 65%)`, filter: `blur(${4 * u}px)`,
      }} />

      {SCENER.map((s, i) => {
        const start = T.scener[i];
        const stopp = sceneSlut(i);
        if (t < start - 0.01 || t > stopp + 0.35) return null;
        // Första scenen syns från första bildrutan: den blir miniatyren i flödet.
        const e = i === 0 ? 1 : in_(t, start, 0.45);
        const ut = in_(t, stopp - 0.05, 0.3);
        const op = Math.min(e, 1 - ut);
        if (op <= 0) return null;
        const p = interpolate(t, [start, stopp], [0, 1], { easing: MJUK, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const A = kort.w / kort.h;
        const r = region(lerp(s.fran, s.till, p), A, s.bildH, s.minY, s.maxX);
        const sk = kort.w / r.w;
        const X = (x: number) => (x - r.x) * sk;
        const Y = (y: number) => (y - r.y) * sk;

        // Skrivandet: hur många tecken som syns just nu.
        let tackning: React.ReactNode = null;
        if (s.skriv) {
          const { ruta, tecken, fran, till } = s.skriv;
          const k = t < fran ? 0 : Math.min(tecken, Math.floor(((t - fran) / (till - fran)) * tecken));
          const vx = ruta[0] + ((ruta[2] - ruta[0]) * k) / tecken;
          const skriver = t >= fran && t < till;
          const blink = skriver || Math.floor(t * 2.4) % 2 === 0;
          tackning = (
            <>
              {k < tecken && (
                <div style={{ position: "absolute", left: X(vx), top: Y(ruta[1]), width: X(ruta[2] + 3) - X(vx), height: Y(ruta[3]) - Y(ruta[1]), background: "#fff" }} />
              )}
              {k < tecken && blink && (
                <div style={{ position: "absolute", left: X(vx), top: Y(ruta[1] + 3), width: Math.max(2, 1.2 * sk), height: Y(ruta[3] - 3) - Y(ruta[1] + 3), background: "#1f2937" }} />
              )}
            </>
          );
        }
        // Knapptrycket i sökrutan.
        let tryck: React.ReactNode = null;
        if (s.tryck && t >= s.tryck.t && t < s.tryck.t + 0.22) {
          const q = s.tryck.ruta;
          tryck = <div style={{ position: "absolute", left: X(q[0]), top: Y(q[1]), width: X(q[2]) - X(q[0]), height: Y(q[3]) - Y(q[1]), background: "rgba(0,0,0,0.22)", borderRadius: 4 * sk }} />;
        }
        // Stycklistan rullas fram rad för rad.
        let rader: React.ReactNode = null;
        if (s.rader) {
          const ry = interpolate(t, [s.rader.fran, s.rader.till], [s.rader.forsta, r.y + r.h], { easing: MJUK, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (ry < r.y + r.h) rader = <div style={{ position: "absolute", left: 0, top: Y(ry), width: kort.w, height: kort.h - Y(ry), background: "#fff" }} />;
        }
        const brickaE = s.bricka != null ? in_(t, s.bricka, 0.45) : 0;

        return (
          <div key={i} style={{
            position: "absolute", left: kort.x, top: kort.y, width: kort.w, height: kort.h,
            opacity: op, borderRadius: 2 * u, overflow: "hidden", background: "#fff",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: `0 ${3 * u}px ${9 * u}px rgba(0,0,0,0.5)`,
            transform: `perspective(${W * 1.6}px) rotateX(${6 * (1 - e)}deg) rotateY(${-7 * (1 - e)}deg) translateY(${(1 - e) * 4 * u - ut * 2 * u}px) scale(${0.965 + 0.035 * e})`,
          }}>
            <Img src={staticFile(`fangst/${s.fil}`)} style={{
              position: "absolute", width: SIDA_B * sk, height: s.bildH * sk,
              left: -r.x * sk, top: -r.y * sk, maxWidth: "none",
            }} />
            {s.sudda && (
              <div style={{
                position: "absolute", left: X(s.sudda[0]), top: Y(s.sudda[1]),
                width: X(s.sudda[2]) - X(s.sudda[0]), height: Y(s.sudda[3]) - Y(s.sudda[1]),
                backdropFilter: `blur(${14 * sk}px)`, WebkitBackdropFilter: `blur(${14 * sk}px)`,
              }} />
            )}
            {tackning}
            {tryck}
            {rader}
            {brickaE > 0 && (
              <>
                <div style={{ position: "absolute", inset: 0, background: `rgba(11,19,36,${0.42 * brickaE})` }} />
                <div style={{
                  position: "absolute", left: kort.w * 0.06, width: kort.w * 0.88,
                  bottom: kort.h * 0.08 + (1 - brickaE) * 3 * u, opacity: brickaE,
                  background: "#fff", borderRadius: 1.4 * u, padding: `${2.2 * u}px ${2.6 * u}px`,
                  borderLeft: `${0.8 * u}px solid ${F.rod}`, boxShadow: `0 ${2 * u}px ${6 * u}px rgba(0,0,0,0.35)`,
                  color: "#111827",
                }}>
                  <div style={{ fontFamily: MONO, fontSize: 1.7 * u, letterSpacing: "0.08em", color: "#6b7280" }}>
                    FE-QS-G14-10 · SNABBKOPPLING
                  </div>
                  <div style={{ marginTop: 0.8 * u, fontSize: (portratt ? 3.4 : 2.8) * u, fontWeight: 600, lineHeight: 1.25, letterSpacing: "-0.01em" }}>
                    Katalogen anger max 80 °C för artikeln, kravet är 90 °C.
                  </div>
                  <span style={{
                    display: "inline-block", marginTop: 1.2 * u, fontFamily: MONO, fontWeight: 600,
                    fontSize: 1.6 * u, letterSpacing: "0.1em", color: F.rod, background: F.rodYta,
                    padding: `${0.4 * u}px ${1 * u}px`, borderRadius: 0.5 * u,
                  }}>EJ UPPFYLLT</span>
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Bildtexterna */}
      {SCENER.map((s, i) => {
        const start = T.scener[i];
        const stopp = sceneSlut(i);
        const e = i === 0 ? 1 : in_(t, start + 0.08, 0.4);
        const ut = in_(t, stopp - 0.1, 0.25);
        const op = Math.min(e, 1 - ut);
        if (op <= 0) return null;
        const byt = s.rubrik2 ? in_(t, s.rubrik2.fran, 0.35) : 0;
        return (
          <div key={`t${i}`} style={{ position: "absolute", left: text.x, top: text.y, width: text.w, opacity: op,
                                       transform: `translateY(${(1 - e) * 1.2 * u}px)` }}>
            <div style={{ fontFamily: MONO, fontSize: 1.8 * u, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: F.guld }}>
              {s.etikett}
            </div>
            <div style={{ position: "relative", marginTop: 1.2 * u, minHeight: rubrikStorlek * 2.3 }}>
              <div style={{ position: "absolute", fontSize: rubrikStorlek, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08, opacity: 1 - byt }}>
                {s.rubrik}
              </div>
              {s.rubrik2 && (
                <div style={{ position: "absolute", fontSize: rubrikStorlek, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.08, opacity: byt, color: F.text }}>
                  {s.rubrik2.text}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Uppmaningen: sajtens egen rubrik. */}
      <AbsoluteFill style={{ opacity: in_(t, slut, 0.45), display: "grid", placeItems: "center", padding: 8 * u }}>
        <div style={{ display: "grid", justifyItems: "center", textAlign: "center", gap: 3 * u }}>
          <div style={{ display: "grid", gap: 0.4 * u }}>
            <div style={{ fontSize: (portratt ? 7.6 : 6.6) * u, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.06,
                          transform: `translateY(${(1 - in_(t, T.slut.rad1, 0.6)) * 1.6 * u}px)` }}>
              {portratt ? <>Beskriv<br />vad den ska göra.</> : "Beskriv vad den ska göra."}
            </div>
            <div style={{ fontFamily: SANS_KURSIV, fontStyle: "italic", fontSize: (portratt ? 7.6 : 6.6) * u, fontWeight: 700,
                          letterSpacing: "-0.035em", lineHeight: 1.06, color: F.guld, opacity: in_(t, T.slut.rad2, 0.5),
                          transform: `translateY(${(1 - in_(t, T.slut.rad2, 0.6)) * 1.6 * u}px)` }}>
              Få artikelnumret.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 1.8 * u, opacity: in_(t, T.slut.marke, 0.5), marginTop: 1 * u }}>
            <div style={{ width: 6 * u, height: 6 * u, borderRadius: 1.1 * u, background: F.guld, color: F.grund,
                          display: "grid", placeItems: "center", fontWeight: 700, fontSize: 3.5 * u }}>M</div>
            <div style={{ fontFamily: MONO, fontSize: 3.2 * u, fontWeight: 500, letterSpacing: "0.04em" }}>maskinval.se</div>
          </div>
          <div style={{ fontSize: 2.1 * u, color: F.dampad, opacity: in_(t, T.slut.fakta, 0.5), letterSpacing: "0.01em" }}>
            Åtta fabrikat · Jämför sida vid sida · Ingen inloggning för att leta
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
