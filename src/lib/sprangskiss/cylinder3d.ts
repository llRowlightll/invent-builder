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
 * en fotostudio som byggs i scenen (studio()), så ingen HDR-fil hämtas.
 *
 * Delarna och måtten följer en profilcylinder ISO 15552 Ø50: profilrör 64 mm
 * med givarspår och skruvkanaler, gavlar med port G1/4 och dämpskruv, fyra
 * insexskruvar per gavel, kolv med styrband, magnetring och två
 * läpptätningar, dämphylsor, dämptätningar, O-ringar mot röret,
 * bronsbussning och avstrykare i främre gaveln, kolvstång Ø20 med M16-gänga
 * och kolvstångsmutter.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
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
  /** Hur mycket av canvasen heroens text täcker: andel av bredden från vänster
   *  (bred skärm) och av höjden uppifrån (smal). Den hela cylindern placeras utanför.
   *  `slut`: var slutraden börjar, andel av höjden uppifrån; sprängskissen hålls ovanför. */
  setReserv(r: { hoger?: number; under?: number; slut?: number }): void;
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
  c.width = 2048; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#8a8a8a"; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 9000; i++) {
    const y = Math.random() * c.height, v = 110 + Math.random() * 60;
    g.fillStyle = `rgba(${v},${v},${v},${0.10 + Math.random() * 0.18})`;
    g.fillRect(Math.random() * c.width, y, 60 + Math.random() * 520, 0.6 + Math.random() * 0.9);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  return tex;
}

/** Blästrad yta: fint brus som grovhetskarta. */
function blastring(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const d = g.createImageData(512, 512);
  for (let i = 0; i < d.data.length; i += 4) { const v = 120 + Math.random() * 70; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function material() {
  const b = borstning();
  const bl = blastring();
  return {
    // Eloxerat profilrör: satin, inte borstat (ISO-profiler är matt-
    // anodiserade). Anisotropi drog takets reflex över hela sidan -> vit plast.
    alu: new THREE.MeshPhysicalMaterial({ color: 0xc3c9cf, metalness: 0.85, roughness: 0.42, roughnessMap: b }),
    // Kolven: svarvad aluminium, jämn satin utan borstning
    svarvad: new THREE.MeshPhysicalMaterial({ color: 0xc4cad1, metalness: 0.9, roughness: 0.34 }),
    // Gavlarna: blästrade, mattare
    gavel: new THREE.MeshPhysicalMaterial({ color: 0xa9b0b8, metalness: 0.82, roughness: 0.62, roughnessMap: bl, bumpMap: bl, bumpScale: 0.06 }),
    krom: new THREE.MeshPhysicalMaterial({ color: 0xeef1f4, metalness: 1, roughness: 0.13 }),
    stal: new THREE.MeshPhysicalMaterial({ color: 0x9aa1aa, metalness: 1, roughness: 0.32 }),
    svartStal: new THREE.MeshPhysicalMaterial({ color: 0x24272d, metalness: 0.8, roughness: 0.42 }),
    gummi: new THREE.MeshPhysicalMaterial({ color: 0x141619, metalness: 0, roughness: 0.62, sheen: 0.3, sheenRoughness: 0.8 }),
    magnet: new THREE.MeshPhysicalMaterial({ color: 0x3b4048, metalness: 0.6, roughness: 0.48 }),
    brons: new THREE.MeshPhysicalMaterial({ color: 0xb08249, metalness: 1, roughness: 0.4 }),
    pom: new THREE.MeshPhysicalMaterial({ color: 0xe3dfd4, metalness: 0, roughness: 0.5, sheen: 0.2 }),
    hal: new THREE.MeshStandardMaterial({ color: 0x050608, metalness: 0, roughness: 1 }),
    // Loppet inne i röret: honat men i skugga, syns bara genom rörändarna
    lopp: new THREE.MeshPhysicalMaterial({ color: 0x3a3f47, metalness: 0.7, roughness: 0.4, envMapIntensity: 0.3, side: THREE.BackSide }),
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
  const a = 32, r = 4.5;
  const s = new THREE.Shape();
  s.moveTo(-a + r, -a);
  s.lineTo(-3.6, -a); s.lineTo(-3.6, -a + 5); s.lineTo(3.6, -a + 5); s.lineTo(3.6, -a); // spår undertill
  s.lineTo(a - r, -a); s.quadraticCurveTo(a, -a, a, -a + r);
  s.lineTo(a, -3.6); s.lineTo(a - 5, -3.6); s.lineTo(a - 5, 3.6); s.lineTo(a, 3.6); // spår höger
  s.lineTo(a, a - r); s.quadraticCurveTo(a, a, a - r, a);
  s.lineTo(3.6, a); s.lineTo(3.6, a - 5); s.lineTo(-3.6, a - 5); s.lineTo(-3.6, a); // spår ovan
  s.lineTo(-a + r, a); s.quadraticCurveTo(-a, a, -a, a - r);
  s.lineTo(-a, 3.6); s.lineTo(-a + 5, 3.6); s.lineTo(-a + 5, -3.6); s.lineTo(-a, -3.6); // spår mot betraktaren
  s.lineTo(-a, -a + r); s.quadraticCurveTo(-a, -a, -a + r, -a);
  const borr = new THREE.Path(); borr.absarc(0, 0, 25, 0, Math.PI * 2, true); s.holes.push(borr);
  for (const [y, z] of [[-22.5, -22.5], [22.5, -22.5], [22.5, 22.5], [-22.5, 22.5]]) {
    const h = new THREE.Path(); h.absarc(y, z, 3, 0, Math.PI * 2, true); s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: true, bevelThickness: 1.4, bevelSize: 1.1, bevelSegments: 4, curveSegments: 48 });
  g.translate(0, 0, -L / 2);
  g.rotateY(Math.PI / 2);
  // UV: u längs röret, v runt det, så att ytstrukturen ligger i längsled
  // (extruderingens egna UV är millimeter och upprepar texturen hundratals gånger).
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + L / 2) / L, (pos.getY(i) + pos.getZ(i) + 70) / 140);
  uv.needsUpdate = true;
  const ror = new THREE.Group();
  ror.add(mesh(g, m.alu));
  // Fasningen gör loppet 1,1 mm mindre (Ø47,8). Ett mörkt foder strax innanför,
  // annars speglar loppets vägg studions tak och rörändarna lyser vita.
  const foder = new THREE.Mesh(new THREE.CylinderGeometry(23.6, 23.6, L, 64, 1, true), m.lopp);
  foder.rotation.z = Math.PI / 2;
  ror.add(foder);
  return ror;
}

function gavel(m: Mat, fram: boolean) {
  // Frontplatta 7 mm med fyra försänkningar (och stånghål i den främre), en
  // kropp bakom med små fasade kanter. Skruvhuvudena sitter nedsänkta i
  // hålen, som på en riktig ISO-gavel.
  const g = new THREE.Group();
  const PL = 7, a = 33, r = 3;
  const s = new THREE.Shape();
  s.moveTo(-a + r, -a); s.lineTo(a - r, -a); s.quadraticCurveTo(a, -a, a, -a + r);
  s.lineTo(a, a - r); s.quadraticCurveTo(a, a, a - r, a); s.lineTo(-a + r, a);
  s.quadraticCurveTo(-a, a, -a, a - r); s.lineTo(-a, -a + r); s.quadraticCurveTo(-a, -a, -a + r, -a);
  const horn: [number, number][] = [[-22.5, -22.5], [22.5, -22.5], [22.5, 22.5], [-22.5, 22.5]];
  for (const [y, z] of horn) { const h = new THREE.Path(); h.absarc(z, y, 5.6, 0, Math.PI * 2, true); s.holes.push(h); }
  if (fram) { const h = new THREE.Path(); h.absarc(0, 0, 10.4, 0, Math.PI * 2, true); s.holes.push(h); }
  const plattaG = new THREE.ExtrudeGeometry(s, { depth: PL, bevelEnabled: true, bevelThickness: 0.7, bevelSize: 0.7, bevelSegments: 3, curveSegments: 40 });
  plattaG.rotateY(Math.PI / 2);
  const platta = mesh(plattaG, m.gavel);
  const ut = fram ? 1 : -1;
  platta.position.x = fram ? KAP / 2 - PL : -KAP / 2;
  g.add(platta);
  const kropp = mesh(new RoundedBoxGeometry(KAP - PL, 66, 66, 3, 1.6), m.gavel);
  kropp.position.x = -ut * PL / 2;
  g.add(kropp);
  // Hålens botten: mörk, så att försänkningen läses som djup
  const botten = ut * (KAP / 2 - PL + 0.2);
  for (const [y, z] of horn) {
    const f = mesh(new THREE.CylinderGeometry(5.6, 5.6, 0.3, 32), m.hal);
    f.rotation.z = Math.PI / 2; f.position.set(botten, y, z); g.add(f);
  }
  // Port G1/4 ovanpå, med gängning
  const port = mesh(new THREE.CylinderGeometry(7.5, 7.5, 1.2, 40), m.gavel); port.position.set(-ut * 2, 33.4, 0); g.add(port);
  const portHal = mesh(new THREE.CylinderGeometry(5.2, 5.2, 1.4, 40), m.hal); portHal.position.set(-ut * 2, 33.6, 0); g.add(portHal);
  const gangring = mesh(new THREE.TorusGeometry(5.6, 0.35, 8, 40).rotateX(Math.PI / 2), m.stal); gangring.position.set(-ut * 2, 34.0, 0); g.add(gangring);
  if (fram) {
    const nav = mesh(ring(10.4, 15, 6, 0.8), m.gavel); nav.position.x = KAP / 2 + 3; g.add(nav);
    const hal = mesh(new THREE.CylinderGeometry(10.4, 10.4, 0.4, 40), m.hal);
    hal.rotation.z = Math.PI / 2; hal.position.x = botten; g.add(hal);
  } else {
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
  const kropp = mesh(svarv([[0, 0], ...ganga(2.4, 9, 0.7, 0.3), [2.7, 9], [2.9, 9.4], [2.9, 11], [0, 11]], 32), m.stal);
  const spar = mesh(new THREE.BoxGeometry(0.7, 5, 1.0), m.hal); spar.position.x = 11.1;
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
  ]), m.svarvad);
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
    add(skruv(m), { hop: V(kapBak - KAP / 2 + 6.5, y, z), isar: V(-410 - i * 6, y * 1.35, z * 1.35), fonster: [0.06 + i * 0.012, 0.24 + i * 0.012], varv: 5 });
    add(skruv(m), { hop: V(kapFram + KAP / 2 - 6.5, y, z), isar: V(470 + i * 6, y * 1.35, z * 1.35), fonster: [0.06 + i * 0.012, 0.24 + i * 0.012], varv: -5, bas: new THREE.Euler(0, Math.PI, 0) });
  });
  add(dampskruv(m), { hop: V(kapBak + 4, 0, 22.3), via: { pos: V(-330 + 4, 0, 22.3), fonster: [0.08, 0.3] }, isar: V(-326, 0, 70), fonster: [0.28, 0.42], varv: 0 });
  add(dampskruv(m), { hop: V(kapFram - 4, 0, 22.3), via: { pos: V(330 - 4, 0, 22.3), fonster: [0.08, 0.3] }, isar: V(326, 0, 70), fonster: [0.28, 0.42], varv: 0 });
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
  // Tätare sprängskiss: kameran kan gå närmare och varje del får fler pixlar.
  const SPRID = 0.82;
  for (const del of d) {
    del.isar.x *= SPRID;
    del.isar.y *= 0.92;
    if (del.via) del.via.pos.x *= SPRID;
  }
  return d;
}

// ── Scenen ─────────────────────────────────────────────────────────────────
/**
 * En produktfotostudio för reflexerna: ett stort takljus, två höga
 * striplights, en mjuk frontfyllning och en varm kantlist. Det är de långa,
 * mjuka reflexerna i metallen som gör en rendering till ett produktfoto.
 */
/** Softboxens ljusfördelning: starkt åt ena kanten, mörkt åt den andra, mjukt upptill och nertill. */
function avfall(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const x = c.getContext("2d")!;
  const h = x.createLinearGradient(0, 0, 256, 0);
  h.addColorStop(0, "#fff"); h.addColorStop(0.45, "#a8a8a8"); h.addColorStop(1, "#2a2a2a");
  x.fillStyle = h; x.fillRect(0, 0, 256, 128);
  x.globalCompositeOperation = "multiply";
  const v = x.createLinearGradient(0, 0, 0, 128);
  v.addColorStop(0, "#555"); v.addColorStop(0.5, "#fff"); v.addColorStop(1, "#555");
  x.fillStyle = v; x.fillRect(0, 0, 256, 128);
  return new THREE.CanvasTexture(c);
}

function studio(): THREE.Scene {
  const s = new THREE.Scene();
  // Ljusgrå studiovägg (som en fotohålkäl): metallen speglar omgivningen, och
  // eloxerat aluminium blir bara silver om det den speglar är ljust. Smala
  // strippar ger de ljusa banden, svarta flaggor de mörka -- kontrasten mellan
  // dem är det som gör metall till metall i ett produktfoto.
  s.background = new THREE.Color(0x9aa3b2);
  const ljus = (w: number, h: number, styrka: number, farg = 0xffffff) =>
    new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(farg).multiplyScalar(styrka), side: THREE.DoubleSide }));
  // Två takstrippar längs cylinderns axel, med mörkt mellanrum.
  for (const [z, st] of [[-2.4, 3.6], [1.8, 2.6]] as const) {
    const t = ljus(16, 1.5, st); t.position.set(0, 7, z); t.rotation.x = Math.PI / 2; s.add(t);
  }
  const vanster = ljus(2.2, 12, 3.2); vanster.position.set(-7, 1.5, 2); vanster.rotation.y = Math.PI / 2; s.add(vanster);
  const hoger = ljus(1.4, 12, 2.2); hoger.position.set(7, 1.5, -0.5); hoger.rotation.y = -Math.PI / 2; s.add(hoger);
  // Stor softbox bakom kameran med kraftigt avfall åt ena sidan: sidan mot
  // betraktaren blir silver med en mjuk gradient, inte gråsvart och inte en
  // jämnt vit yta (som är det som får metall att se ut som plast).
  const fram = ljus(16, 6, 2.4); fram.position.set(0, 0.8, 8);
  const fm = fram.material as THREE.MeshBasicMaterial;
  fm.map = avfall(); fm.needsUpdate = true;
  s.add(fram);
  const varm = ljus(9, 0.8, 2.2, 0xffa25a); varm.position.set(2.5, 0.4, -7); s.add(varm);
  // Ljust, blåaktigt golv: sidorna som vetter mot kameran speglar snett nedåt,
  // och ett mörkt golv gör dem gråsvarta. Blåtonen knyter an till heron.
  const golv = ljus(30, 30, 0.85, 0x8c97ad); golv.position.y = -4; golv.rotation.x = -Math.PI / 2; s.add(golv);
  // Svarta flaggor vid horisonten: de mörka linjerna i kromstången och kanterna.
  const flagga = (w: number, h: number) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x07080a, side: THREE.DoubleSide }));
  const bak = flagga(24, 2.2); bak.position.set(0, 0.2, -7.5); s.add(bak);
  const vf = flagga(2.6, 14); vf.position.set(-7.5, 0.5, -3.5); vf.rotation.y = Math.PI / 2; s.add(vf);
  const hf = flagga(3, 14); hf.position.set(7.5, 0.5, 3.5); hf.rotation.y = -Math.PI / 2; s.add(hf);
  return s;
}

// Heroens bakgrund (src/styles.css): marinblå, fotot på 18 %, guldglöd uppe till höger.
const MARIN = "#203159";
const GULD = "235,136,59";

/** Ritar heroens bakgrund i scenen, så att skärpedjupet kan göra den mjuk. */
function malaBakgrund(w: number, h: number, bild: HTMLImageElement | null): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  const skala = Math.min(2, 2400 / Math.max(w, 1));
  c.width = Math.max(2, Math.round(w * skala)); c.height = Math.max(2, Math.round(h * skala));
  const g = c.getContext("2d")!;
  g.fillStyle = MARIN; g.fillRect(0, 0, c.width, c.height);
  if (bild && bild.naturalWidth) {
    const k = Math.max(c.width / bild.naturalWidth, c.height / bild.naturalHeight);
    const bw = bild.naturalWidth * k, bh = bild.naturalHeight * k;
    g.globalAlpha = 0.18;
    g.filter = "blur(5px)"; // som ett objektiv med kort skärpedjup, utan att delarna blir suddiga
    g.drawImage(bild, (c.width - bw) / 2, (c.height - bh) * 0.4, bw, bh);
    g.filter = "none";
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
  uniforms: { tDiffuse: { value: null }, uKorn: { value: 0.014 }, uVinj: { value: 0.35 }, uUpp: { value: new THREE.Vector2(1920, 1080) } },
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
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
  const studion = studio();
  const env = pmrem.fromScene(studion, 0.02).texture;
  studion.traverse((o) => {
    const me = o as THREE.Mesh;
    if (!me.isMesh) return;
    me.geometry.dispose();
    const mt = me.material as THREE.MeshBasicMaterial;
    mt.map?.dispose(); mt.dispose();
  });
  scene.environment = env;
  scene.environmentIntensity = 1.0;

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
  nyckel.shadow.mapSize.set(4096, 4096);
  nyckel.shadow.camera.left = -8; nyckel.shadow.camera.right = 8;
  nyckel.shadow.camera.top = 6; nyckel.shadow.camera.bottom = -6;
  nyckel.shadow.camera.near = 1; nyckel.shadow.camera.far = 30;
  nyckel.shadow.bias = -0.0004;
  nyckel.shadow.radius = 8;
  const kant = new THREE.DirectionalLight(0xffb070, 1.5); // varm kant, Maskinvals orange
  kant.position.set(-6, 3, -5);
  // Kall fyllnad från heron, svag: framifrån ger den en vit glansfläck på röret.
  const fyll = new THREE.DirectionalLight(0x9db8e0, 0.15);
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
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  for (const mat of Object.values(m)) {
    const pm = mat as THREE.MeshPhysicalMaterial;
    if (pm.roughnessMap) pm.roughnessMap.anisotropy = maxAniso;
    if (pm.bumpMap) pm.bumpMap.anisotropy = maxAniso;
  }
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
  const ao = new GTAOPass(scene, camera, 2, 2);
  ao.updateGtaoMaterial({ radius: 0.18, distanceExponent: 1.4, thickness: 1, scale: 1, samples: 16 });
  ao.blendIntensity = 0.85;
  composer.addPass(ao);
  const skarpa = new BokehPass(scene, camera, { focus: 9, aperture: 0.0006, maxblur: 0.0035 });
  composer.addPass(skarpa);
  composer.addPass(new OutputPass());
  const korn = new ShaderPass(KORN);
  composer.addPass(korn);

  let mal = opts.statisk ? 1 : 0, visad = mal, raf = 0, aktiv = true, senast = 0;
  const tanV = Math.tan(THREE.MathUtils.degToRad(15));
  let reserv = { hoger: 0.5, under: 0.55, slut: 0.78 };
  let fit = { x0: 0, y0: 0, d0: 8, x1: -0.35, y1: 0.12, d1: 9.2 };
  const box = new THREE.Box3();
  const horn = Array.from({ length: 8 }, () => new THREE.Vector3());

  /**
   * Räknar ut var den hela cylindern ska stå: projicerar dess hörn och
   * flyttar/drar ut kameran tills den ligger helt utanför textens yta.
   */
  function passa() {
    const asp = Math.max(0.5, camera.aspect);
    const bred = asp > 1.25;
    for (const del of delar) { del.obj.position.copy(del.hop); if (del.varv) del.obj.rotation.x = del.bas ? del.bas.x : 0; }
    rot.rotation.set(0.2, -0.62, 0);
    let d = Math.max(6, 3.2 / (tanV * asp)), x0 = 0, y0 = 0;
    for (let i = 0; i < 8; i++) {
      rot.position.set(x0, y0, 0);
      camera.position.set(0, 0.9, d); camera.lookAt(0, -0.1, 0);
      camera.updateMatrixWorld(); rot.updateMatrixWorld(true);
      box.setFromObject(modell);
      let minX = 9, maxX = -9, minY = 9, maxY = -9, k = 0;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const v = horn[k++].set(x, y, z).project(camera);
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      }
      const halvB = tanV * d * asp, halvH = tanV * d;
      if (bred) {
        const vMin = Math.min(0.3, reserv.hoger * 2 - 1 + 0.05), vMax = 0.92;
        const bredd = maxX - minX, plats = vMax - vMin;
        if (bredd > plats) { d *= (bredd / plats) * 1.03; continue; }
        x0 += (vMin + (plats - bredd) * 0.35 - minX) * halvB * 0.9;
        y0 += (-0.08 - (minY + maxY) / 2) * halvH * 0.9;
      } else {
        // Under texten, ovanför scrollmarkeringen; bara i nödfall (mycket hög
        // text) får den krympa till 30 % av höjden och då hellre överlappa lite.
        const botten = -0.88, topp = Math.max(botten + 0.3, 1 - reserv.under * 2 - 0.05);
        const hojd = maxY - minY, bredd = maxX - minX, platsH = topp - botten;
        if (hojd > platsH || bredd > 1.8) { d *= Math.max(hojd / platsH, bredd / 1.8) * 1.03; continue; }
        x0 += (0 - (minX + maxX) / 2) * halvB * 0.9;
        y0 += ((topp + botten) / 2 - (minY + maxY) / 2) * halvH * 0.9;
      }
    }
    fit = { ...fit, x0, y0, d0: d };
    passaIsar();
  }

  /**
   * Samma sak för sprängskissen i vila: så stor som möjligt, men ovanför
   * slutraden och knapparna (utan slutrad, i stillbildsläget, hela höjden).
   */
  function passaIsar() {
    const asp = Math.max(0.5, camera.aspect);
    for (const del of delar) { del.obj.position.copy(del.isar); if (del.varv) del.obj.rotation.x = del.bas ? del.bas.x : 0; }
    rot.rotation.set(0.26, -0.3, 0);
    const vMin = -0.9, vMax = 0.9, topp = 0.86;
    const botten = opts.statisk ? -0.88 : Math.min(0.2, 1 - reserv.slut * 2 + 0.06);
    let d = Math.max(7, 4.9 / (tanV * asp)), x1 = 0, y1 = 0;
    for (let i = 0; i < 14; i++) {
      rot.position.set(x1, y1, 0);
      camera.position.set(0, 2.2, d); camera.lookAt(0, 0.1, 0);
      camera.updateMatrixWorld(); rot.updateMatrixWorld(true);
      box.setFromObject(modell);
      let minX = 9, maxX = -9, minY = 9, maxY = -9, k = 0;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const v = horn[k++].set(x, y, z).project(camera);
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      }
      const halvB = tanV * d * asp, halvH = tanV * d;
      const skala = Math.max((maxX - minX) / (vMax - vMin), (maxY - minY) / (topp - botten));
      if (Math.abs(skala - 1) > 0.02) d *= skala;
      x1 += ((vMin + vMax) / 2 - (minX + maxX) / 2) * halvB * 0.9;
      y1 += ((topp + botten) / 2 - (minY + maxY) / 2) * halvH * 0.9;
    }
    fit = { ...fit, x1, y1, d1: d };
  }
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
    const avst = THREE.MathUtils.lerp(fit.d0, fit.d1, g);
    const andning = opts.statisk ? 0 : Math.sin((tid - t0) / 2600) * 0.035 * (1 - g);
    rot.rotation.y = THREE.MathUtils.lerp(-0.62, -0.3, g) + andning;
    rot.rotation.x = THREE.MathUtils.lerp(0.2, 0.26, g);
    // Hel: till höger om heroens text på breda skärmar, under texten på smala.
    // Isär: centrerad i ytan ovanför slutraden (passaIsar).
    rot.position.x = THREE.MathUtils.lerp(fit.x0, fit.x1, g);
    rot.position.y = THREE.MathUtils.lerp(fit.y0, fit.y1, g);
    camera.position.set(0, THREE.MathUtils.lerp(0.9, 2.2, g), avst);
    // Skärpan ligger på cylinderns mitt. Litet bländartal: hela produkten skarp,
    // bara heroens bakgrund (oändligt långt bort) blir mjuk.
    const fokusPunkt = tmp.set(rot.position.x + 0.4 * (1 - g), rot.position.y, 0);
    (skarpa.uniforms as Record<string, { value: number }>)["focus"].value = camera.position.distanceTo(fokusPunkt);
    (skarpa.uniforms as Record<string, { value: number }>)["aperture"].value = THREE.MathUtils.lerp(0.00025, 0.0002, g);
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
    ao.setSize(w * dpr, h * dpr);
    nyBakgrund();
    passa();
    vack();
  }
  resize();
  vack();

  return {
    setProgress(p) { mal = Math.min(1, Math.max(0, p)); vack(); },
    setReserv(r) {
      reserv = { hoger: r.hoger ?? reserv.hoger, under: r.under ?? reserv.under, slut: r.slut ?? reserv.slut };
      passa(); vack();
    },
    resize,
    setActive(on) { aktiv = on; if (on) vack(); else if (raf) { cancelAnimationFrame(raf); raf = 0; senast = 0; } },
    dispose() {
      aktiv = false; if (raf) cancelAnimationFrame(raf);
      scene.traverse((o) => { const me = o as THREE.Mesh; if (me.geometry) me.geometry.dispose(); });
      Object.values(m).forEach((x) => x.dispose());
      env.dispose(); pmrem.dispose(); bakgrundTex?.dispose(); ao.dispose(); mal0.dispose(); composer.dispose(); renderer.dispose();
    },
  };
}
