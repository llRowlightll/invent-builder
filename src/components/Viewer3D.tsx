import { useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import type { BomItem } from "@/lib/types";
import * as THREE from "three";

interface Props {
  items: BomItem[];
  highlightSku?: string | null;
  onPick?: (sku: string) => void;
}

const ROLE_COLOR: Record<string, string> = {
  actuator: "#7AA7FF",
  drive: "#21C07A",
  psu: "#F2C94C",
  plc: "#C9A75D",
  io: "#A88BFF",
  feedback: "#EB5757",
  cable: "#888a92",
  accessory: "#4FC1B5",
  spare: "#cf7a44",
};

function Block({
  position,
  size,
  color,
  label,
  highlighted,
  onClick,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  label: string;
  highlighted: boolean;
  onClick: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    const target = highlighted ? 1.08 : 1;
    ref.current.scale.lerp(new THREE.Vector3(target, target, target), 0.15);
  });
  return (
    <group position={position}>
      <mesh ref={ref} onClick={onClick} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          metalness={0.4}
          roughness={0.55}
          emissive={highlighted ? color : "#000"}
          emissiveIntensity={highlighted ? 0.45 : 0}
        />
      </mesh>
      <Text
        position={[0, size[1] / 2 + 0.25, 0]}
        fontSize={0.18}
        color="#1a1a1a"
        anchorX="center"
      >
        {label}
      </Text>
    </group>
  );
}

export default function Viewer3D({ items, highlightSku, onPick }: Props) {
  const blocks = useMemo(() => {
    const grid: { item: BomItem; pos: [number, number, number]; size: [number, number, number] }[] =
      [];
    let x = -((items.length - 1) * 1.6) / 2;
    for (const it of items) {
      const isAct = it.role === "actuator";
      const size: [number, number, number] = isAct ? [3, 0.5, 0.5] : [1.2, 1.0, 0.9];
      grid.push({ item: it, pos: [x, 0.5, 0], size });
      x += isAct ? 2.4 : 1.5;
    }
    return grid;
  }, [items]);

  // Avoid SSR canvas crash
  const canRender = typeof window !== "undefined";
  if (!canRender) return null;

  return (
    <div className="aspect-[16/9] w-full rounded-md overflow-hidden border border-border bg-surface-alt">
      <Canvas shadows camera={{ position: [4, 4, 7], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[6, 8, 4]} intensity={1.1} castShadow />
        <gridHelper args={[20, 20, "#cccccc", "#e5e5e5"]} position={[0, 0, 0]} />
        {blocks.map(({ item, pos, size }) => (
          <Block
            key={item.product.sku + item.role}
            position={pos}
            size={size}
            color={ROLE_COLOR[item.role] ?? "#666"}
            label={item.role}
            highlighted={highlightSku === item.product.sku}
            onClick={() => onPick?.(item.product.sku)}
          />
        ))}
        <OrbitControls enablePan={false} />
      </Canvas>
    </div>
  );
}
