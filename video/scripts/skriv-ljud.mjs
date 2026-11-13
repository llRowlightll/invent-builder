/**
 * Maskinvals trailerljud, syntetiserat från grunden. Inga samplingar, inget
 * lånat spår -- allt räknas fram här, så det finns ingen upphovsrätt som kan
 * få LinkedIn att stänga av ljudet.
 *
 * Idén: musiken ÄR maskinen. Takten är en produktionslinjes cykel, varje nytt
 * fall landar på en magnetventil som slår om och pyser ut tryckluft, och när
 * systemet underkänner en komponent STANNAR takten. Tystnad, en låg ton,
 * sedan startar maskinen igen.
 *
 * Kör: node scripts/skriv-ljud.mjs  ->  public/ljud.wav (48 kHz, 16 bit, stereo)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const T = JSON.parse(readFileSync(new URL("../src/tidslinje.json", import.meta.url)));
const SR = 48000;
const N = Math.ceil(T.langd * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);
const SLAG = 60 / T.bpm;                       // 0,5 s per slag vid 120 bpm

// Deterministiskt brus, så att varje rendering låter exakt likadant.
let fro = 0x9e3779b9;
const brus = () => {
  fro ^= fro << 13; fro ^= fro >>> 17; fro ^= fro << 5;
  return ((fro >>> 0) / 4294967296) * 2 - 1;
};

/** Biquad enligt RBJ:s kokbok. typ: "lp" | "hp" | "bp". */
function biquad(typ, f, q) {
  const w = 2 * Math.PI * f / SR, c = Math.cos(w), a = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (typ === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
  else if (typ === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
  else { b0 = a; b1 = 0; b2 = -a; }
  const a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

const lagg = (i, v, pan = 0) => {
  if (i < 0 || i >= N) return;
  L[i] += v * (1 - Math.max(0, pan));
  R[i] += v * (1 + Math.min(0, pan));
};
const hz = (not) => 440 * Math.pow(2, (not - 69) / 12);   // MIDI-nummer -> Hz

// ── Ljudelementen ───────────────────────────────────────────────────────

/** Maskinens takt: en mjuk, låg stöt. En cykel, inte en danstrumma. */
function cykel(t, styrka = 1) {
  const s = Math.floor(t * SR), n = Math.floor(0.28 * SR);
  let fas = 0;
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    const f = 48 + 70 * Math.exp(-tt * 38);           // tonhöjden faller som en kolv i ändläge
    fas += 2 * Math.PI * f / SR;
    lagg(s + k, Math.sin(fas) * Math.exp(-tt * 14) * 0.42 * styrka);
  }
}

/** Ett relä som slår: ett torrt tick mellan cyklerna. */
function rela(t, styrka = 1) {
  const s = Math.floor(t * SR), n = Math.floor(0.03 * SR);
  const bp = biquad("bp", 3800, 3.2);
  for (let k = 0; k < n; k++) {
    lagg(s + k, bp(brus()) * Math.exp(-k / SR * 260) * 0.5 * styrka, 0.25);
  }
}

/** Magnetventilen slår om: smäll, metallisk ping, sedan tryckluft som pyser ut. */
function ventil(t) {
  const s = Math.floor(t * SR);
  const smallFilt = biquad("bp", 2600, 1.4);
  for (let k = 0; k < Math.floor(0.05 * SR); k++) {
    const tt = k / SR;
    lagg(s + k, smallFilt(brus()) * Math.exp(-tt * 140) * 0.9);
    lagg(s + k, Math.sin(2 * Math.PI * 1850 * tt) * Math.exp(-tt * 90) * 0.14, -0.2);
    lagg(s + k, Math.sin(2 * Math.PI * 92 * tt) * Math.exp(-tt * 60) * 0.35);
  }
  // Avluftningen: ljust, filtrerat brus som andas ut på en halv sekund.
  const hp = biquad("hp", 2400, 0.7), lp = biquad("lp", 9000, 0.7);
  const start = s + Math.floor(0.018 * SR), n = Math.floor(0.62 * SR);
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    const env = Math.min(1, tt * 90) * Math.exp(-tt * 6.5);
    const v = lp(hp(brus())) * env * 0.16;
    lagg(start + k, v, 0.35);
    lagg(start + k, v * 0.6, -0.35);
  }
}

/** Ett lugnt ackord som ligger under. Sinus och svag överton, mjukt filtrerat. */
function ackord(fran, till, noter, styrka = 1) {
  const s = Math.floor(fran * SR), e = Math.floor(till * SR);
  const n = e - s;
  const filt = [biquad("lp", 1400, 0.6), biquad("lp", 1400, 0.6)];
  const faser = noter.map(() => [0, 0]);
  for (let k = 0; k < n; k++) {
    const tt = k / SR, tot = n / SR;
    const env = Math.min(1, tt / 0.9) * Math.min(1, (tot - tt) / 1.1);   // mjuka över­gångar
    let v0 = 0, v1 = 0;
    noter.forEach((not, j) => {
      const f = hz(not);
      faser[j][0] += 2 * Math.PI * f * 0.9985 / SR;   // svag svävning ger bredd
      faser[j][1] += 2 * Math.PI * f * 1.0015 / SR;
      const ton0 = Math.sin(faser[j][0]) + 0.18 * Math.sin(faser[j][0] * 2);
      const ton1 = Math.sin(faser[j][1]) + 0.18 * Math.sin(faser[j][1] * 2);
      v0 += ton0; v1 += ton1;
    });
    const g = env * 0.055 * styrka / Math.sqrt(noter.length);
    L[s + k] += filt[0](v0) * g;
    R[s + k] += filt[1](v1) * g;
  }
}

/** Den låga tonen när maskinen har stannat. */
function lagTon(t) {
  const s = Math.floor(t * SR), n = Math.floor(3.2 * SR);
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    const env = Math.min(1, tt * 6) * Math.exp(-tt * 0.9);
    const v = (Math.sin(2 * Math.PI * hz(33) * tt) + 0.25 * Math.sin(2 * Math.PI * hz(45) * tt)) * env * 0.33;
    lagg(s + k, v);
  }
}

/** Tryckluft i bakgrunden, som andning under inledningen. */
function luft(fran, till, styrka) {
  const s = Math.floor(fran * SR), n = Math.floor((till - fran) * SR);
  const bp = biquad("bp", 5200, 0.5);
  for (let k = 0; k < n; k++) {
    const tt = k / SR, tot = n / SR;
    const env = Math.sin(Math.PI * Math.min(1, tt / tot)) * styrka;
    lagg(s + k, bp(brus()) * env * 0.05, 0.1);
  }
}

// ── Kompositionen ───────────────────────────────────────────────────────

// Inledning: luft som andas, ett ackord som tonas in. Ingen takt än.
luft(0, 4.6, 1);
ackord(0.4, 4.4, [50, 57, 62, 65]);                  // D-moll, öppen

// Fallen: ett ackord per fall, takten igång, en ventil som slår om vid varje start.
const fallAckord = [
  [50, 57, 62, 65],   // Dm
  [46, 53, 58, 62],   // Bb
  [53, 60, 64, 69],   // F
  [48, 55, 60, 64],   // C
  [50, 57, 62, 65],   // Dm
  [46, 53, 58, 62],   // Bb -- härdningen, där det går fel
];
T.fall.forEach((start, i) => {
  const slut = i < T.fall.length - 1 ? T.fall[i + 1] : T.stopp;
  ackord(start - 0.2, slut + 0.3, fallAckord[i], i === 5 ? 1.15 : 1);
  ventil(start);
});

// Takten går från första fallet fram till stoppet.
for (let t = T.fall[0]; t < T.stopp - 1e-6; t += SLAG) {
  const istakt = Math.round((t - T.fall[0]) / SLAG) % 2 === 0;
  cykel(t, istakt ? 1 : 0.62);
  rela(t + SLAG / 2, 0.8);
}

// STOPPET. Ingenting mellan T.stopp och T.lagTon -- tystnaden är poängen.
lagTon(T.lagTon);

// Maskinen startar igen: ljusare tonart, takten tillbaka.
ventil(T.atergang);
ackord(T.atergang - 0.1, T.avslut + 0.3, [50, 57, 62, 66]);      // D-dur
ackord(T.avslut - 0.2, T.langd, [45, 52, 57, 61, 64]);           // A, öppen -> löses upp
for (let t = T.atergang; t < T.pulsSlut - 1e-6; t += SLAG) {
  const istakt = Math.round((t - T.atergang) / SLAG) % 2 === 0;
  cykel(t, istakt ? 0.9 : 0.55);
  rela(t + SLAG / 2, 0.65);
}
ventil(T.avslut);
// Sista andningen: luften pyser ut när maskinen stängs av.
luft(T.pulsSlut - 0.5, T.langd, 0.8);

// ── Mastring ────────────────────────────────────────────────────────────
// Hitta toppen, normalisera och runda av mjukt. Ingen hård klippning.
let topp = 0;
for (let i = 0; i < N; i++) topp = Math.max(topp, Math.abs(L[i]), Math.abs(R[i]));
const forst = 0.89 / (topp || 1);
const fadeUt = Math.floor(1.4 * SR);
const ut = Buffer.alloc(44 + N * 4);
for (let i = 0; i < N; i++) {
  const fade = i > N - fadeUt ? (N - i) / fadeUt : 1;
  const l = Math.tanh(L[i] * forst * 1.15) * fade;
  const r = Math.tanh(R[i] * forst * 1.15) * fade;
  ut.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l)) * 32767), 44 + i * 4);
  ut.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r)) * 32767), 46 + i * 4);
}
// WAV-huvudet.
ut.write("RIFF", 0); ut.writeUInt32LE(36 + N * 4, 4); ut.write("WAVE", 8);
ut.write("fmt ", 12); ut.writeUInt32LE(16, 16); ut.writeUInt16LE(1, 20); ut.writeUInt16LE(2, 22);
ut.writeUInt32LE(SR, 24); ut.writeUInt32LE(SR * 4, 28); ut.writeUInt16LE(4, 32); ut.writeUInt16LE(16, 34);
ut.write("data", 36); ut.writeUInt32LE(N * 4, 40);

mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/ljud.wav", import.meta.url), ut);
console.log(`ljud.wav: ${T.langd} s, ${(ut.length / 1048576).toFixed(1)} MB, topp före mastring ${topp.toFixed(2)}`);
