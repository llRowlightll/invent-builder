/**
 * Startsidans sprängskiss: en fotorealistisk ISO 15552-cylinder Ø50 som
 * plockas isär när man scrollar.
 *
 * Ägaren 2026-11-16: "den börjar med cylindern, sen när man skrollar ned så
 * öppnar den upp sig som sprängskiss ... som när man demonterar en bil".
 * Ska se ut som en riktig cylinder, inte en skiss, och ha lika många delar
 * som en riktig reservdelsritning.
 *
 * Ramverksoberoende (ren three.js) så att samma modul driver både
 * testsidan och startsidan. Inga externa resurser: miljöljuset kommer från
 * RoomEnvironment, så ingen HDR-fil hämtas.
 *
 * Delarna och måtten följer en profilcylinder ISO 15552 Ø50: profilrör 64 mm
 * med givarspår och skruvkanaler, gavlar med port G1/4 och dämpskruv, fyra
 * insexskruvar per gavel, kolv med styrband, magnetring och två
 * läpptätningar, dämphylsor, dämptätningar, O-ringar mot röret,
 * bronsbussning och avstrykare i främre gaveln, kolvstång Ø20 med M16-gänga
 * och kolvstångsmutter.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

export interface CylinderScen {
  /** Scrollframsteg 0 (hel) till 1 (isärplockad). */
  setProgress(p: number): void;
  /** Läs om canvasens storlek (anropa vid resize). */
  resize(): void;
  /** Utanför vyn: sluta rita. */
  setActive(on: boolean): void;
  dispose(): void;
}

const S = 0.01; // 1 enhet = 100 mm
const L = 220; // profilrörets längd
const KAP = 32; // gavelns tjocklek
const KOLV_X = -84; // kolven i bakre ändläget

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ── Material ───────────────────────────────────────────────────────────────
/** Borstningsränder: brus i längsled, används som ytstruktur på aluminium. */
function borstning(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#8a8a8a"; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 2600; i++) {
    const y = Math.random() * c.height, v = 110 + Math.random() * 60;
    g.fillStyle = `rgba(${v},${v},${v},${0.10 + Math.random() * 0.18})`;
    g.fillRect(Math.random() * c.width, y, 60 + Math.random() * 520, 0.6 + Math.random() * 0.9);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 6);
  return tex;
}

function material() {
  const b = borstning();
  return {
    // Eloxerat profilrör: borstat, satin
    alu: new THREE.MeshPhysicalMaterial({ color: 0xb9bfc7, metalness: 0.72, roughness: 0.46, clearcoat: 0.2, clearcoatRoughness: 0.5, roughnessMap: b, bumpMap: b, bumpScale: 0.25, anisotropy: 0.6 }),
    // Gavlarna: blästrade, mattare
    gavel: new THREE.MeshPhysicalMaterial({ color: 0xaeb5bd, metalness: 0.78, roughness: 0.58 }),
    krom: new THREE.MeshPhysicalMaterial({ color: 0xeef1f4, metalness: 1, roughness: 0.13 }),
    stal: new THREE.MeshPhysicalMaterial({ color: 0x9aa1aa, metalness: 1, roughness: 0.32 }),
    svartStal: new THREE.MeshPhysicalMaterial({ color: 0x24272d, metalness: 0.8, roughness: 0.42 }),
    gummi: new THREE.MeshPhysicalMaterial({ color: 0x141619, metalness: 0, roughness: 0.62, sheen: 0.3, sheenRoughness: 0.8 }),
    magnet: new THREE.MeshPhysicalMaterial({ color: 0x3b4048, metalness: 0.6, roughness: 0.48 }),
    brons: new THREE.MeshPhysicalMaterial({ color: 0xb08249, metalness: 1, roughness: 0.4 }),
    pom: new THREE.MeshPhysicalMaterial({ color: 0xe3dfd4, metalness: 0, roughness: 0.5, sheen: 0.2 }),
    hal: new THREE.MeshStandardMaterial({ color: 0x050608, metalness: 0, roughness: 1 }),
  };
}
type Mat = ReturnType<typeof material>;

// ── Geometrihjälp ──────────────────────────────────────────────────────────
/** Svarvad del längs X: profil som [radie, läge längs axeln] (mm). */
function svarv(profil: [number, number][], segment = 64): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(profil.map(([r, x]) => new THREE.Vector2(r, x)), segment);
  g.rotateZ(-Math.PI / 2); // lathens Y-axel blir X
  return g;
}
/** Rör med inner- och ytterradie och fasade kanter, längs X, centrerat. */
function ring(ri: number, ro: number, bredd: number, fas = 0.6, segment = 64) {
  const h = bredd / 2;
  return svarv([[ri, -h + fas], [ri + fas, -h], [ro - fas, -h], [ro, -h + fas], [ro, h - fas], [ro - fas, h], [ri + fas, h], [ri, h - fas], [ri, -h + fas]], segment);
}
/** Gänga: sicksackprofil längs X. */
function ganga(r: number, langd: number, stigning: number, djup: number): [number, number][] {
  const p: [number, number][] = [];
  const steg = Math.floor(langd / (stigning / 2));
  for (let i = 0; i <= steg; i++) p.push([i % 2 === 0 ? r : r - djup, i * (stigning / 2)]);
  return p;
}
function mesh(g: THREE.BufferGeometry, m: THREE.Material) {
  const o = new THREE.Mesh(g, m);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

// ── Delarna ────────────────────────────────────────────────────────────────
function profilror(m: Mat) {
  // Tvärsnitt 64×64 med rundade hörn, borrning Ø50, T-spår på tre sidor och
  // fyra skruvkanaler i hörnen.
  const a = 32, r = 7;
  const s = new THREE.Shape();
  s.moveTo(-a + r, -a);
  s.lineTo(-3, -a); s.lineTo(-3, -a + 4); s.lineTo(3, -a + 4); s.lineTo(3, -a); // spår undertill
  s.lineTo(a - r, -a); s.quadraticCurveTo(a, -a, a, -a + r);
  s.lineTo(a, -3); s.lineTo(a - 4, -3); s.lineTo(a - 4, 3); s.lineTo(a, 3); // spår höger
  s.lineTo(a, a - r); s.quadraticCurveTo(a, a, a - r, a);
  s.lineTo(3, a); s.lineTo(3, a - 4); s.lineTo(-3, a - 4); s.lineTo(-3, a); // spår ovan
  s.lineTo(-a + r, a); s.quadraticCurveTo(-a, a, -a, a - r);
  s.lineTo(-a, 3); s.lineTo(-a + 4, 3); s.lineTo(-a + 4, -3); s.lineTo(-a, -3); // spår mot betraktaren
  s.lineTo(-a, -a + r); s.quadraticCurveTo(-a, -a, -a + r, -a);
  const borr = new THREE.Path(); borr.absarc(0, 0, 25, 0, Math.PI * 2, true); s.holes.push(borr);
  for (const [y, z] of [[-22.5, -22.5], [22.5, -22.5], [22.5, 22.5], [-22.5, 22.5]]) {
    const h = new THREE.Path(); h.absarc(y, z, 3, 0, Math.PI * 2, true); s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: true, bevelThickness: 1.4, bevelSize: 1.1, bevelSegments: 4, curveSegments: 48 });
  g.translate(0, 0, -L / 2);
  g.rotateY(Math.PI / 2);
  return mesh(g, m.alu);
}

function gavel(m: Mat, fram: boolean) {
  const g = new THREE.Group();
  const kropp = mesh(new RoundedBoxGeometry(KAP, 66, 66, 6, 6), m.gavel);
  g.add(kropp);
  const ut = fram ? 1 : -1;
  // Försänkningar för skruvarna på yttre sidan
  for (const [y, z] of [[-22.5, -22.5], [22.5, -22.5], [22.5, 22.5], [-22.5, 22.5]]) {
    const f = mesh(new THREE.CylinderGeometry(5.6, 5.6, 1, 32), m.hal);
    f.rotation.z = Math.PI / 2; f.position.set(ut * (KAP / 2 + 0.01), y, z); g.add(f);
  }
  // Port G1/4 ovanpå
  const port = mesh(new THREE.CylinderGeometry(9, 9, 1.6, 40), m.gavel); port.position.set(-ut * 2, 33.6, 0); g.add(port);
  const portHal = mesh(new THREE.CylinderGeometry(6.4, 6.4, 1.8, 40), m.hal); portHal.position.set(-ut * 2, 33.8, 0); g.add(portHal);
  if (fram) {
    // Lagerhuset där stången går ut
    const nav = mesh(ring(10.4, 16, 8, 0.8), m.gavel); nav.position.x = KAP / 2 + 4; g.add(nav);
    // Stånghålet ska läsas som ett hål, inte som gavelns massiva insida.
    const hal = mesh(new THREE.CylinderGeometry(10.4, 10.4, 0.6, 40), m.hal);
    hal.rotation.z = Math.PI / 2; hal.position.x = KAP / 2 + 0.5; g.add(hal);
  } else {
    // Bakre gavelns gavelyta med anslutningsspår
    const spar = mesh(ring(12, 18, 1.2, 0.2), m.hal); spar.position.x = -KAP / 2 - 0.3; g.add(spar);
  }
  return g;
}

function skruv(m: Mat) {
  // Insexskruv M6×30: huvud Ø10×6, gängad stam längs +X.
  const g = new THREE.Group();
  const huvud = mesh(svarv([[0, -6], [4.4, -6], [5, -5.4], [5, -0.4], [4.6, 0], [0, 0]], 40), m.svartStal);
  g.add(huvud);
  const insex = mesh(new THREE.CylinderGeometry(2.6, 2.6, 3.6, 6), m.hal);
  insex.rotation.z = Math.PI / 2; insex.position.x = -5.2; g.add(insex);
  const stam = mesh(svarv([[0, 0], ...ganga(3, 30, 1, 0.45), [0, 30]], 32), m.svartStal);
  g.add(stam);
  return g;
}

function dampskruv(m: Mat) {
  // Dämpskruv med spår, sticker ut ur gavelns sida (längs Z).
  const g = new THREE.Group();
  const kropp = mesh(svarv([[0, 0], ...ganga(3.4, 9, 0.8, 0.35), [3.9, 9], [4.2, 9.6], [4.2, 12], [0, 12]], 32), m.brons);
  const spar = mesh(new THREE.BoxGeometry(0.9, 8, 1.4), m.hal); spar.position.x = 12.2;
  g.add(kropp, spar);
  g.rotation.y = -Math.PI / 2; // axeln längs +Z
  return g;
}

function kolv(m: Mat) {
  // Svarvad kolv Ø49 med spår för tätningar, styrband och magnetring.
  return mesh(svarv([
    [5, -14], [23.5, -14], [24.4, -13.2], [24.4, -12], [21, -12], [21, -8.6], [24.4, -8.6],
    [24.4, -4.4], [23, -4.4], [23, 4.4], [24.4, 4.4], [24.4, 8.6], [21, 8.6], [21, 12],
    [24.4, 12], [24.4, 13.2], [23.5, 14], [5, 14], [5, -14],
  ]), m.alu);
}

const lapptatning = (m: Mat) => mesh(svarv([[21.2, -1.7], [24.9, -1.7], [25.2, -0.6], [24.2, 0.2], [25.1, 1.7], [21.2, 1.7], [21.2, -1.7]]), m.gummi);
const styrband = (m: Mat) => mesh(ring(23.05, 24.7, 8.4, 0.3), m.pom);
const magnetring = (m: Mat) => mesh(ring(19.2, 22.9, 3.6, 0.4), m.magnet);

function stang(m: Mat) {
  // Kolvstång Ø20, 300 mm, med fas, urtag och M16-gänga i änden.
  const lang = 300, gangLangd = 22;
  const p: [number, number][] = [[0, 0], [9.4, 0], [10, 0.6], [10, lang - gangLangd - 6], [9.2, lang - gangLangd - 5], [9.2, lang - gangLangd - 3], [8, lang - gangLangd]];
  for (const [r, x] of ganga(8, gangLangd, 1.5, 0.8)) p.push([r, lang - gangLangd + x]);
  p.push([7.2, lang], [0, lang]);
  const g = mesh(svarv(p, 64), m.krom);
  g.position.x = -lang / 2;
  const o = new THREE.Group(); o.add(g);
  return o;
}

function mutter(m: Mat, nyckel: number, hojd: number, hal: number) {
  const g = new THREE.Group();
  const r = nyckel / Math.sqrt(3);
  const kropp = mesh(new THREE.CylinderGeometry(r, r, hojd, 6), m.stal);
  kropp.rotation.z = Math.PI / 2; g.add(kropp);
  const halet = mesh(new THREE.CylinderGeometry(hal, hal, hojd + 1.8, 32), m.hal);
  halet.rotation.z = Math.PI / 2; g.add(halet);
  return g;
}

const damphylsa = (m: Mat) => mesh(svarv([[10.1, -9], [11.6, -9], [12.6, -7.6], [12.6, 9], [10.1, 9], [10.1, -9]]), m.stal);
const dampkolvBak = (m: Mat) => mesh(svarv([[0, -8], [10, -8], [11, -7], [11, 8], [0, 8]]), m.stal);
const dampTatning = (m: Mat) => mesh(new THREE.TorusGeometry(12.6, 1.9, 18, 56).rotateY(Math.PI / 2), m.gummi);
const oring = (m: Mat) => mesh(new THREE.TorusGeometry(26.6, 1.35, 16, 72).rotateY(Math.PI / 2), m.gummi);
const bussning = (m: Mat) => mesh(svarv([[10.1, -10], [13.4, -10], [14, -9.4], [14, 9.4], [13.4, 10], [10.1, 10], [10.1, -10]]), m.brons);
const avstrykare = (m: Mat) => mesh(svarv([[10, -2.6], [14.6, -2.6], [14.6, 2.6], [12.2, 2.6], [10, 0.4], [10, -2.6]]), m.gummi);

// ── Rörelserna ─────────────────────────────────────────────────────────────
interface Del {
  obj: THREE.Object3D;
  hop: THREE.Vector3;
  /** Valfri mellanstation (följer med en annan del först). */
  via?: { pos: THREE.Vector3; fonster: [number, number] };
  isar: THREE.Vector3;
  fonster: [number, number];
  /** Skruvar och muttrar vrids loss: varv runt X under rörelsen. */
  varv?: number;
  /** Startvridning (t.ex. främre skruvar pekar åt andra hållet). */
  bas?: THREE.Euler;
}

const V = (x: number, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function byggDelar(m: Mat): Del[] {
  const d: Del[] = [];
  const add = (obj: THREE.Object3D, del: Omit<Del, "obj">) => { d.push({ obj, ...del }); };

  // Steg 1: gavlarna glider av, skruvarna vrids loss, tätningarna följer.
  const kapBak = -L / 2 - KAP / 2, kapFram = L / 2 + KAP / 2;
  add(gavel(m, false), { hop: V(kapBak), isar: V(-330), fonster: [0.08, 0.3] });
  add(gavel(m, true), { hop: V(kapFram), isar: V(330), fonster: [0.08, 0.3] });
  const hornen: [number, number][] = [[-22.5, -22.5], [22.5, -22.5], [22.5, 22.5], [-22.5, 22.5]];
  hornen.forEach(([y, z], i) => {
    add(skruv(m), { hop: V(kapBak - KAP / 2, y, z), isar: V(-410 - i * 6, y * 1.35, z * 1.35), fonster: [0.06 + i * 0.012, 0.24 + i * 0.012], varv: 5 });
    add(skruv(m), { hop: V(kapFram + KAP / 2, y, z), isar: V(470 + i * 6, y * 1.35, z * 1.35), fonster: [0.06 + i * 0.012, 0.24 + i * 0.012], varv: -5, bas: new THREE.Euler(0, Math.PI, 0) });
  });
  add(dampskruv(m), { hop: V(kapBak + 4, 0, 24), via: { pos: V(-330 + 4, 0, 24), fonster: [0.08, 0.3] }, isar: V(-326, 0, 78), fonster: [0.28, 0.42], varv: 0 });
  add(dampskruv(m), { hop: V(kapFram - 4, 0, 24), via: { pos: V(330 - 4, 0, 24), fonster: [0.08, 0.3] }, isar: V(326, 0, 78), fonster: [0.28, 0.42], varv: 0 });
  add(oring(m), { hop: V(-L / 2 + 1), isar: V(-232), fonster: [0.12, 0.34] });
  add(oring(m), { hop: V(L / 2 - 1), isar: V(222), fonster: [0.12, 0.34] });
  add(dampTatning(m), { hop: V(-L / 2 - 8), isar: V(-262), fonster: [0.14, 0.36] });
  add(dampTatning(m), { hop: V(L / 2 + 8), isar: V(252), fonster: [0.14, 0.36] });
  // Bussning och avstrykare följer främre gaveln och dras sedan ut ur den.
  add(bussning(m), { hop: V(kapFram + 2), via: { pos: V(330 + 2), fonster: [0.08, 0.3] }, isar: V(392), fonster: [0.34, 0.5] });
  add(avstrykare(m), { hop: V(kapFram + KAP / 2 + 5.4), via: { pos: V(330 + KAP / 2 + 5.4), fonster: [0.08, 0.3] }, isar: V(428), fonster: [0.36, 0.52] });

  // Steg 2: profilröret lyfts och visar kolven.
  add(profilror(m), { hop: V(0), isar: V(10, 158, 0), fonster: [0.28, 0.48] });

  // Steg 3: kolvpaketet sprids längs axeln, stången sänks.
  add(dampkolvBak(m), { hop: V(KOLV_X - 22), isar: V(-178), fonster: [0.46, 0.66] });
  add(lapptatning(m), { hop: V(KOLV_X - 10.3), isar: V(-145), fonster: [0.46, 0.66] });
  add(kolv(m), { hop: V(KOLV_X), isar: V(-98), fonster: [0.46, 0.66] });
  add(styrband(m), { hop: V(KOLV_X), isar: V(-58), fonster: [0.48, 0.68] });
  add(magnetring(m), { hop: V(KOLV_X), isar: V(-28), fonster: [0.48, 0.68] });
  add(lapptatning(m), { hop: V(KOLV_X + 10.3), isar: V(4), fonster: [0.48, 0.68] });
  add(damphylsa(m), { hop: V(KOLV_X + 23), isar: V(52), fonster: [0.5, 0.7] });
  add(stang(m), { hop: V(KOLV_X + 14 + 150), isar: V(150, -128, 0), fonster: [0.5, 0.72] });
  add(mutter(m, 24, 8, 7.6), { hop: V(KOLV_X + 14 + 300 - 14), isar: V(358, -128, 0), fonster: [0.56, 0.76], varv: 4 });
  return d;
}

// ── Scenen ─────────────────────────────────────────────────────────────────
// Heroens bakgrund (src/styles.css): marinblå, fotot på 18 %, guldglöd uppe till höger.
const MARIN = "#203159";
const GULD = "235,136,59";

/** Ritar heroens bakgrund i scenen, så att skärpedjupet kan göra den mjuk. */
function malaBakgrund(w: number, h: number, bild: HTMLImageElement | null): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  const skala = Math.min(1, 1600 / Math.max(w, 1));
  c.width = Math.max(2, Math.round(w * skala)); c.height = Math.max(2, Math.round(h * skala));
  const g = c.getContext("2d")!;
  g.fillStyle = MARIN; g.fillRect(0, 0, c.width, c.height);
  if (bild && bild.naturalWidth) {
    const k = Math.max(c.width / bild.naturalWidth, c.height / bild.naturalHeight);
    const bw = bild.naturalWidth * k, bh = bild.naturalHeight * k;
    g.globalAlpha = 0.18;
    g.drawImage(bild, (c.width - bw) / 2, (c.height - bh) * 0.4, bw, bh);
    g.globalAlpha = 1;
  }
  g.save();
  g.translate(c.width * 0.8, c.height * 0.2);
  g.scale(c.width * 0.6, c.height * 0.5);
  const r = g.createRadialGradient(0, 0, 0, 0, 0, 0.7);
  r.addColorStop(0, `rgba(${GULD},0.18)`); r.addColorStop(1, `rgba(${GULD},0)`);
  g.fillStyle = r; g.fillRect(-2, -2, 4, 4);
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Filmkorn och vinjett: det sista som gör en rendering till ett fotografi. */
const KORN = {
  uniforms: { tDiffuse: { value: null }, uKorn: { value: 0.035 }, uVinj: { value: 0.35 }, uUpp: { value: new THREE.Vector2(1920, 1080) } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uKorn; uniform float uVinj; uniform vec2 uUpp; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float n = rnd(floor(vUv * uUpp)) - 0.5;
      c.rgb += n * uKorn * (0.6 + 0.4 * (1.0 - dot(c.rgb, vec3(0.333))));
      float d = distance(vUv, vec2(0.5, 0.52));
      c.rgb *= mix(1.0, smoothstep(0.95, 0.28, d), uVinj);
      gl_FragColor = c;
    }`,
};

export function skapaCylinderScen(canvas: HTMLCanvasElement, opts: { statisk?: boolean; bakgrund?: string } = {}): CylinderScen {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Neutral tonmappning håller heroens marinblå och guld nära originalet.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(MARIN);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.72;

  let bild: HTMLImageElement | null = null;
  let bakgrundTex: THREE.CanvasTexture | null = null;
  const nyBakgrund = () => {
    const w = canvas.clientWidth || 1600, h = canvas.clientHeight || 900;
    bakgrundTex?.dispose();
    bakgrundTex = malaBakgrund(w, h, bild);
    scene.background = bakgrundTex;
  };
  if (opts.bakgrund) {
    bild = new Image();
    bild.onload = () => { nyBakgrund(); vack(); };
    bild.src = opts.bakgrund;
  }

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

  const nyckel = new THREE.DirectionalLight(0xfff6ee, 1.35);
  nyckel.position.set(4, 9, 6);
  nyckel.castShadow = true;
  nyckel.shadow.mapSize.set(2048, 2048);
  nyckel.shadow.camera.left = -8; nyckel.shadow.camera.right = 8;
  nyckel.shadow.camera.top = 6; nyckel.shadow.camera.bottom = -6;
  nyckel.shadow.camera.near = 1; nyckel.shadow.camera.far = 30;
  nyckel.shadow.bias = -0.0004;
  nyckel.shadow.radius = 12;
  const kant = new THREE.DirectionalLight(0xffb070, 1.5); // varm kant, Maskinvals orange
  kant.position.set(-6, 3, -5);
  const fyll = new THREE.DirectionalLight(0x9db8e0, 0.5); // kall fyllnad från heron
  fyll.position.set(-3, -2, 6);
  // Studions reflexskiva underifrån: undersidorna blir aldrig svarta.
  const studsljus = new THREE.HemisphereLight(0xe9eef5, 0x2a3a66, 0.55);
  scene.add(nyckel, kant, fyll, studsljus);

  const golv = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.22 }));
  golv.rotation.x = -Math.PI / 2;
  golv.position.y = -2.2;
  golv.receiveShadow = true;
  scene.add(golv);

  const m = material();
  const rot = new THREE.Group(); // vrids och flyttas med scrollen
  const modell = new THREE.Group(); modell.scale.setScalar(S);
  rot.add(modell);
  scene.add(rot);
  const delar = byggDelar(m);
  for (const del of delar) {
    if (del.bas) del.obj.rotation.copy(del.bas);
    del.obj.position.copy(del.hop);
    modell.add(del.obj);
  }

  // Efterbehandling: skärpedjup som ett objektiv, tonmappning och filmkorn. Kantutjämning med 4x MSAA i målbufferten.
  const mal0 = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, mal0);
  composer.addPass(new RenderPass(scene, camera));
  const skarpa = new BokehPass(scene, camera, { focus: 9, aperture: 0.0016, maxblur: 0.006 });
  composer.addPass(skarpa);
  composer.addPass(new OutputPass());
  const korn = new ShaderPass(KORN);
  composer.addPass(korn);

  let mal = opts.statisk ? 1 : 0, visad = mal, raf = 0, aktiv = true, senast = 0;
  const t0 = performance.now();
  const tmp = new THREE.Vector3();

  function stall(p: number, tid: number) {
    for (const del of delar) {
      const e = ss(del.fonster[0], del.fonster[1], p);
      if (del.via) {
        const ev = ss(del.via.fonster[0], del.via.fonster[1], p);
        tmp.copy(del.hop).lerp(del.via.pos, ev).lerp(del.isar, e);
      } else tmp.copy(del.hop).lerp(del.isar, e);
      del.obj.position.copy(tmp);
      if (del.varv) {
        const bas = del.bas ? del.bas.x : 0;
        del.obj.rotation.x = bas + del.varv * Math.PI * 2 * e;
      }
    }
    // Kameran: nära och snett bakifrån när den är hel, drar sig bakåt och
    // vrids så att hela sprängskissen syns i vila.
    const g = ss(0.04, 0.8, p);
    const asp = Math.max(0.5, camera.aspect);
    const tanV = Math.tan(THREE.MathUtils.degToRad(15));
    // Isärplockad ska hela skissen få plats med marginal (±5,8 enheter i bredd).
    const avstandIsar = Math.max(11, 5.8 / (tanV * asp));
    const bred = asp > 1.25;
    const avstandHel = avstandIsar * (bred ? 0.74 : 0.8);
    const avst = THREE.MathUtils.lerp(avstandHel, avstandIsar, g);
    const andning = opts.statisk ? 0 : Math.sin((tid - t0) / 2600) * 0.035 * (1 - g);
    rot.rotation.y = THREE.MathUtils.lerp(-0.62, -0.3, g) + andning;
    rot.rotation.x = THREE.MathUtils.lerp(0.2, 0.26, g);
    // Hel: till höger om heroens text på breda skärmar, under texten på smala.
    // Isär: centrerad, lite åt vänster eftersom främre skruvarna sticker längre ut.
    const halvH = tanV * avstandHel, halvB = halvH * asp;
    const x0 = bred ? halvB * 0.3 : 0;
    const y0 = bred ? -0.35 : -halvH * 0.6;
    rot.position.x = THREE.MathUtils.lerp(x0, -0.35, g);
    rot.position.y = THREE.MathUtils.lerp(y0, 0.12, g);
    camera.position.set(0, THREE.MathUtils.lerp(0.9, 2.2, g), avst);
    // Skärpan ligger på cylinderns mitt; mindre skärpedjup när den är hel och nära.
    const fokusPunkt = tmp.set(rot.position.x + 0.4 * (1 - g), rot.position.y, 0);
    (skarpa.uniforms as Record<string, { value: number }>)["focus"].value = camera.position.distanceTo(fokusPunkt);
    (skarpa.uniforms as Record<string, { value: number }>)["aperture"].value = THREE.MathUtils.lerp(0.0022, 0.0011, g);
    (korn.uniforms as Record<string, { value: number }>)["uVinj"].value = THREE.MathUtils.lerp(0.3, 0.55, g);
    camera.lookAt(0, THREE.MathUtils.lerp(-0.1, 0.1, g), 0);
  }

  function rita(nu: number) {
    const dt = Math.min(100, nu - (senast || nu));
    senast = nu;
    visad += (mal - visad) * (1 - Math.pow(1 - 0.12, dt / 16.667));
    if (Math.abs(mal - visad) < 0.0004) visad = mal;
    stall(visad, nu);
    composer.render();
    // Andningen håller loopen vid liv bara medan cylindern är hel och syns.
    const andas = !opts.statisk && visad < 0.8;
    raf = aktiv && (visad !== mal || andas) ? requestAnimationFrame(rita) : 0;
    if (!raf) senast = 0;
  }
  const vack = () => { if (!raf && aktiv) raf = requestAnimationFrame(rita); };

  function resize() {
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    (korn.uniforms as Record<string, { value: THREE.Vector2 }>)["uUpp"].value.set(w * dpr, h * dpr);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    nyBakgrund();
    vack();
  }
  resize();
  vack();

  return {
    setProgress(p) { mal = Math.min(1, Math.max(0, p)); vack(); },
    resize,
    setActive(on) { aktiv = on; if (on) vack(); else if (raf) { cancelAnimationFrame(raf); raf = 0; senast = 0; } },
    dispose() {
      aktiv = false; if (raf) cancelAnimationFrame(raf);
      scene.traverse((o) => { const me = o as THREE.Mesh; if (me.geometry) me.geometry.dispose(); });
      Object.values(m).forEach((x) => x.dispose());
      env.dispose(); pmrem.dispose(); bakgrundTex?.dispose(); mal0.dispose(); composer.dispose(); renderer.dispose();
    },
  };
}
