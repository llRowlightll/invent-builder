/**
 * Ljudet till sajttrailern, 18 sekunder. Samma idé som den längre filmen --
 * maskinens egna ljud som rytm -- men i dur och med högre tempo: det här är
 * en reklam för hela sajten, inte en film om ett underkännande.
 *
 * Ventilen slår vid varje klipp, så bild och ljud byter takt tillsammans.
 * Allt syntetiseras här; inget är lånat.
 *
 * Kör: node scripts/skriv-ljud-sajt.mjs  ->  public/ljud-sajt.wav
 */
import { readFileSync, writeFileSync } from "node:fs";

const T = JSON.parse(readFileSync(new URL("../src/sajt/tidslinje.json", import.meta.url)));
const SR = 48000, N = Math.ceil(T.langd * SR);
const L = new Float32Array(N), R = new Float32Array(N);
const SLAG = 60 / T.bpm;

let fro = 0x2545f491;
const brus = () => { fro ^= fro << 13; fro ^= fro >>> 17; fro ^= fro << 5; return ((fro >>> 0) / 4294967296) * 2 - 1; };
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

function cykel(t, s = 1) {
  const b = Math.floor(t * SR); let fas = 0;
  for (let k = 0; k < Math.floor(0.24 * SR); k++) {
    const tt = k / SR, f = 50 + 75 * Math.exp(-tt * 42);
    fas += 2 * Math.PI * f / SR;
    lagg(b + k, Math.sin(fas) * Math.exp(-tt * 15) * 0.44 * s);
  }
}
function rela(t, s = 1) {
  const b = Math.floor(t * SR), bp = biquad("bp", 4200, 3);
  for (let k = 0; k < Math.floor(0.025 * SR); k++) lagg(b + k, bp(brus()) * Math.exp(-k / SR * 280) * 0.45 * s, 0.3);
}
function ventil(t, s = 1) {
  const b = Math.floor(t * SR), f = biquad("bp", 2700, 1.4);
  for (let k = 0; k < Math.floor(0.05 * SR); k++) {
    const tt = k / SR;
    lagg(b + k, f(brus()) * Math.exp(-tt * 150) * 0.85 * s);
    lagg(b + k, Math.sin(2 * Math.PI * 1900 * tt) * Math.exp(-tt * 95) * 0.12 * s, -0.2);
    lagg(b + k, Math.sin(2 * Math.PI * 95 * tt) * Math.exp(-tt * 60) * 0.32 * s);
  }
  const hp = biquad("hp", 2600, 0.7), lp = biquad("lp", 9500, 0.7), st = b + Math.floor(0.016 * SR);
  for (let k = 0; k < Math.floor(0.45 * SR); k++) {
    const tt = k / SR, env = Math.min(1, tt * 90) * Math.exp(-tt * 8);
    const v = lp(hp(brus())) * env * 0.13 * s;
    lagg(st + k, v, 0.35); lagg(st + k, v * 0.6, -0.35);
  }
}
function ackord(fran, till, noter, s = 1) {
  const b = Math.floor(fran * SR), n = Math.floor((till - fran) * SR);
  const fl = [biquad("lp", 1700, 0.6), biquad("lp", 1700, 0.6)], fa = noter.map(() => [0, 0]);
  for (let k = 0; k < n; k++) {
    const tt = k / SR, tot = n / SR, env = Math.min(1, tt / 0.35) * Math.min(1, (tot - tt) / 0.6);
    let v0 = 0, v1 = 0;
    noter.forEach((no, j) => {
      const f = hz(no);
      fa[j][0] += 2 * Math.PI * f * 0.9985 / SR; fa[j][1] += 2 * Math.PI * f * 1.0015 / SR;
      v0 += Math.sin(fa[j][0]) + 0.2 * Math.sin(fa[j][0] * 2);
      v1 += Math.sin(fa[j][1]) + 0.2 * Math.sin(fa[j][1] * 2);
    });
    const g = env * 0.06 * s / Math.sqrt(noter.length);
    if (b + k < N) { L[b + k] += fl[0](v0) * g; R[b + k] += fl[1](v1) * g; }
  }
}
/** Tryckluft som stiger mot första klippet. */
function stigning(fran, till) {
  const b = Math.floor(fran * SR), n = Math.floor((till - fran) * SR), bp = biquad("bp", 4800, 0.6);
  for (let k = 0; k < n; k++) {
    const x = k / n;
    lagg(b + k, bp(brus()) * Math.pow(x, 2.2) * 0.22, 0.1);
  }
}

// ── Kompositionen ───────────────────────────────────────────────────────
// Inledningen: en lätt puls, ett tick per textrad, luft som stiger mot klippet.
for (let t = 0.5; t < T.klipp[0] - 1e-6; t += SLAG) cykel(t, 0.45);
T.rader.forEach((t) => rela(t, 1.3));
stigning(1.4, T.klipp[0]);
ackord(0.1, T.klipp[0] + 0.15, [50, 57, 62, 66], 0.55);          // D, svagt

// Sajten: full takt, en ventil vid varje klipp, ett ackord per bild.
const ackordPerKlipp = [
  [50, 57, 62, 66],   // D
  [47, 54, 59, 62],   // Bm
  [43, 50, 55, 59],   // G
  [45, 52, 57, 61],   // A
  [45, 52, 57, 62],   // Asus4 -- spänning in i stycklistan
  [47, 54, 59, 62],   // Bm
];
T.klipp.forEach((t, i) => {
  const till = i < T.klipp.length - 1 ? T.klipp[i + 1] : T.uppmaning;
  ackord(t - 0.05, till + 0.2, ackordPerKlipp[i] ?? ackordPerKlipp[0]);
  ventil(t, i === 0 ? 1.1 : 0.9);
});
for (let t = T.klipp[0]; t < T.uppmaning - 1e-6; t += SLAG) {
  const istakt = Math.round((t - T.klipp[0]) / SLAG) % 2 === 0;
  cykel(t, istakt ? 1 : 0.6);
  rela(t + SLAG / 2, 0.75);
}

// Uppmaningen: allt löses upp i ett D-dur som får klinga ut.
ventil(T.uppmaning, 1.15);
cykel(T.uppmaning, 1.1);
ackord(T.uppmaning - 0.05, T.langd, [38, 50, 57, 62, 66, 69], 1.2);

// ── Mastring ────────────────────────────────────────────────────────────
let topp = 0;
for (let i = 0; i < N; i++) topp = Math.max(topp, Math.abs(L[i]), Math.abs(R[i]));
const forst = 0.89 / (topp || 1), fadeUt = Math.floor(1.2 * SR);
const ut = Buffer.alloc(44 + N * 4);
for (let i = 0; i < N; i++) {
  const fade = i > N - fadeUt ? (N - i) / fadeUt : 1;
  ut.writeInt16LE(Math.round(Math.max(-1, Math.min(1, Math.tanh(L[i] * forst * 1.15) * fade)) * 32767), 44 + i * 4);
  ut.writeInt16LE(Math.round(Math.max(-1, Math.min(1, Math.tanh(R[i] * forst * 1.15) * fade)) * 32767), 46 + i * 4);
}
ut.write("RIFF", 0); ut.writeUInt32LE(36 + N * 4, 4); ut.write("WAVE", 8);
ut.write("fmt ", 12); ut.writeUInt32LE(16, 16); ut.writeUInt16LE(1, 20); ut.writeUInt16LE(2, 22);
ut.writeUInt32LE(SR, 24); ut.writeUInt32LE(SR * 4, 28); ut.writeUInt16LE(4, 32); ut.writeUInt16LE(16, 34);
ut.write("data", 36); ut.writeUInt32LE(N * 4, 40);
writeFileSync(new URL("../public/ljud-sajt.wav", import.meta.url), ut);
console.log(`ljud-sajt.wav: ${T.langd} s, ${(ut.length / 1048576).toFixed(1)} MB`);
