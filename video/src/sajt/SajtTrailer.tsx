/**
 * Sajttrailern, 18 sekunder: hela maskinval.se, inte en enskild funktion.
 *
 * Bilderna är den driftsatta sajten, fångad av scripts/fanga-sajten.mjs.
 * Kameran rör sig över riktiga skärmbilder i stället för att visa dem små --
 * ett utsnitt som fyller rutan går att läsa på en telefon, en hel sida gör
 * det inte. Rubriken är sajtens egen: "Beskriv vad den ska göra. Få
 * artikelnumret."
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
  grund: "#0e1628",
  grundLjus: "#16213a",
  text: "#f4f6fb",
  dampad: "#9aa6c0",
  guld: "#e0973d",
  ram: "rgba(255,255,255,0.10)",
};
const KURVA = Easing.bezier(0.32, 0.72, 0, 1);
const in_ = (t: number, fran: number, langd = 0.5) =>
  interpolate(t, [fran, fran + langd], [0, 1], { easing: KURVA, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const fonster = (t: number, fran: number, till: number, inn = 0.3, ut = 0.25) =>
  Math.min(in_(t, fran, inn), 1 - in_(t, till - ut, ut));

/** Ett utsnitt av sidan: mitt (cx, cy) i sidans CSS-pixlar, och zoom. */
interface Utsnitt { cx: number; cy: number; z: number }
interface Bild {
  fil: string; adress: string; fran: Utsnitt; till: Utsnitt;
  etikett: string; text: string;
  /**
   * Ett område som suddas, i sidans CSS-pixlar. Startsidans bakgrundsfoto
   * visar Siemens-utrustning med logotypen synlig -- ett fabrikat Maskinval
   * inte för. Logotyperna sitter i ett smalt band OVANFÖR rubriken, så bara
   * det bandet suddas. Ett första försök mörkade hela högra delen och åt upp
   * slutet av rubriken, som bara ligger tolv pixlar från logotypen.
   */
  sudda?: { x1: number; y1: number; x2: number; y2: number };
}

const SIDA_B = 1920, SIDA_H = 1080;   // fångstens CSS-mått

const BILDER: Bild[] = [
  { fil: "hem.png", adress: "maskinval.se",
    fran: { cx: 980, cy: 330, z: 1.48 }, till: { cx: 900, cy: 320, z: 1.62 },
    etikett: "Maskinval", text: "", sudda: { x1: 1075, y1: 128, x2: 1360, y2: 200 } },
  { fil: "sok.png", adress: "maskinval.se/sv/products?q=DSBC",
    fran: { cx: 950, cy: 340, z: 1.55 }, till: { cx: 930, cy: 330, z: 1.72 },
    etikett: "Sök", text: "846 artiklar. Sök och filtrera." },
  { fil: "jamfor.png", adress: "maskinval.se/sv/compare",
    fran: { cx: 990, cy: 420, z: 1.5 }, till: { cx: 990, cy: 410, z: 1.64 },
    etikett: "Jämför", text: "Samma ISO-cylinder. Två fabrikat." },
  { fil: "bygg-beskrivning.png", adress: "maskinval.se/sv/machine-builder",
    fran: { cx: 960, cy: 290, z: 1.72 }, till: { cx: 960, cy: 300, z: 1.95 },
    etikett: "Bygg maskin", text: "Beskriv vad den ska göra." },
  { fil: "bygg-stycklista.png", adress: "maskinval.se/sv/machine-builder",
    fran: { cx: 1000, cy: 470, z: 1.5 }, till: { cx: 990, cy: 460, z: 1.62 },
    etikett: "Bygg maskin", text: "Få stycklistan." },
  { fil: "bygg-stycklista.png", adress: "maskinval.se/sv/machine-builder",
    fran: { cx: 980, cy: 455, z: 2.45 }, till: { cx: 950, cy: 450, z: 2.65 },
    etikett: "Verifiering", text: "Prövad mot dina krav." },
];

export const SajtTrailer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const t = frame / fps;
  const u = Math.min(W, H) / 100;
  const portratt = H > W * 1.2;
  const kvadrat = !portratt && W < H * 1.2;

  // Webbläsarfönstret har alltid 16:9-vy, så att samma utsnitt fungerar i alla format.
  const ramB = portratt ? W - 9 * u : kvadrat ? W - 12 * u : W * 0.8;
  const vyH = ramB * 9 / 16;
  const listH = Math.max(28, 3.4 * u);
  const ramH = vyH + listH;
  const ramX = (W - ramB) / 2;
  const ramY = portratt ? H * 0.43 - ramH / 2 : kvadrat ? H * 0.56 - ramH / 2 : H * 0.44 - ramH / 2;

  const iSajt = t >= T.klipp[0] && t < T.uppmaning;
  const sajtOp = fonster(t, T.klipp[0], T.uppmaning, 0.35, 0.35);

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 70% at 50% 40%, ${F.grundLjus}, ${F.grund})`, fontFamily: SANS, color: F.text }}>
      <Audio src={staticFile("ljud-sajt.wav")} />

      {/* ── Kroken: sajtens egna ord ─────────────────────────────────── */}
      <AbsoluteFill style={{
        opacity: 1 - in_(t, T.klipp[0] - 0.25, 0.25),
        display: "grid", placeItems: "center", padding: 8 * u,
      }}>
        <div style={{ display: "grid", gap: 1.2 * u, justifyItems: "center", textAlign: "center" }}>
          {["Åtta fabrikat.", "846 artiklar.", "En sökruta."].map((rad, i) => (
            <div key={i} style={{
              fontSize: (portratt ? 9.5 : 8.6) * u, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.04,
              color: i === 2 ? F.guld : F.text,
              opacity: in_(t, T.rader[i], 0.35),
              transform: `translateY(${(1 - in_(t, T.rader[i], 0.5)) * 2 * u}px)`,
            }}>{rad}</div>
          ))}
        </div>
      </AbsoluteFill>

      {/* ── Sajten ───────────────────────────────────────────────────── */}
      {iSajt && (
        <div style={{
          position: "absolute", left: ramX, top: ramY, width: ramB, height: ramH,
          opacity: sajtOp, borderRadius: 1.2 * u, overflow: "hidden",
          border: `1px solid ${F.ram}`, background: "#fff",
          boxShadow: `0 ${3 * u}px ${8 * u}px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.2)`,
          transform: `scale(${0.985 + 0.015 * in_(t, T.klipp[0], 0.6)})`,
        }}>
          <Webblasarlist u={u} h={listH} adress={adressFor(t)} />
          <div style={{ position: "relative", width: ramB, height: vyH, overflow: "hidden", background: "#fff" }}>
            {BILDER.map((b, i) => {
              const start = T.klipp[i];
              const slut = i < BILDER.length - 1 ? T.klipp[i + 1] : T.uppmaning;
              // Samma fil i två bilder i rad ska glida, inte tona -- kameran zoomar in.
              const sammaSomForra = i > 0 && BILDER[i - 1].fil === b.fil;
              const sammaSomNasta = i < BILDER.length - 1 && BILDER[i + 1].fil === b.fil;
              const op = Math.min(sammaSomForra ? (t >= start ? 1 : 0) : in_(t, start, 0.28),
                                  sammaSomNasta ? (t < slut ? 1 : 0) : 1 - in_(t, slut - 0.2, 0.2));
              if (op <= 0) return null;
              const p = interpolate(t, [start, slut], [0, 1], { easing: Easing.bezier(0.45, 0, 0.55, 1), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const ut: Utsnitt = {
                cx: b.fran.cx + (b.till.cx - b.fran.cx) * p,
                cy: b.fran.cy + (b.till.cy - b.fran.cy) * p,
                z: b.fran.z + (b.till.z - b.fran.z) * p,
              };
              return <Skarm key={i} bild={b} utsnitt={ut} vyB={ramB} vyH={vyH} opacity={op} />;
            })}
          </div>
        </div>
      )}

      {/* ── Bildtext under fönstret (ovanför i stående format) ───────── */}
      {iSajt && BILDER.map((b, i) => {
        const start = T.klipp[i];
        const slut = i < BILDER.length - 1 ? T.klipp[i + 1] : T.uppmaning;
        const op = fonster(t, start + 0.1, slut, 0.35, 0.2);
        if (op <= 0 || !b.text) return null;
        const textY = portratt ? ramY - 18 * u : kvadrat ? ramY - 15 * u : ramY + ramH + 3.2 * u;
        return (
          <div key={`txt${i}`} style={{
            position: "absolute", left: ramX, width: ramB, top: textY, opacity: op,
            display: "flex", alignItems: "baseline", gap: 2 * u, flexWrap: "wrap",
            justifyContent: portratt || kvadrat ? "flex-start" : "center",
            transform: `translateY(${(1 - in_(t, start + 0.1, 0.45)) * 1 * u}px)`,
          }}>
            <span style={{ fontFamily: MONO, fontSize: 1.9 * u, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: F.guld }}>
              {b.etikett}
            </span>
            <span style={{ fontSize: (portratt ? 5.4 : kvadrat ? 4.6 : 4.2) * u, fontWeight: 600, letterSpacing: "-0.02em" }}>
              {b.text}
            </span>
          </div>
        );
      })}

      {/* ── Uppmaningen: sajtens egen rubrik ─────────────────────────── */}
      <AbsoluteFill style={{
        opacity: in_(t, T.uppmaning, 0.5),
        display: "grid", placeItems: "center", padding: 8 * u,
      }}>
        <div style={{ display: "grid", justifyItems: "center", gap: 3.2 * u, textAlign: "center" }}>
          <div style={{ display: "grid", gap: 0.4 * u }}>
            <div style={{ fontSize: (portratt ? 7.6 : 6.8) * u, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.06,
                          transform: `translateY(${(1 - in_(t, T.uppmaning, 0.6)) * 1.6 * u}px)` }}>
              Beskriv vad den ska göra.
            </div>
            <div style={{ fontFamily: SANS_KURSIV, fontStyle: "italic", fontSize: (portratt ? 7.6 : 6.8) * u, fontWeight: 700,
                          letterSpacing: "-0.035em", lineHeight: 1.06, color: F.guld,
                          opacity: in_(t, T.uppmaning + 0.35, 0.5),
                          transform: `translateY(${(1 - in_(t, T.uppmaning + 0.35, 0.6)) * 1.6 * u}px)` }}>
              Få artikelnumret.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 1.8 * u, opacity: in_(t, T.uppmaning + 0.9, 0.5), marginTop: 1.4 * u }}>
            <div style={{
              width: 6.2 * u, height: 6.2 * u, borderRadius: 1.1 * u, background: F.guld, color: F.grund,
              display: "grid", placeItems: "center", fontWeight: 700, fontSize: 3.6 * u, letterSpacing: "-0.04em",
            }}>M</div>
            <div style={{ fontFamily: MONO, fontSize: 3.2 * u, fontWeight: 500, letterSpacing: "0.04em" }}>maskinval.se</div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

function adressFor(t: number): string {
  let a = BILDER[0].adress;
  BILDER.forEach((b, i) => { if (t >= T.klipp[i]) a = b.adress; });
  return a;
}

const Webblasarlist: React.FC<{ u: number; h: number; adress: string }> = ({ u, h, adress }) => (
  <div style={{
    height: h, display: "flex", alignItems: "center", gap: 1.6 * u, padding: `0 ${1.6 * u}px`,
    background: "#e9ecf1", borderBottom: "1px solid rgba(0,0,0,0.08)",
  }}>
    <div style={{ display: "flex", gap: 0.7 * u }}>
      {["#ff5f57", "#febc2e", "#28c840"].map(c => (
        <span key={c} style={{ width: 1.1 * u, height: 1.1 * u, borderRadius: "50%", background: c }} />
      ))}
    </div>
    <div style={{
      flex: 1, maxWidth: "62%", margin: "0 auto", height: h * 0.62, borderRadius: h * 0.31,
      background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: MONO, fontSize: Math.max(11, 1.35 * u), color: "#5b6476", letterSpacing: "0.01em",
      whiteSpace: "nowrap", overflow: "hidden",
    }}>{adress}</div>
    <div style={{ width: 5 * u }} />
  </div>
);

/** En skärmbild, beskuren och skalad så att utsnittet fyller vyn. */
const Skarm: React.FC<{ bild: Bild; utsnitt: Utsnitt; vyB: number; vyH: number; opacity: number }> =
  ({ bild, utsnitt, vyB, vyH, opacity }) => {
  // Synlig bredd i sidans pixlar, och skalan från sida till vy.
  const synligB = SIDA_B / utsnitt.z;
  const skala = vyB / synligB;
  const synligH = vyH / skala;
  // Håll utsnittet innanför sidans kanter.
  const vanster = Math.min(Math.max(utsnitt.cx - synligB / 2, 0), SIDA_B - synligB);
  const topp = Math.min(Math.max(utsnitt.cy - synligH / 2, 0), SIDA_H - synligH);
  return (
    <div style={{ position: "absolute", inset: 0, opacity }}>
      <Img src={staticFile(`fangst/${bild.fil}`)} style={{
        position: "absolute", width: SIDA_B * skala, height: SIDA_H * skala,
        left: -vanster * skala, top: -topp * skala, maxWidth: "none",
      }} />
      {bild.sudda && (
        <div style={{
          position: "absolute",
          left: (bild.sudda.x1 - vanster) * skala, top: (bild.sudda.y1 - topp) * skala,
          width: (bild.sudda.x2 - bild.sudda.x1) * skala, height: (bild.sudda.y2 - bild.sudda.y1) * skala,
          backdropFilter: `blur(${14 * skala}px)`, WebkitBackdropFilter: `blur(${14 * skala}px)`,
          // Full oskärpa över nästan hela bandet; bara de yttersta kanterna
          // tonas. En rund mask lämnade logotypernas ändar halvskarpa.
          maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent), linear-gradient(180deg, transparent, #000 25%, #000 75%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent), linear-gradient(180deg, transparent, #000 25%, #000 75%, transparent)",
          maskComposite: "intersect", WebkitMaskComposite: "source-in",
        }} />
      )}
    </div>
  );
};
