/**
 * Machine3DScene — interactive Three.js/R3F 3D visualization of a pneumatic system.
 *
 * Scene layout (left → right):
 *   [FRL unit] ——hose——▶ [Valve block] ——hose——▶ [Mounting bracket] ▶ [Cylinder] ═══[piston rod]→ [payload]
 *
 * Everything sits on a metallic base plate with a subtle grid.
 * OrbitControls lets the user rotate/zoom freely.
 */

import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// ── Props ────────────────────────────────────────────────────────────────────
export interface Machine3DSceneProps {
  bore: number;       // mm  e.g. 50
  stroke: number;     // mm  e.g. 200
  isElectric: boolean;
  hasVacuum: boolean;
  hasGripper: boolean;
  isMultiAxis: boolean;
  hasSensors: boolean;
}

// ── Scale helpers ─────────────────────────────────────────────────────────────
// 1 Three.js unit ≈ 200 mm real world
const mm = (v: number) => v / 200;

// ── Hose ─────────────────────────────────────────────────────────────────────
function Hose({
  from, to, color = "#1d4ed8",
}: { from: [number, number, number]; to: [number, number, number]; color?: string }) {
  const geometry = useMemo(() => {
    const mid: [number, number, number] = [
      (from[0] + to[0]) / 2,
      Math.max(from[1], to[1]) + 0.18,
      (from[2] + to[2]) / 2,
    ];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(...from),
      new THREE.Vector3(...mid),
      new THREE.Vector3(...to),
    ]);
    return new THREE.TubeGeometry(curve, 24, 0.024, 8, false);
  }, []); // static geometry — positions won't change after mount

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} transparent opacity={0.85} roughness={0.4} />
    </mesh>
  );
}

// ── FRL Unit ──────────────────────────────────────────────────────────────────
function FRLUnit({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Body */}
      <mesh castShadow>
        <boxGeometry args={[0.38, 0.52, 0.28]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.55} roughness={0.35} />
      </mesh>
      {/* Pressure gauge */}
      <mesh position={[0, 0.34, 0.1]}>
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshStandardMaterial color="#1e293b" metalness={0.3} roughness={0.5} />
      </mesh>
      {/* Transparent water separator bowl */}
      <mesh position={[0, -0.17, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.18, 20]} />
        <meshStandardMaterial color="#bfdbfe" transparent opacity={0.3} roughness={0.1} />
      </mesh>
      {/* Outlet port */}
      <mesh position={[0.21, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.018, 0.018, 0.08, 8]} />
        <meshStandardMaterial color="#6aabcf" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

// ── Valve Block ───────────────────────────────────────────────────────────────
function ValveBlock({
  position, count,
}: { position: [number, number, number]; count: number }) {
  const w = 0.22 + count * 0.22;
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[w, 0.38, 0.22]} />
        <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.35} />
      </mesh>
      {/* Top rail */}
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[w + 0.04, 0.06, 0.26]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Green LED */}
      <mesh position={[0, 0.26, 0.1]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2} />
      </mesh>
      {/* Port fittings (top) */}
      {Array.from({ length: count }).map((_, i) => {
        const xOff = count === 1 ? 0 : (i - 0.5) * 0.22;
        return (
          <mesh key={i} position={[xOff, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.1, 8]} />
            <meshStandardMaterial color="#6aabcf" metalness={0.8} roughness={0.2} />
          </mesh>
        );
      })}
      {/* Solenoid coil knob */}
      {Array.from({ length: count }).map((_, i) => {
        const xOff = count === 1 ? 0 : (i - 0.5) * 0.22;
        return (
          <mesh key={i} position={[xOff, 0, 0.13]}>
            <cylinderGeometry args={[0.05, 0.05, 0.2, 12]} rotation={[0, 0, 0]} />
            <meshStandardMaterial color="#6366f1" metalness={0.4} roughness={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

// ── Bracket ───────────────────────────────────────────────────────────────────
function Bracket({ position, h }: { position: [number, number, number]; h: number }) {
  return (
    <group position={position}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[0.07, h, 0.28]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
      </mesh>
      {[-0.09, 0.09].map((z) => (
        <mesh key={z} position={[0, h * 0.25, z]}>
          <cylinderGeometry args={[0.02, 0.02, 0.09, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.15} />
        </mesh>
      ))}
    </group>
  );
}

// ── Sensor ────────────────────────────────────────────────────────────────────
function Sensor({ position }: { position: [number, number, number] }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.emissiveIntensity = ((Math.sin(clock.getElapsedTime() * 3) + 1) / 2) * 2 + 0.5;
    }
  });
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.09, 0.045, 0.14]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, 0.035, 0]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial ref={matRef} color="#22c55e" emissive="#22c55e" emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
}

// ── End Effector ──────────────────────────────────────────────────────────────
function EndEffector({
  hasVacuum, hasGripper, bodyR,
}: { hasVacuum: boolean; hasGripper: boolean; bodyR: number }) {
  if (hasVacuum) {
    return (
      <group>
        {/* Vacuum manifold */}
        <mesh>
          <boxGeometry args={[0.06, bodyR * 3.5, bodyR * 1.5]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Suction cups */}
        {[-bodyR * 1.1, bodyR * 1.1].map((z) => (
          <group key={z} position={[0.06, 0, z]}>
            <mesh>
              <cylinderGeometry args={[bodyR * 1.4, bodyR * 0.9, 0.06, 20]} rotation={[0, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#1d4ed8" transparent opacity={0.5} side={THREE.DoubleSide} />
            </mesh>
            {/* Cup rim */}
            <mesh position={[0.04, 0, 0]}>
              <torusGeometry args={[bodyR * 1.4, 0.015, 8, 24]} rotation={[0, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#1e40af" />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  if (hasGripper) {
    return (
      <group>
        {/* Gripper body */}
        <mesh>
          <boxGeometry args={[0.12, bodyR * 3, bodyR * 1.5]} />
          <meshStandardMaterial color="#0891b2" metalness={0.6} roughness={0.35} />
        </mesh>
        {/* Jaws */}
        {[-bodyR * 1.6, bodyR * 1.6].map((y) => (
          <mesh key={y} position={[0.12, y, 0]}>
            <boxGeometry args={[0.2, bodyR * 0.7, bodyR * 1.2]} />
            <meshStandardMaterial color="#0369a1" metalness={0.6} roughness={0.3} />
          </mesh>
        ))}
      </group>
    );
  }
  // Generic orange payload
  return (
    <mesh>
      <boxGeometry args={[0.22, bodyR * 3.2, bodyR * 3.2]} />
      <meshStandardMaterial color="#ea580c" metalness={0.2} roughness={0.55} />
    </mesh>
  );
}

// ── Animated Cylinder + Rod ───────────────────────────────────────────────────
function AnimatedCylinder({
  bore, stroke, hasVacuum, hasGripper, hasSensors,
}: {
  bore: number; stroke: number; hasVacuum: boolean; hasGripper: boolean; hasSensors: boolean;
}) {
  const safeB  = Math.max(25, bore);
  const safeS  = Math.max(50, stroke);
  const bodyR  = mm(safeB) * 0.95;   // visual radius of cylinder body
  const rodR   = bodyR * 0.38;       // piston rod radius
  const bodyL  = 1.6;               // fixed visual body length
  const rodTotalL = 1.8;            // rod length (part inside + outside)
  const strokeU   = mm(safeS) * 0.9; // max extension in Three.js units

  const rodRef     = useRef<THREE.Group>(null);
  const payloadRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = (Math.sin(clock.getElapsedTime() * 0.65) + 1) / 2;
    const ext = t * strokeU;
    if (rodRef.current)     rodRef.current.position.x     = ext;
    if (payloadRef.current) payloadRef.current.position.x = ext;
  });

  return (
    <group>
      {/* ── Cylinder body ── */}
      <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[bodyR, bodyR, bodyL, 32]} />
        <meshStandardMaterial color="#b0bec5" metalness={0.88} roughness={0.12} />
      </mesh>

      {/* Front end cap */}
      <mesh position={[bodyL / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[bodyR * 1.12, bodyR * 1.12, 0.055, 32]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Rear end cap */}
      <mesh position={[-bodyL / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[bodyR * 1.12, bodyR * 1.12, 0.055, 32]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Port fittings */}
      {[-0.32, 0.42].map((x) => (
        <mesh key={x} position={[x, bodyR * 1.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.13, 8]} />
          <meshStandardMaterial color="#6aabcf" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      {/* Sensors (blinking LEDs on body) */}
      {hasSensors && (
        <>
          <Sensor position={[-0.62, bodyR * 1.08, 0]} />
          <Sensor position={[0.62, bodyR * 1.08, 0]} />
        </>
      )}

      {/* ── Piston rod (slides out from front end cap) ── */}
      {/* rodRef group: starts at cylinder front, moves right by ext */}
      <group ref={rodRef}>
        {/* Rod mesh — half goes back into cylinder (hidden by opaque body) */}
        <mesh
          position={[-(rodTotalL / 2 - 0.12), 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[rodR, rodR, rodTotalL, 16]} />
          <meshStandardMaterial color="#dde3ea" metalness={0.96} roughness={0.04} />
        </mesh>
      </group>

      {/* ── Payload group (follows rod tip) ── */}
      <group ref={payloadRef} position={[bodyL / 2 + 0.12, 0, 0]}>
        {/* Clevis / end plate */}
        <mesh position={[-0.04, 0, 0]}>
          <boxGeometry args={[0.06, bodyR * 2.8, 0.06]} />
          <meshStandardMaterial color="#475569" metalness={0.75} roughness={0.3} />
        </mesh>
        {/* End effector */}
        <group position={[0.04, 0, 0]}>
          <EndEffector hasVacuum={hasVacuum} hasGripper={hasGripper} bodyR={bodyR} />
        </group>
      </group>
    </group>
  );
}

// ── Electric Actuator (simple version) ───────────────────────────────────────
function ElectricActuator({ bore, stroke }: { bore: number; stroke: number }) {
  const bodyR  = Math.max(0.07, mm(Math.max(25, bore)));
  const bodyL  = 1.8;
  const strokeU = mm(Math.max(50, stroke)) * 0.9;
  const carriageRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (carriageRef.current) {
      const t = (Math.sin(clock.getElapsedTime() * 0.55) + 1) / 2;
      carriageRef.current.position.x = -strokeU / 2 + t * strokeU;
    }
  });

  return (
    <group>
      {/* Rail */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[bodyL + 0.1, bodyR * 0.6, bodyR * 0.6]} />
        <meshStandardMaterial color="#6366f1" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Motor housing */}
      <mesh position={[-bodyL / 2 - 0.14, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[bodyR * 1.3, bodyR * 1.3, 0.28, 20]} />
        <meshStandardMaterial color="#4f46e5" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Carriage */}
      <group ref={carriageRef}>
        <mesh>
          <boxGeometry args={[0.3, bodyR * 2.0, bodyR * 2.5]} />
          <meshStandardMaterial color="#818cf8" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Orange payload on carriage */}
        <mesh position={[0, bodyR * 1.6, 0]}>
          <boxGeometry args={[0.22, bodyR * 2.0, bodyR * 2.0]} />
          <meshStandardMaterial color="#ea580c" metalness={0.2} roughness={0.55} />
        </mesh>
      </group>
    </group>
  );
}

// ── Full Scene ────────────────────────────────────────────────────────────────
function Scene({
  bore, stroke, isElectric, hasVacuum, hasGripper, isMultiAxis, hasSensors,
}: Machine3DSceneProps) {
  const cylY = 0.55;  // cylinder height above base
  const cylX = 1.6;   // cylinder X position

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 9, 5]} intensity={1.1} castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-4, 4, -3]} intensity={0.25} />
      <pointLight position={[cylX, cylY + 1, 1]} intensity={0.4} color="#bfdbfe" />

      {/* ── Base plate ── */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[11, 0.12, 1.8]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.3} roughness={0.65} />
      </mesh>

      {/* Grid overlay */}
      <gridHelper args={[11, 22, "#cbd5e1", "#e8edf2"]} position={[0, -0.001, 0]} />

      {/* ── Pneumatic circuit ── */}
      {!isElectric && (
        <>
          {/* FRL */}
          <FRLUnit position={[-3.9, cylY, 0]} />
          {/* Hose: FRL → Valve */}
          <Hose from={[-3.7, cylY + 0.05, 0]} to={[-2.45, cylY + 0.05, 0]} />
          {/* Valve */}
          <ValveBlock position={[-2.1, cylY, 0]} count={isMultiAxis ? 2 : 1} />
          {/* Hose: Valve port 1 → cylinder port A */}
          <Hose
            from={[-1.88, cylY + 0.2, 0]}
            to={[cylX - 0.42, cylY + 0.14, 0]}
          />
          {/* Hose: Valve port 2 → cylinder port B */}
          <Hose
            from={[-1.88, cylY + 0.2, 0.04]}
            to={[cylX + 0.35, cylY + 0.14, 0.02]}
            color="#1e40af"
          />
        </>
      )}

      {/* ── Mounting bracket ── */}
      <Bracket position={[cylX - 0.88, 0, 0]} h={cylY} />

      {/* ── Main actuator ── */}
      <group position={[cylX, cylY, 0]}>
        {isElectric ? (
          <ElectricActuator bore={bore} stroke={stroke} />
        ) : (
          <AnimatedCylinder
            bore={bore}
            stroke={stroke}
            hasVacuum={hasVacuum}
            hasGripper={hasGripper}
            hasSensors={hasSensors}
          />
        )}
      </group>

      {/* ── Second axis (multi-axis) ── */}
      {isMultiAxis && (
        <group position={[cylX, cylY + 0.85, 0]} rotation={[0, 0, Math.PI / 2]}>
          {/* Horizontal transfer axis */}
          <AnimatedCylinder
            bore={Math.max(25, bore * 0.65)}
            stroke={Math.max(100, stroke * 0.7)}
            hasVacuum={false}
            hasGripper={hasGripper}
            hasSensors={hasSensors}
          />
          {/* Small bracket for 2nd axis */}
          <Bracket position={[-0.88, 0, 0]} h={0.85} />
        </group>
      )}
    </>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────
export function Machine3DScene(props: Machine3DSceneProps) {
  return (
    <div className="w-full" style={{ height: 340 }}>
      <Canvas
        camera={{ position: [5.5, 3.8, 4.5], fov: 42 }}
        shadows
        gl={{ antialias: true, alpha: false }}
        style={{ background: "linear-gradient(160deg, #f8fafc 0%, #e8edf5 100%)" }}
      >
        <Suspense fallback={null}>
          <Scene {...props} />
          <OrbitControls
            enablePan={false}
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI * 0.72}
            minDistance={3.5}
            maxDistance={13}
            target={[0.8, 0.55, 0]}
            makeDefault
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
