/**
 * Ritningens huvudfält: en teknisk skiss per fall, med riktiga måttsättningar.
 *
 * Medvetet INTE ISO 1219-symboler för ventiler och cylindrar. En felritad
 * 5/2-ventil ser en ingenjör på en sekund, och då är filmens trovärdighet
 * borta. Enkla geometriska skisser med korrekt måttsättning -- måttlinje,
 * hjälplinjer, pilar, tolerans -- kan inte bli fel på det sättet, och
 * måttsättning läser varje ingenjör utan att tänka.
 */
import React from "react";

export const SF = {
  linje: "rgba(214, 226, 255, 0.62)",
  matt: "rgba(224, 151, 61, 0.95)",     // måttsättningen i varumärkets guld
  svag: "rgba(214, 226, 255, 0.18)",
  text: "#f4f6fb",
  dampad: "#9aa6c0",
  signal: "#e2544a",
};

interface Ctx { p: number; k: number; mono: string; sans: string; varning: number }

/** En linje som ritas in. pathLength=1 gör att alla linjer ritas lika fort. */
const L: React.FC<{ d: string; c: Ctx; farg?: string; w?: number; streckad?: boolean }> =
  ({ d, c, farg = SF.linje, w = 1.6, streckad }) => (
  <path d={d} fill="none" stroke={farg} strokeWidth={w / c.k} strokeLinecap="round" strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={streckad ? undefined : 1}
        strokeDashoffset={streckad ? undefined : 1 - c.p}
        style={streckad ? { strokeDasharray: `${4 / c.k} ${3 / c.k}`, opacity: c.p } : undefined} />
);

/** Pilspets mot (x, y), riktad i vinkeln a (radianer). */
const pil = (x: number, y: number, a: number, s: number) => {
  const b = 0.42;
  return `M ${x} ${y} L ${x - s * Math.cos(a - b)} ${y - s * Math.sin(a - b)} L ${x - s * Math.cos(a + b)} ${y - s * Math.sin(a + b)} Z`;
};

const Text: React.FC<{ x: number; y: number; c: Ctx; storlek?: number; farg?: string; mono?: boolean; ankare?: "start" | "middle" | "end"; vikt?: number; children: React.ReactNode }> =
  ({ x, y, c, storlek = 20, farg = SF.text, mono = true, ankare = "middle", vikt = 500, children }) => (
  <text x={x} y={y} fontFamily={mono ? c.mono : c.sans} fontSize={storlek / c.k} fontWeight={vikt}
        fill={farg} textAnchor={ankare} opacity={Math.max(0, (c.p - 0.55) / 0.45)}
        style={{ letterSpacing: mono ? "0.04em" : undefined }}>{children}</text>
);

/** Horisontellt mått mellan x1 och x2 på höjden y, med hjälplinjer från yRef. */
const HMatt: React.FC<{ x1: number; x2: number; y: number; yRef: number; text: string; c: Ctx }> = ({ x1, x2, y, yRef, text, c }) => {
  const s = 9 / c.k, upp = y < yRef ? -1 : 1;
  return (
    <g>
      <L d={`M ${x1} ${yRef} L ${x1} ${y + upp * 2.2}`} c={c} farg={SF.matt} w={1} />
      <L d={`M ${x2} ${yRef} L ${x2} ${y + upp * 2.2}`} c={c} farg={SF.matt} w={1} />
      <L d={`M ${x1} ${y} L ${x2} ${y}`} c={c} farg={SF.matt} w={1.2} />
      <path d={pil(x1, y, Math.PI, s)} fill={SF.matt} opacity={c.p} />
      <path d={pil(x2, y, 0, s)} fill={SF.matt} opacity={c.p} />
      <Text x={(x1 + x2) / 2} y={y - 2.4} c={c} farg={SF.matt} storlek={21}>{text}</Text>
    </g>
  );
};

/** Vertikalt mått mellan y1 och y2 vid x, med hjälplinjer från xRef. */
const VMatt: React.FC<{ y1: number; y2: number; x: number; xRef: number; text: string; c: Ctx }> = ({ y1, y2, x, xRef, text, c }) => {
  const s = 9 / c.k, hoger = x > xRef ? 1 : -1;
  return (
    <g>
      <L d={`M ${xRef} ${y1} L ${x + hoger * 2.2} ${y1}`} c={c} farg={SF.matt} w={1} />
      <L d={`M ${xRef} ${y2} L ${x + hoger * 2.2} ${y2}`} c={c} farg={SF.matt} w={1} />
      <L d={`M ${x} ${y1} L ${x} ${y2}`} c={c} farg={SF.matt} w={1.2} />
      <path d={pil(x, y1, -Math.PI / 2, s)} fill={SF.matt} opacity={c.p} />
      <path d={pil(x, y2, Math.PI / 2, s)} fill={SF.matt} opacity={c.p} />
      <Text x={x + hoger * 3} y={(y1 + y2) / 2 + 1.2} c={c} farg={SF.matt} storlek={21} ankare={hoger > 0 ? "start" : "end"}>{text}</Text>
    </g>
  );
};

/** Termometer: en enkel symbol med temperaturen bredvid. */
const Termometer: React.FC<{ x: number; y: number; text: string; c: Ctx; farg?: string }> = ({ x, y, text, c, farg = SF.linje }) => (
  <g>
    <L d={`M ${x} ${y} L ${x} ${y + 9}`} c={c} farg={farg} w={1.6} />
    <circle cx={x} cy={y + 11} r={1.8} fill="none" stroke={farg} strokeWidth={1.6 / c.k} opacity={c.p} />
    <Text x={x + 3.5} y={y + 7.5} c={c} storlek={26} vikt={600} ankare="start" mono={false}>{text}</Text>
  </g>
);

// ── De sex skisserna, i en ruta på 100 × 100 ─────────────────────────────

const forpackning = (c: Ctx) => (
  <g>
    {/* Transportbandet med rullar. */}
    <L d="M 6 66 L 94 66" c={c} />
    <L d="M 6 72 L 94 72" c={c} />
    {[12, 26, 40, 54, 68, 82].map(x => (
      <circle key={x} cx={x} cy={69} r={2.6} fill="none" stroke={SF.linje} strokeWidth={1.2 / c.k} opacity={c.p} />
    ))}
    {/* Kartongen, på väg mot stoppdonet. */}
    <L d="M 18 66 L 18 44 L 42 44 L 42 66" c={c} />
    <Text x={30} y={58} c={c} storlek={22}>5 kg</Text>
    <L d="M 20 37 L 46 37" c={c} farg={SF.dampad} w={1.2} />
    <path d={pil(46, 37, 0, 8 / c.k)} fill={SF.dampad} opacity={c.p} />
    <Text x={33} y={33} c={c} farg={SF.dampad} storlek={19}>0,5 m/s</Text>
    {/* Stoppdonet: en tapp som reser sig genom bandet. */}
    <L d="M 62 84 L 62 58 L 67 58 L 67 84" c={c} />
    <L d="M 59 84 L 70 84" c={c} />
    {/* Slaglängden är inte angiven -- måttet säger det rakt ut. */}
    <VMatt y1={58} y2={72} x={78} xRef={67} text="?" c={c} />
  </g>
);

const montering = (c: Ctx) => (
  <g>
    {/* Balken som bär sugkopparna. */}
    <L d="M 22 26 L 78 26" c={c} w={2} />
    <L d="M 50 26 L 50 12" c={c} />
    <path d={pil(50, 10, -Math.PI / 2, 8 / c.k)} fill={SF.dampad} opacity={c.p} />
    {[32, 68].map(x => (
      <g key={x}>
        <L d={`M ${x} 26 L ${x} 46`} c={c} />
        <L d={`M ${x - 7} 54 L ${x - 3} 46 L ${x + 3} 46 L ${x + 7} 54`} c={c} />
      </g>
    ))}
    {/* Glasskivan: tunn, streckad som i snitt. */}
    <L d="M 14 54 L 86 54 L 86 59 L 14 59 Z" c={c} />
    {Array.from({ length: 14 }, (_, i) => (
      <line key={i} x1={16 + i * 5} y1={58.5} x2={19 + i * 5} y2={54.5}
            stroke={SF.svag} strokeWidth={1 / c.k} opacity={c.p} />
    ))}
    <Text x={50} y={72} c={c} storlek={22}>4 kg</Text>
    <Text x={50} y={83} c={c} farg={SF.dampad} storlek={18}>vakuum</Text>
  </g>
);

const kylrum = (c: Ctx) => (
  <g>
    {/* Luckan, med gångjärn upptill. */}
    <L d="M 44 16 L 84 16 L 84 74 L 44 74 Z" c={c} />
    <circle cx={46} cy={16} r={1.6} fill={SF.linje} opacity={c.p} />
    <circle cx={82} cy={16} r={1.6} fill={SF.linje} opacity={c.p} />
    {/* Cylindern som öppnar den. */}
    <L d="M 8 80 L 36 80 L 36 87 L 8 87 Z" c={c} />
    <L d="M 36 83.5 L 50 83.5 L 50 74" c={c} />
    <HMatt x1={8} x2={36} y={95} yRef={87} text="200" c={c} />
    <Termometer x={14} y={26} text="−30 °C" c={c} farg={SF.linje} />
  </g>
);

const bearbetning = (c: Ctx) => {
  const cx = 50, cy = 52, r = 26;
  // Vinkelmåttet, en halvcirkel utanför bordet.
  const R = r + 9;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={SF.linje} strokeWidth={1.6 / c.k} opacity={c.p} />
      <circle cx={cx} cy={cy} r={2.2} fill={SF.linje} opacity={c.p} />
      <L d={`M ${cx} ${cy} L ${cx + r} ${cy}`} c={c} w={1.2} />
      <L d={`M ${cx} ${cy} L ${cx - r} ${cy}`} c={c} w={1.2} />
      <L d={`M ${cx + R} ${cy} A ${R} ${R} 0 0 0 ${cx - R} ${cy}`} c={c} farg={SF.matt} w={1.2} />
      <path d={pil(cx + R, cy, Math.PI / 2, 9 / c.k)} fill={SF.matt} opacity={c.p} />
      <path d={pil(cx - R, cy, Math.PI / 2, 9 / c.k)} fill={SF.matt} opacity={c.p} />
      <Text x={cx} y={cy - R - 3} c={c} farg={SF.matt} storlek={22}>180°</Text>
      <Text x={cx} y={cy + 9} c={c} storlek={20}>12 kg</Text>
    </g>
  );
};

const inspektion = (c: Ctx) => (
  <g>
    {/* Axelns profil och vagnen med kameran. */}
    <L d="M 10 54 L 90 54 L 90 62 L 10 62 Z" c={c} />
    <L d="M 32 54 L 32 45 L 46 45 L 46 54" c={c} />
    <L d="M 35 45 L 35 36 L 43 36 L 43 45" c={c} />
    <circle cx={39} cy={33} r={2.4} fill="none" stroke={SF.linje} strokeWidth={1.2 / c.k} opacity={c.p} />
    {/* Motorn i axelns ände. */}
    <L d="M 90 52 L 98 52 L 98 64 L 90 64" c={c} />
    <HMatt x1={10} x2={90} y={76} yRef={62} text="300 ±0,05" c={c} />
  </g>
);

const hardning = (c: Ctx) => {
  const v = c.varning;
  const zon = `rgba(226, 84, 74, ${0.06 + 0.16 * v})`;
  return (
    <g>
      {/* Lasten, uppe i sitt läge. */}
      <L d="M 34 14 L 64 14 L 64 32 L 34 32 Z" c={c} w={2} />
      <Text x={49} y={26} c={c} storlek={22} vikt={600}>45 kg</Text>
      <L d="M 49 32 L 49 40" c={c} farg={SF.dampad} w={1.2} />
      <VMatt y1={32} y2={74} x={74} xRef={64} text="400" c={c} />
      {/* Golvet, och operatören som arbetar under lasten. */}
      <L d="M 18 86 L 82 86" c={c} />
      {Array.from({ length: 13 }, (_, i) => (
        <line key={i} x1={20 + i * 5} y1={86} x2={17 + i * 5} y2={90}
              stroke={SF.svag} strokeWidth={1 / c.k} opacity={c.p} />
      ))}
      <rect x={30} y={60} width={38} height={26} fill={zon} opacity={c.p}
            stroke={v > 0 ? SF.signal : SF.svag} strokeWidth={1.2 / c.k}
            strokeDasharray={`${4 / c.k} ${3 / c.k}`} />
      <Text x={49} y={76} c={c} storlek={17} farg={v > 0.5 ? SF.signal : SF.dampad}>OPERATÖR</Text>
      <Termometer x={8} y={14} text="90 °C" c={c} farg={v > 0 ? SF.signal : SF.linje} />
    </g>
  );
};

const SKISSER = [forpackning, montering, kylrum, bearbetning, inspektion, hardning];

export const Skiss: React.FC<{
  index: number; x: number; y: number; w: number; h: number;
  p: number; varning?: number; mono: string; sans: string;
}> = ({ index, x, y, w, h, p, varning = 0, mono, sans }) => {
  const sida = Math.min(w, h);
  const k = sida / 100;                // pixlar per skissenhet
  const rita = SKISSER[index];
  if (!rita || sida < 120) return null;
  return (
    <svg width={sida} height={sida} viewBox="0 0 100 100"
         style={{ position: "absolute", left: x + (w - sida) / 2, top: y + (h - sida) / 2, overflow: "visible" }}>
      {rita({ p, k, mono, sans, varning })}
    </svg>
  );
};
