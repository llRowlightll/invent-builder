/**
 * Maskinvals trailer. Filmen är en konstruktionsritning: ett ritblad med
 * zonmarkeringar och en titelruta, där sex fall ritas in ett i taget. Sista
 * bilden fyller i fältet GODKÄND AV.
 *
 * Tempot är medvetet lugnt. Publiken är ingenjörer, och för dem är en
 * studsande zoom ett tecken på att något ska säljas på känsla. Här tonar
 * saker in och står still.
 */
import React from "react";
import {
  AbsoluteFill, Audio, Easing, interpolate, staticFile,
  useCurrentFrame, useVideoConfig,
} from "remotion";
import { loadFont as laddaSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as laddaMono } from "@remotion/google-fonts/IBMPlexMono";
import T from "./tidslinje.json";
import { FALL, BREDD, type Fall, type Ton } from "./fall";
import { Skiss } from "./Skiss";

const { fontFamily: SANS } = laddaSans("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
const { fontFamily: MONO } = laddaMono("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });

// Varumärkets färger, ur sajtens styles.css. Blåkopia: navy grund, ljusa linjer.
const F = {
  grund: "#0d1424",
  blad: "#111b30",
  linje: "rgba(214, 226, 255, 0.55)",
  linjeSvag: "rgba(214, 226, 255, 0.07)",
  text: "#f4f6fb",
  dampad: "#9aa6c0",
  guld: "#e0973d",
  signal: "#e2544a",
  godkand: "#4fbf85",
  gul: "#e3b84f",
};
const TON: Record<Ton, string> = { ja: F.godkand, nej: F.signal, mer: F.gul };
const KURVA = Easing.bezier(0.32, 0.72, 0, 1);

/** 0 → 1 mellan två tider, med varumärkets kurva. */
const in_ = (t: number, fran: number, langd = 0.6) =>
  interpolate(t, [fran, fran + langd], [0, 1], { easing: KURVA, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
/** Synlig mellan två tider, med mjuka kanter. */
const fonster = (t: number, fran: number, till: number, inn = 0.5, ut = 0.45) =>
  Math.min(in_(t, fran, inn), 1 - in_(t, till - ut, ut));

export const Trailer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const t = frame / fps;
  const u = Math.min(W, H) / 100;           // en enhet = 1 % av kortsidan
  const portratt = H > W * 1.2;
  const kvadrat = !portratt && W < H * 1.2;

  // Bladets mått: yttre och inre ram, som på en riktig ritning.
  const yttre = 3.2 * u;
  const inre = 6.2 * u;

  // Vilket fall är aktivt?
  const fallIndex = T.fall.findIndex((start, i) => {
    const slut = i < T.fall.length - 1 ? T.fall[i + 1] : T.atergang;
    return t >= start && t < slut;
  });

  // Titelrutans värden följer filmen.
  const aktivtFall = fallIndex >= 0 ? FALL[fallIndex] : null;
  const benamning =
    t < T.fall[0] ? "FRÅN BESKRIVNING TILL STYCKLISTA"
    : aktivtFall ? aktivtFall.benamning
    : t < T.avslut ? "SORTIMENT"
    : "MASKINVAL";
  const blad = aktivtFall ? `${fallIndex + 1} / ${FALL.length}` : "—";
  const ritnNr = aktivtFall ? `MV-2026-00${fallIndex + 1}` : "MV-2026-000";
  const godkand: { text: string; farg: string } =
    t >= T.avslut + 0.3 ? { text: "MASKINVAL", farg: F.guld }
    : t >= T.stopp && t < T.atergang ? { text: "EJ GODKÄND", farg: F.signal }
    : { text: "—", farg: F.dampad };

  return (
    <AbsoluteFill style={{ background: F.grund, fontFamily: SANS, color: F.text }}>
      <Audio src={staticFile("ljud.wav")} />

      <Ritblad t={t} W={W} H={H} u={u} yttre={yttre} inre={inre} stoppad={t >= T.stopp && t < T.atergang} />

      {/* ── Inledning ─────────────────────────────────────────────── */}
      <Lager opacity={fonster(t, 1.0, T.fall[0], 0.8, 0.5)} inre={inre} u={u}>
        <div style={{ display: "grid", gap: 2.2 * u, maxWidth: portratt ? "100%" : 70 * u }}>
          <Etikett u={u} farg={F.guld}>Maskinval · komponentval för automation</Etikett>
          <div style={{
            fontSize: (portratt ? 7.2 : 6) * u, fontWeight: 600, letterSpacing: "-0.02em",
            lineHeight: 1.08, textWrap: "balance",
            transform: `translateY(${(1 - in_(t, 1.0, 1.2)) * 1.6 * u}px)`,
          }}>
            Från beskrivning till stycklista.
          </div>
        </div>
      </Lager>

      {/* ── De sex fallen ─────────────────────────────────────────── */}
      {FALL.map((fall, i) => {
        const start = T.fall[i];
        const sista = i === FALL.length - 1;
        const slut = sista ? T.atergang : T.fall[i + 1];
        const op = fonster(t, start, slut, 0.45, sista ? 0.6 : 0.4);
        if (op <= 0) return null;
        return (
          <Lager key={i} opacity={op} inre={inre} u={u} portratt={portratt}>
            <FallVy fall={fall} nr={i + 1} t={t - start} u={u} portratt={portratt} kvadrat={kvadrat}
                    fokusVid={sista ? T.fokus - start : null} stoppVid={sista ? T.stopp - start : null}
                    lagTonVid={sista ? T.lagTon - start : null} />
          </Lager>
        );
      })}

      {/* ── Ritningens huvudfält: skissen för det aktiva fallet ────── */}
      {!kvadrat && FALL.map((_, i) => {
        const start = T.fall[i];
        const sista = i === FALL.length - 1;
        const slut = sista ? T.atergang : T.fall[i + 1];
        const op = fonster(t, start, slut, 0.45, sista ? 0.6 : 0.4);
        if (op <= 0) return null;
        const pad = inre + 4 * u;
        const titelH = 23 * u;
        const ruta = portratt
          ? { x: pad, y: H * 0.47, w: W - 2 * pad, h: H - inre - titelH - 4 * u - H * 0.47 }
          : { x: pad + 0.58 * (W - 2 * pad) + 4 * u, y: pad, w: W - pad - (pad + 0.58 * (W - 2 * pad) + 4 * u), h: H - inre - titelH - 4 * u - pad };
        return (
          <div key={`skiss${i}`} style={{ position: "absolute", inset: 0, opacity: op }}>
            <Skiss index={i} {...ruta} p={in_(t, start + 0.3, 1.7)} mono={MONO} sans={SANS}
                   varning={sista && t < T.atergang ? in_(t, T.stopp, 0.7) : 0} />
          </div>
        );
      })}

      {/* ── Bredden ──────────────────────────────────────────────── */}
      <Lager opacity={fonster(t, T.bredd, T.avslut, 0.5, 0.45)} inre={inre} u={u} vertikalCentrerad>
        <Bredd t={t - T.bredd} u={u} portratt={portratt} />
      </Lager>

      {/* ── Avslut ───────────────────────────────────────────────── */}
      <Lager opacity={in_(t, T.avslut + 0.6, 0.9)} inre={inre} u={u} centrerad>
        <div style={{ display: "grid", justifyItems: "center", gap: 2.6 * u }}>
          <div style={{ display: "flex", alignItems: "center", gap: 2.2 * u }}>
            <div style={{
              width: 9.5 * u, height: 9.5 * u, borderRadius: 1.6 * u, background: F.guld,
              color: F.grund, display: "grid", placeItems: "center",
              fontWeight: 700, fontSize: 5.4 * u, letterSpacing: "-0.04em",
            }}>M</div>
            <div style={{ fontWeight: 700, fontSize: 8 * u, letterSpacing: "-0.035em" }}>Maskinval</div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 2.8 * u, letterSpacing: "0.08em", color: F.dampad }}>
            maskinval.se
          </div>
        </div>
      </Lager>

      <Titelruta u={u} W={W} H={H} inre={inre} portratt={portratt} t={t}
                 benamning={benamning} ritnNr={ritnNr} blad={blad} godkand={godkand} />
    </AbsoluteFill>
  );
};

// ── Bladet ────────────────────────────────────────────────────────────

const Ritblad: React.FC<{ t: number; W: number; H: number; u: number; yttre: number; inre: number; stoppad: boolean }> =
  ({ t, W, H, u, yttre, inre, stoppad }) => {
  const rita = in_(t, 0.0, 1.6);             // ramen ritas in
  const rutnat = in_(t, 0.3, 1.4) * (stoppad ? 0.45 : 1);
  const omkretsY = 2 * (W - 2 * yttre) + 2 * (H - 2 * yttre);
  const omkretsI = 2 * (W - 2 * inre) + 2 * (H - 2 * inre);
  const zonerX = 8, zonerY = Math.round(zonerX * H / W) || 4;
  const bokstav = "ABCDEFGHIJKLMN";
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <pattern id="fin" width={2 * u} height={2 * u} patternUnits="userSpaceOnUse">
          <path d={`M ${2 * u} 0 L 0 0 0 ${2 * u}`} fill="none" stroke={F.linjeSvag} strokeWidth={1} />
        </pattern>
      </defs>
      <rect x={inre} y={inre} width={W - 2 * inre} height={H - 2 * inre} fill="url(#fin)" opacity={rutnat} />
      <rect x={yttre} y={yttre} width={W - 2 * yttre} height={H - 2 * yttre} fill="none"
            stroke={F.linje} strokeWidth={1.2} strokeDasharray={omkretsY} strokeDashoffset={omkretsY * (1 - rita)} />
      <rect x={inre} y={inre} width={W - 2 * inre} height={H - 2 * inre} fill="none"
            stroke={F.linje} strokeWidth={2} strokeDasharray={omkretsI} strokeDashoffset={omkretsI * (1 - rita)} />
      {/* Zonmarkeringar: siffror längs över- och underkant, bokstäver längs sidorna. */}
      <g opacity={in_(t, 1.0, 0.8) * 0.75} fontFamily={MONO} fontSize={1.45 * u} fill={F.dampad} textAnchor="middle">
        {Array.from({ length: zonerX }, (_, i) => {
          const x = inre + ((i + 0.5) * (W - 2 * inre)) / zonerX;
          return (
            <React.Fragment key={`x${i}`}>
              <text x={x} y={(yttre + inre) / 2 + 0.5 * u}>{i + 1}</text>
              <text x={x} y={H - (yttre + inre) / 2 + 0.5 * u}>{i + 1}</text>
            </React.Fragment>
          );
        })}
        {Array.from({ length: zonerY }, (_, i) => {
          const y = inre + ((i + 0.5) * (H - 2 * inre)) / zonerY + 0.5 * u;
          return (
            <React.Fragment key={`y${i}`}>
              <text x={(yttre + inre) / 2} y={y}>{bokstav[i]}</text>
              <text x={W - (yttre + inre) / 2} y={y}>{bokstav[i]}</text>
            </React.Fragment>
          );
        })}
      </g>
    </svg>
  );
};

const Titelruta: React.FC<{
  u: number; W: number; H: number; inre: number; portratt: boolean; t: number;
  benamning: string; ritnNr: string; blad: string; godkand: { text: string; farg: string };
}> = ({ u, W, inre, portratt, t, benamning, ritnNr, blad, godkand }) => {
  const bredd = portratt ? W - 2 * inre : Math.min(64 * u, W * 0.42);
  const cell: React.CSSProperties = {
    borderTop: `1px solid ${F.linje}`, padding: `${0.7 * u}px ${1.1 * u}px`,
    display: "grid", gap: 0.25 * u, minWidth: 0,
  };
  const nyckel: React.CSSProperties = { fontFamily: MONO, fontSize: 1.15 * u, letterSpacing: "0.12em", color: F.dampad };
  const varde: React.CSSProperties = {
    fontFamily: MONO, fontSize: 1.75 * u, fontWeight: 500, letterSpacing: "0.04em",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  };
  return (
    <div style={{
      position: "absolute", right: inre, bottom: inre, width: bredd,
      border: `2px solid ${F.linje}`, borderBottom: "none", borderRight: "none",
      background: F.grund, opacity: in_(t, 1.3, 0.8),
      display: "grid", gridTemplateColumns: "1fr 1fr",
    }}>
      <div style={{ ...cell, gridColumn: "1 / -1", borderTop: "none" }}>
        <span style={nyckel}>BENÄMNING</span>
        <span style={{ ...varde, fontSize: 2.05 * u }}>{benamning}</span>
      </div>
      <div style={{ ...cell, borderRight: `1px solid ${F.linje}` }}>
        <span style={nyckel}>RITN. NR</span><span style={varde}>{ritnNr}</span>
      </div>
      <div style={cell}><span style={nyckel}>SKALA</span><span style={varde}>1:1</span></div>
      <div style={{ ...cell, borderRight: `1px solid ${F.linje}` }}>
        <span style={nyckel}>BLAD</span><span style={varde}>{blad}</span>
      </div>
      <div style={cell}><span style={nyckel}>DATUM</span><span style={varde}>2026-10-02</span></div>
      <div style={{ ...cell, gridColumn: "1 / -1" }}>
        <span style={nyckel}>GODKÄND AV</span>
        <span style={{ ...varde, fontSize: 2.05 * u, fontWeight: 600, color: godkand.farg }}>{godkand.text}</span>
      </div>
    </div>
  );
};

// ── Innehållet ────────────────────────────────────────────────────────

const Lager: React.FC<{
  opacity: number; inre: number; u: number; children: React.ReactNode;
  centrerad?: boolean; vertikalCentrerad?: boolean; portratt?: boolean;
}> = ({ opacity, inre, u, children, centrerad, vertikalCentrerad }) => (
  <AbsoluteFill style={{
    opacity, padding: inre + 4 * u,
    // Titelrutan tar bladets nedre kant, så "mitten" räknas på ytan ovanför den.
    paddingBottom: vertikalCentrerad ? inre + 27 * u : inre + 4 * u,
    display: "flex", flexDirection: "column",
    justifyContent: centrerad || vertikalCentrerad ? "center" : "flex-start",
    alignItems: centrerad ? "center" : "flex-start",
  }}>
    {children}
  </AbsoluteFill>
);

const Etikett: React.FC<{ u: number; farg?: string; children: React.ReactNode }> = ({ u, farg = F.dampad, children }) => (
  <div style={{
    fontFamily: MONO, fontSize: 1.65 * u, fontWeight: 500, letterSpacing: "0.16em",
    textTransform: "uppercase", color: farg,
  }}>{children}</div>
);

const Chip: React.FC<{ u: number; ton: Ton; children: React.ReactNode }> = ({ u, ton, children }) => (
  <span style={{
    fontFamily: MONO, fontSize: 1.4 * u, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
    color: TON[ton], border: `1px solid ${TON[ton]}`, padding: `${0.35 * u}px ${0.8 * u}px`, whiteSpace: "nowrap",
  }}>{children}</span>
);

const FallVy: React.FC<{
  fall: Fall; nr: number; t: number; u: number; portratt: boolean; kvadrat: boolean;
  fokusVid: number | null; stoppVid: number | null; lagTonVid: number | null;
}> = ({ fall, nr, t, u, portratt, kvadrat, fokusVid, stoppVid, lagTonVid }) => {
  const breddSpalt = portratt ? "100%" : kvadrat ? "100%" : "58%";
  const fokus = fokusVid !== null ? in_(t, fokusVid, 0.8) : 0;
  const stopp = stoppVid !== null ? in_(t, stoppVid, 0.7) : 0;
  const ton = lagTonVid !== null ? in_(t, lagTonVid, 1.0) : 0;
  const rubrikStl = (portratt ? 4.3 : kvadrat ? 3.9 : 3.5) * u;

  return (
    <div style={{ width: breddSpalt, display: "grid", gap: 2.4 * u }}>
      <div style={{ display: "grid", gap: 1.4 * u, opacity: in_(t, 0.0, 0.5) }}>
        <Etikett u={u} farg={F.guld}>{String(nr).padStart(2, "0")} · {fall.bransch}</Etikett>
        <div style={{
          fontSize: rubrikStl, fontWeight: 500, lineHeight: 1.22, letterSpacing: "-0.012em",
          textWrap: "balance",
          transform: `translateY(${(1 - in_(t, 0.0, 0.8)) * 1.2 * u}px)`,
        }}>
          {fall.beskrivning}
        </div>
      </div>

      {/* Stycklistan, i ritningens egen form: POS, ANTAL, BENÄMNING, ARTIKELNR. */}
      <div style={{ display: "grid", borderTop: `1px solid ${F.linje}`, opacity: in_(t, 0.45, 0.4) }}>
        <div style={{
          display: "grid", gridTemplateColumns: `${4 * u}px ${5.5 * u}px minmax(0,1fr) auto`,
          gap: 1.6 * u, padding: `${0.9 * u}px 0`, borderBottom: `1px solid ${F.linje}`,
        }}>
          {["POS", "ANT", "BENÄMNING", "ARTIKELNR"].map(h => (
            <span key={h} style={{ fontFamily: MONO, fontSize: 1.2 * u, letterSpacing: "0.14em", color: F.dampad }}>{h}</span>
          ))}
        </div>
        {fall.rader.map((r, i) => {
          const op = in_(t, 0.6 + i * 0.28, 0.45);
          const nedtonad = fokusVid !== null && !r.fokus ? 1 - fokus * 0.62 : 1;
          const arFokus = r.fokus && fokus > 0;
          return (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: `${4 * u}px ${5.5 * u}px minmax(0,1fr) auto`,
              gap: 1.6 * u, alignItems: "center", padding: `${1.15 * u}px 0`,
              borderBottom: `1px solid ${F.linjeSvag}`,
              opacity: op * nedtonad,
              background: arFokus ? `rgba(226, 84, 74, ${0.1 * fokus})` : "transparent",
              boxShadow: arFokus ? `inset ${0.35 * u * fokus}px 0 0 ${F.signal}` : "none",
            }}>
              <span style={{ fontFamily: MONO, fontSize: 1.7 * u, color: F.dampad, paddingLeft: arFokus ? 0.8 * u : 0 }}>{i + 1}</span>
              <span style={{ fontFamily: MONO, fontSize: 1.7 * u, color: F.dampad }}>{r.antal}</span>
              <span style={{ fontSize: 2.15 * u, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.benamning}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 1.2 * u }}>
                <span style={{ fontFamily: MONO, fontSize: 1.85 * u, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{r.artikel}</span>
                {r.ton && <span style={{ opacity: in_(t, 1.7 + i * 0.12, 0.4) }}><Chip u={u} ton={r.ton}>{r.ton === "ja" ? "Verifierad" : "Ej uppfyllt"}</Chip></span>}
                {r.fokus && <span style={{ opacity: fokus }}><Chip u={u} ton="nej">Ej uppfyllt</Chip></span>}
              </span>
            </div>
          );
        })}
      </div>

      {/* Utfallet. För det sista fallet ersätts det av underkännandet nedan. */}
      {fall.utfall.text && (
        <div style={{
          display: "flex", alignItems: "baseline", gap: 1.4 * u, opacity: in_(t, 1.9, 0.5),
          fontSize: 2.3 * u, color: F.text,
        }}>
          <span style={{ width: 1 * u, height: 1 * u, background: TON[fall.utfall.ton], flex: "none", transform: `translateY(-${0.2 * u}px)` }} />
          <span>{fall.utfall.text}</span>
        </div>
      )}

      {/* Underkännandet: lugnt, i klartext, med skälet. Takten har stannat. */}
      {stoppVid !== null && (
        <div style={{ display: "grid", gap: 1.6 * u, opacity: stopp, marginTop: 0.6 * u }}>
          <div style={{
            borderLeft: `${0.4 * u}px solid ${F.signal}`, paddingLeft: 2 * u,
            display: "grid", gap: 1 * u,
          }}>
            <div style={{ fontSize: (portratt ? 3.2 : 2.9) * u, fontWeight: 500, lineHeight: 1.3 }}>
              Katalogen anger max <span style={{ color: F.signal }}>70 °C</span>. Kravet är <span style={{ color: F.signal }}>90 °C</span>.
            </div>
            <div style={{ fontSize: 2.15 * u, color: F.dampad, lineHeight: 1.4 }}>
              Ventilen håller lasten ovanför operatören. Den är inte godkänd för miljön.
            </div>
          </div>
          <div style={{ fontSize: (portratt ? 3.4 : 3) * u, fontWeight: 600, letterSpacing: "-0.015em", opacity: ton, marginTop: 1.2 * u }}>
            Den säger ifrån när det inte går.
          </div>
        </div>
      )}
    </div>
  );
};

const Bredd: React.FC<{ t: number; u: number; portratt: boolean }> = ({ t, u, portratt }) => {
  const tal = (mal: number, fran: number) =>
    Math.round(interpolate(t, [fran, fran + 1.5], [0, mal], { easing: KURVA, extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const siffror = [
    { v: tal(BREDD.komponenter, 0.2), etikett: "komponenter" },
    { v: tal(BREDD.tillverkare, 0.45), etikett: "tillverkare" },
    { v: tal(BREDD.kategorier, 0.7), etikett: "kategorier" },
  ];
  return (
    <div style={{ display: "grid", gap: 4.4 * u, width: "100%" }}>
      <Etikett u={u} farg={F.guld}>Sortimentet</Etikett>
      {/* Lika breda spalter, så att 8 inte ser mindre ut än 887 bara för att det har färre siffror. */}
      <div style={{
        display: "grid", gridTemplateColumns: portratt ? "1fr" : "repeat(3, minmax(0, 1fr))",
        gap: `${3 * u}px ${4 * u}px`, width: portratt ? "100%" : "78%",
      }}>
        {siffror.map((s, i) => (
          <div key={i} style={{
            display: "grid", gap: 0.8 * u, opacity: in_(t, 0.2 + i * 0.25, 0.5),
            borderTop: `1px solid ${F.linje}`, paddingTop: 1.6 * u,
          }}>
            <span style={{ fontSize: 10.5 * u, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{s.v}</span>
            <span style={{ fontFamily: MONO, fontSize: 1.7 * u, letterSpacing: "0.14em", textTransform: "uppercase", color: F.dampad }}>{s.etikett}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gap: 1.6 * u, opacity: in_(t, 1.6, 0.6), width: portratt ? "100%" : "72%" }}>
        <div style={{ fontFamily: MONO, fontSize: 1.85 * u, letterSpacing: "0.1em", color: F.text, lineHeight: 1.75, textWrap: "balance" }}>
          {BREDD.fabrikat.join("  ·  ").toUpperCase()}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 1.85 * u, letterSpacing: "0.1em", color: F.guld }}>
          {BREDD.teknik.join("  ·  ").toUpperCase()}
        </div>
      </div>
    </div>
  );
};
