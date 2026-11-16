/**
 * CylinderScen — en ISO 15552-cylinder Ø50 i 3D som plockas isär när man
 * scrollar (Sprangskiss.tsx äger scrollen och skickar framsteget hit).
 *
 * Delarna är en riktig profilcylinders: profilrör med givarspår, bakre och
 * främre gavel med portar och dämpskruv, kolv med magnetring och två
 * läpptätningar, dämphylsa, styrbussning med avstrykare, kolvstång med
 * nyckelgrepp och gänga, och kolvstångsmutter. Måtten är ungefärliga men
 * proportionerna stämmer (Ø50, stång Ø20, 200 mm slag) -- en konstruktör ska
 * inte kunna peka på en påhittad del.
 *
 * Inga externa resurser: miljöljuset byggs av Lightformers i scenen, så
 * ingen HDR-fil hämtas från ett CDN.
 */
import { useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Html, Lightformer, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

export type DelId =
  | "bakgavel" | "profilror" | "tatning_bak" | "magnetring" | "kolv" | "tatning_fram"
  | "damphylsa" | "framgavel" | "avstrykare" | "kolvstang" | "mutter";

export interface Etikett { id: DelId; text: string; steg: number }

const S = 0.01; // 1 enhet = 100 mm
const GULD = "#e88a2e";

/** Mjuk övergång 0→1 mellan a och b. */
function steg01(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Fönstret i scrollen där steg 1–4 plockas isär. */
export const STEGFONSTER: [number, number][] = [[0.08, 0.3], [0.3, 0.52], [0.52, 0.74], [0.74, 0.94]];

interface Del {
  id: DelId;
  steg: number;
  /** Ihopsatt och isärplockad position, i mm (x längs cylinderns axel). */
  hop: [number, number, number];
  isar: [number, number, number];
}

// Profilrör 250 mm (200 slag + kolv + dämpning), gavlar 30 mm.
const L = 250;
const KOLV_X = -L / 2 + 30; // kolven står i bakre ändläget
const DELAR: Del[] = [
  { id: "bakgavel", steg: 1, hop: [-L / 2 - 15, 0, 0], isar: [-L / 2 - 15 - 210, 0, 0] },
  { id: "profilror", steg: 1, hop: [0, 0, 0], isar: [-40, 120, 0] },
  { id: "framgavel", steg: 1, hop: [L / 2 + 15, 0, 0], isar: [L / 2 + 15 + 150, 0, 0] },
  { id: "magnetring", steg: 2, hop: [KOLV_X, 0, 0], isar: [KOLV_X - 30, -95, 0] },
  { id: "kolv", steg: 2, hop: [KOLV_X, 0, 0], isar: [KOLV_X + 5, 0, 0] },
  { id: "tatning_bak", steg: 3, hop: [KOLV_X - 9, 0, 0], isar: [KOLV_X - 75, 0, 0] },
  { id: "tatning_fram", steg: 3, hop: [KOLV_X + 9, 0, 0], isar: [KOLV_X + 75, 0, 0] },
  { id: "damphylsa", steg: 3, hop: [KOLV_X + 22, 0, 0], isar: [KOLV_X + 125, 0, 0] },
  { id: "avstrykare", steg: 3, hop: [L / 2 + 26, 0, 0], isar: [L / 2 + 15 + 210, 0, 0] },
  { id: "kolvstang", steg: 4, hop: [KOLV_X + 12 + 150, 0, 0], isar: [KOLV_X + 12 + 150 + 300, 0, 0] },
  { id: "mutter", steg: 4, hop: [KOLV_X + 12 + 300 - 8, 0, 0], isar: [KOLV_X + 12 + 300 + 360, 0, 0] },
];

// ── Material ────────────────────────────────────────────────────────────────
function useMaterial() {
  return useMemo(() => ({
    aluminium: new THREE.MeshStandardMaterial({ color: "#c7ccd4", metalness: 0.85, roughness: 0.32 }),
    gavel: new THREE.MeshStandardMaterial({ color: "#9ea5b0", metalness: 0.8, roughness: 0.38 }),
    krom: new THREE.MeshStandardMaterial({ color: "#eef1f5", metalness: 1, roughness: 0.12 }),
    stal: new THREE.MeshStandardMaterial({ color: "#7d848f", metalness: 0.9, roughness: 0.3 }),
    gummi: new THREE.MeshStandardMaterial({ color: "#16181c", metalness: 0, roughness: 0.75 }),
    magnet: new THREE.MeshStandardMaterial({ color: "#3a404a", metalness: 0.4, roughness: 0.5 }),
    brons: new THREE.MeshStandardMaterial({ color: "#b58a4c", metalness: 0.75, roughness: 0.35 }),
    spar: new THREE.MeshStandardMaterial({ color: "#2b3038", metalness: 0.3, roughness: 0.6 }),
  }), []);
}

// Cylindrar i three.js står längs Y; delarna ska ligga längs X.
const LIGG: [number, number, number] = [0, 0, Math.PI / 2];

function Gavel({ m, fram }: { m: ReturnType<typeof useMaterial>; fram: boolean }) {
  const skruvar: [number, number][] = [[24, 24], [-24, 24], [24, -24], [-24, -24]];
  const ut = fram ? 1 : -1;
  return (
    <group>
      <RoundedBox args={[30 * S, 66 * S, 66 * S]} radius={5 * S} smoothness={4} material={m.gavel} />
      {skruvar.map(([y, z], i) => (
        <mesh key={i} position={[ut * 15.5 * S, y * S, z * S]} rotation={LIGG} material={m.stal}>
          <cylinderGeometry args={[3.2 * S, 3.2 * S, 2 * S, 16]} />
        </mesh>
      ))}
      {/* Port G1/4 och dämpskruv på ovansidan */}
      <mesh position={[ut * 2 * S, 33.5 * S, 8 * S]} material={m.stal}>
        <cylinderGeometry args={[6 * S, 6 * S, 3 * S, 20]} />
      </mesh>
      <mesh position={[ut * 2 * S, 33.6 * S, 8 * S]} material={m.spar}>
        <cylinderGeometry args={[3.4 * S, 3.4 * S, 3.4 * S, 16]} />
      </mesh>
      <mesh position={[ut * 2 * S, 33.4 * S, -14 * S]} material={m.krom}>
        <cylinderGeometry args={[2.6 * S, 2.6 * S, 3 * S, 12]} />
      </mesh>
      {fram && (
        // Styrbussning (brons) syns i hålet där stången går ut
        <mesh position={[15.5 * S, 0, 0]} rotation={LIGG} material={m.brons}>
          <cylinderGeometry args={[13 * S, 13 * S, 2 * S, 32]} />
        </mesh>
      )}
    </group>
  );
}

function Profilror({ m }: { m: ReturnType<typeof useMaterial> }) {
  return (
    <group>
      <RoundedBox args={[L * S, 62 * S, 62 * S]} radius={7 * S} smoothness={4} material={m.aluminium} />
      {/* T-spår för givare på tre sidor */}
      {[[0, 31.2, 0, 0], [0, 0, 31.2, Math.PI / 2], [0, 0, -31.2, Math.PI / 2]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x * S, y * S, z * S]} rotation={[r, 0, 0]} material={m.spar}>
          <boxGeometry args={[(L - 6) * S, 0.8 * S, 6 * S]} />
        </mesh>
      ))}
    </group>
  );
}

function Kolv({ m }: { m: ReturnType<typeof useMaterial> }) {
  return (
    <mesh rotation={LIGG} material={m.aluminium}>
      <cylinderGeometry args={[24.4 * S, 24.4 * S, 12 * S, 48]} />
    </mesh>
  );
}

function Magnetring({ m }: { m: ReturnType<typeof useMaterial> }) {
  return (
    <mesh rotation={[0, Math.PI / 2, 0]} material={m.magnet}>
      <torusGeometry args={[23 * S, 2.6 * S, 16, 48]} />
    </mesh>
  );
}

function Tatning({ m }: { m: ReturnType<typeof useMaterial> }) {
  return (
    <mesh rotation={[0, Math.PI / 2, 0]} material={m.gummi}>
      <torusGeometry args={[23.6 * S, 2 * S, 14, 48]} />
    </mesh>
  );
}

function Damphylsa({ m }: { m: ReturnType<typeof useMaterial> }) {
  return (
    <mesh rotation={LIGG} material={m.stal}>
      <cylinderGeometry args={[12 * S, 13.5 * S, 16 * S, 32]} />
    </mesh>
  );
}

function Avstrykare({ m }: { m: ReturnType<typeof useMaterial> }) {
  return (
    <mesh rotation={[0, Math.PI / 2, 0]} material={m.gummi}>
      <torusGeometry args={[11.5 * S, 2.4 * S, 14, 40]} />
    </mesh>
  );
}

function Kolvstang({ m }: { m: ReturnType<typeof useMaterial> }) {
  return (
    <group>
      <mesh rotation={LIGG} material={m.krom}>
        <cylinderGeometry args={[10 * S, 10 * S, 300 * S, 40]} />
      </mesh>
      {/* Nyckelgrepp och gänga M16x1,5 i änden */}
      <mesh position={[132 * S, 0, 0]} material={m.krom}>
        <boxGeometry args={[12 * S, 17 * S, 20.2 * S]} />
      </mesh>
      <mesh position={[156 * S, 0, 0]} rotation={LIGG} material={m.stal}>
        <cylinderGeometry args={[8 * S, 8 * S, 22 * S, 24]} />
      </mesh>
    </group>
  );
}

function Mutter({ m }: { m: ReturnType<typeof useMaterial> }) {
  return (
    <mesh rotation={LIGG} material={m.stal}>
      <cylinderGeometry args={[13 * S, 13 * S, 10 * S, 6]} />
    </mesh>
  );
}

function DelMesh({ id, m }: { id: DelId; m: ReturnType<typeof useMaterial> }) {
  switch (id) {
    case "bakgavel": return <Gavel m={m} fram={false} />;
    case "framgavel": return <Gavel m={m} fram />;
    case "profilror": return <Profilror m={m} />;
    case "kolv": return <Kolv m={m} />;
    case "magnetring": return <Magnetring m={m} />;
    case "tatning_bak": case "tatning_fram": return <Tatning m={m} />;
    case "damphylsa": return <Damphylsa m={m} />;
    case "avstrykare": return <Avstrykare m={m} />;
    case "kolvstang": return <Kolvstang m={m} />;
    case "mutter": return <Mutter m={m} />;
  }
}

function Delen({ del, framsteg, etikett, m, kompakt }: {
  del: Del; framsteg: MutableRefObject<number>; etikett?: string;
  m: ReturnType<typeof useMaterial>; kompakt: boolean;
}) {
  const grupp = useRef<THREE.Group>(null);
  const lapp = useRef<HTMLDivElement>(null);
  const [a, b] = STEGFONSTER[del.steg - 1];
  const faktor = kompakt ? 0.62 : 1;
  useFrame(() => {
    const p = framsteg.current;
    const e = steg01(a, b, p);
    const g = grupp.current;
    if (g) {
      g.position.set(
        (del.hop[0] + (del.isar[0] - del.hop[0]) * e * faktor) * S,
        (del.hop[1] + (del.isar[1] - del.hop[1]) * e * faktor) * S,
        (del.hop[2] + (del.isar[2] - del.hop[2]) * e) * S,
      );
    }
    // Etiketten tänds när delen har kommit loss och håller sig sedan kvar,
    // svagare, så att hela sprängskissen till slut är märkt.
    if (lapp.current) {
      const aktiv = p >= a && p < (STEGFONSTER[del.steg]?.[0] ?? 1.01);
      const syns = steg01(a + (b - a) * 0.5, b, p);
      lapp.current.style.opacity = String(syns * (aktiv ? 1 : 0.55));
      lapp.current.dataset.aktiv = aktiv ? "1" : "0";
    }
  });
  return (
    <group ref={grupp}>
      <DelMesh id={del.id} m={m} />
      {etikett && (
        <Html center distanceFactor={kompakt ? 3.2 : 2.4} position={[0, (del.id === "profilror" ? 44 : 38) * S, 0]} zIndexRange={[20, 0]}>
          <div ref={lapp} className="sprang-lapp" style={{ opacity: 0 }}>{etikett}</div>
        </Html>
      )}
    </group>
  );
}

function Scen({ framsteg, etiketter, kompakt }: {
  framsteg: MutableRefObject<number>; etiketter: Etikett[]; kompakt: boolean;
}) {
  const m = useMaterial();
  const hela = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = hela.current;
    if (!g) return;
    const p = framsteg.current;
    const malY = -0.55 + p * 0.45;
    const malX = 0.3 - p * 0.1;
    const malPos = -steg01(0.3, 0.94, p) * (kompakt ? 0.95 : 1.6);
    const k = Math.min(1, dt * 6);
    g.rotation.y += (malY - g.rotation.y) * k;
    g.rotation.x += (malX - g.rotation.x) * k;
    g.position.x += (malPos - g.position.x) * k;
  });
  const text = new Map(etiketter.map((e) => [e.id, e.text]));
  return (
    <>
      <group ref={hela}>
        {DELAR.map((d) => (
          <Delen key={d.id} del={d} framsteg={framsteg} etikett={text.get(d.id)} m={m} kompakt={kompakt} />
        ))}
      </group>
      <ContactShadows position={[0, -1.15, 0]} opacity={0.45} scale={9} blur={2.6} far={2.5} color="#000814" />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 2]} intensity={1.6} />
      <directionalLight position={[-4, 1.5, -2]} intensity={0.5} color={GULD} />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2.2} position={[0, 4, 2]} scale={[8, 1.5, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.2} position={[-5, 1, 0]} scale={[2, 6, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={0.8} position={[5, 0.5, -1]} scale={[2, 5, 1]} rotation-y={-Math.PI / 2} color={GULD} />
        <Lightformer form="ring" intensity={0.6} position={[0, -3, 3]} scale={3} />
      </Environment>
    </>
  );
}

export function CylinderScen({ framsteg, etiketter, kompakt, aktiv }: {
  framsteg: MutableRefObject<number>;
  etiketter: Etikett[];
  /** Smal skärm: kortare isärdragning och större etiketter. */
  kompakt: boolean;
  /** Utanför vyn ritas inget (sparar batteri). */
  aktiv: boolean;
}) {
  return (
    <Canvas
      frameloop={aktiv ? "always" : "never"}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.35, kompakt ? 6.2 : 4.6], fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%" }}
    >
      <Scen framsteg={framsteg} etiketter={etiketter} kompakt={kompakt} />
    </Canvas>
  );
}

