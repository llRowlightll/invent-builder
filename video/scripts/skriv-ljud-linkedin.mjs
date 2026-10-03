/**
 * Ljudet till LinkedIn-filmen, 15 sekunder. Allt syntetiseras här.
 *
 * Musiken följer scenerna (ett ackord per scen, mjuk puls från första
 * tangenttrycket), och ljudeffekterna följer bilden exakt: tidpunkterna läses
 * ur src/linkedin/tidslinje.json, samma fil som filmen läser.
 *
 * Kör: node scripts/skriv-ljud-linkedin.mjs  ->  public/ljud-linkedin.wav
 */
import { readFileSync, writeFileSync } from "node:fs";

const T = JSON.parse(readFileSync(new URL("../src/linkedin/tidslinje.json", import.meta.url)));
const SR = 48000, N = Math.ceil(T.langd * SR);
const L = new Float32Array(N), R = new Float32Array(N);
const SLAG = 60 / T.bpm;

let fro = 0x5f3759df;
const brus = () => { fro ^= fro << 13; fro ^= fro >>> 17; fro ^= fro << 5; return ((fro >>> 0) / 4294967296) * 2 - 1; };
const slump = () => (brus() + 1) / 2;
function biquad(typ, f, q) {
  const w = 2 * Math.PI * f / SR, c = Math.cos(w), a = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (typ === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
  else if (typ === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
  else { b0 = a; b1 = 0; b2 = -a; }
  const a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => { const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
const lagg = (i, v, pan = 0) => { if (i < 0 || i >= N) return; L[i] += v * (1 - Math.max(0, pan)); R[i] += v * (1 + Math.min(0, pan)); };
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);

/** Mjuk bastrumma. */
function trumma(t, s = 1) {
  const b = Math.floor(t * SR); let fas = 0;
  for (let k = 0; k < Math.floor(0.22 * SR); k++) {
    const tt = k / SR, f = 48 + 70 * Math.exp(-tt * 40);
    fas += 2 * Math.PI * f / SR;
    lagg(b + k, Math.sin(fas) * Math.exp(-tt * 16) * 0.38 * s);
  }
}
/** Hi-hat, kort och mörk. */
function hatt(t, s = 1) {
  const b = Math.floor(t * SR), hp = biquad("hp", 7000, 0.7);
  for (let k = 0; k < Math.floor(0.03 * SR); k++) lagg(b + k, hp(brus()) * Math.exp(-k / SR * 160) * 0.12 * s, 0.25);
}
/** Tangentklick: kort, ljust, lite variation i ton och styrka. */
function tangent(t, s = 1) {
  const b = Math.floor(t * SR), bp = biquad("bp", 2600 + slump() * 1800, 2.2);
  const st = 0.7 + slump() * 0.6;
  for (let k = 0; k < Math.floor(0.018 * SR); k++) lagg(b + k, bp(brus()) * Math.exp(-k / SR * 320) * 0.5 * s * st, (slump() - 0.5) * 0.4);
  for (let k = 0; k < Math.floor(0.012 * SR); k++) lagg(b + k, Math.sin(2 * Math.PI * 140 * k / SR) * Math.exp(-k / SR * 300) * 0.08 * s);
}
/** Knapptryck: ett mjukt "tock". */
function tock(t) {
  const b = Math.floor(t * SR); let fas = 0;
  for (let k = 0; k < Math.floor(0.09 * SR); k++) {
    const tt = k / SR; fas += 2 * Math.PI * (420 * Math.exp(-tt * 30) + 180) / SR;
    lagg(b + k, Math.sin(fas) * Math.exp(-tt * 45) * 0.32);
  }
}
/** Svep vid scenbyte: brus som sveper i ett bandpass. */
function svep(t, langd = 0.38, s = 1) {
  const b = Math.floor((t - langd * 0.6) * SR), n = Math.floor(langd * SR);
  for (let k = 0; k < n; k++) {
    const x = k / n, f = 900 + 5200 * x, bp = svepFilter(f);
    lagg(b + k, bp(brus()) * Math.sin(Math.PI * x) ** 2 * 0.16 * s, x - 0.5);
  }
}
const svepCache = new Map();
function svepFilter(f) { const nyckel = Math.round(f / 200); if (!svepCache.has(nyckel)) svepCache.set(nyckel, biquad("bp", f, 0.8)); return svepCache.get(nyckel); }
/** Mjukt ackord med långsam attack. */
function ackord(fran, till, noter, s = 1, ljus = 1700) {
  const b = Math.floor(fran * SR), n = Math.floor((till - fran) * SR);
  const fl = [biquad("lp", ljus, 0.6), biquad("lp", ljus, 0.6)], fa = noter.map(() => [0, 0]);
  for (let k = 0; k < n; k++) {
    const tt = k / SR, tot = n / SR, env = Math.min(1, tt / 0.3) * Math.min(1, (tot - tt) / 0.5);
    let v0 = 0, v1 = 0;
    noter.forEach((no, j) => {
      const f = hz(no);
      fa[j][0] += 2 * Math.PI * f * 0.9986 / SR; fa[j][1] += 2 * Math.PI * f * 1.0014 / SR;
      v0 += Math.sin(fa[j][0]) + 0.22 * Math.sin(fa[j][0] * 2);
      v1 += Math.sin(fa[j][1]) + 0.22 * Math.sin(fa[j][1] * 2);
    });
    const g = env * 0.055 * s / Math.sqrt(noter.length);
    if (b + k < N) { L[b + k] += fl[0](v0) * g; R[b + k] += fl[1](v1) * g; }
  }
}
/** Klocka: en ren ton med överton, för "Få artikelnumret." */
function klocka(t, not, s = 1) {
  const b = Math.floor(t * SR), f = hz(not);
  for (let k = 0; k < Math.floor(1.6 * SR); k++) {
    const tt = k / SR, env = Math.exp(-tt * 2.6);
    lagg(b + k, (Math.sin(2 * Math.PI * f * tt) + 0.35 * Math.sin(2 * Math.PI * f * 2.76 * tt) * Math.exp(-tt * 6)) * env * 0.09 * s, 0.1);
  }
}
/** Låg, kort ton för varningen -- allvar, inte larm. */
function varningston(t) {
  const b = Math.floor(t * SR);
  for (const [dt, not] of [[0, 45], [0.16, 44]]) {
    const f = hz(not), bb = b + Math.floor(dt * SR);
    for (let k = 0; k < Math.floor(0.5 * SR); k++) {
      const tt = k / SR, env = Math.min(1, tt * 60) * Math.exp(-tt * 5);
      lagg(bb + k, (Math.sin(2 * Math.PI * f * tt) + 0.3 * Math.sin(2 * Math.PI * f * 2 * tt)) * env * 0.22);
    }
  }
}

// ── Kompositionen ───────────────────────────────────────────────────────
const S = T.scener, SLUT = T.slut.rad1;
const ACKORD = [
  [50, 57, 62, 64, 66],  // D(add9)
  [47, 54, 59, 61, 62],  // Bm(add9)
  [43, 50, 55, 59, 62],  // Gmaj7
  [45, 52, 57, 59, 64],  // Asus2
  [42, 49, 54, 57, 61],  // F#m7
];
S.forEach((t0, i) => ackord(Math.max(0, t0 - 0.05), (i < S.length - 1 ? S[i + 1] : SLUT) + 0.25, ACKORD[i] ?? ACKORD[0], i === 0 ? 0.8 : 1));
// Efter varningen mörknar femte scenens ackord.
ackord(T.varning, SLUT + 0.2, [40, 47, 52, 55, 59], 0.7, 1200);
// Uppmaningen: D-dur som får klinga ut, ljusare.
ackord(SLUT - 0.05, T.langd, [38, 50, 57, 62, 66, 69], 1.25, 2600);

// Pulsen börjar med första tangenttrycket och tystnar vid uppmaningen.
const pulsStart = T.skriv[0].fran;
for (let t = pulsStart; t < SLUT - 0.05; t += SLAG) {
  const takt = Math.round((t - pulsStart) / SLAG);
  trumma(t, takt % 2 === 0 ? 0.9 : 0.55);
  if (t >= S[1]) hatt(t + SLAG / 2, 0.9);
}
// Tangentklick: ett per tecken i sökningen, en snabb serie i beskrivningen.
for (const sk of T.skriv) {
  const n = sk.tecken <= 20 ? sk.tecken : Math.round((sk.till - sk.fran) * 18);
  for (let i = 0; i < n; i++) tangent(sk.fran + (i + 0.3 * slump()) * (sk.till - sk.fran) / n, sk.tecken <= 20 ? 1 : 0.7);
}
tock(T.tryck);
S.slice(1).forEach((t) => svep(t));
svep(SLUT, 0.5, 1.2);
// Raderna i stycklistan.
for (let i = 0; i < 8; i++) tangent(T.rader[0] + i * (T.rader[1] - T.rader[0]) / 8, 0.45);
varningston(T.varning);
trumma(SLUT, 1.1);
klocka(T.slut.rad2, 74, 1.1);
klocka(T.slut.marke, 81, 0.6);

// ── Mastring ────────────────────────────────────────────────────────────
let topp = 0;
for (let i = 0; i < N; i++) topp = Math.max(topp, Math.abs(L[i]), Math.abs(R[i]));
const forst = 0.89 / (topp || 1), fadeUt = Math.floor(0.8 * SR);
const ut = Buffer.alloc(44 + N * 4);
for (let i = 0; i < N; i++) {
  const fade = i > N - fadeUt ? (N - i) / fadeUt : 1;
  ut.writeInt16LE(Math.round(Math.max(-1, Math.min(1, Math.tanh(L[i] * forst * 1.12) * fade)) * 32767), 44 + i * 4);
  ut.writeInt16LE(Math.round(Math.max(-1, Math.min(1, Math.tanh(R[i] * forst * 1.12) * fade)) * 32767), 46 + i * 4);
}
ut.write("RIFF", 0); ut.writeUInt32LE(36 + N * 4, 4); ut.write("WAVE", 8);
ut.write("fmt ", 12); ut.writeUInt32LE(16, 16); ut.writeUInt16LE(1, 20); ut.writeUInt16LE(2, 22);
ut.writeUInt32LE(SR, 24); ut.writeUInt32LE(SR * 4, 28); ut.writeUInt16LE(4, 32); ut.writeUInt16LE(16, 34);
ut.write("data", 36); ut.writeUInt32LE(N * 4, 40);
writeFileSync(new URL("../public/ljud-linkedin.wav", import.meta.url), ut);
console.log(`ljud-linkedin.wav: ${T.langd} s, ${(ut.length / 1048576).toFixed(1)} MB`);
