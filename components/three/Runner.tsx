"use client";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { story, storyState } from "@/lib/story";
import { XRAY_LABELS, labelEls } from "@/lib/labels";

const LIME = new THREE.Color("#c6f432");
const XRAY_BODY = new THREE.Color("#7cc8ff");
const BLACK = new THREE.Color("#000000");

function mat(color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05, transparent: true, ...extra });
}

type Mats = ReturnType<typeof makeMaterials>;
function makeMaterials() {
  const body = {
    skin: mat("#b97a5b", { roughness: 0.8 }),
    top: mat("#f4f4f0", { roughness: 0.85 }),
    shorts: mat("#1e1e1e", { roughness: 0.9 }),
    shoe: mat("#c6f432", { roughness: 0.5 }),
    hair: mat("#2a1c14", { roughness: 0.95 }),
  };
  const bone = mat("#e8f1f5", { emissive: "#5fb8ff", emissiveIntensity: 0.45, roughness: 0.4, opacity: 0, depthWrite: false });
  const risk = mat("#d9ff5a", { emissive: "#c6f432", emissiveIntensity: 1.8, roughness: 0.4, opacity: 0, depthWrite: false });
  const base: Record<string, THREE.Color> = {};
  for (const [k, m] of Object.entries(body)) base[k] = m.color.clone();
  return { body, bone, risk, base };
}

/* capsule pointing down from the group origin */
function Seg({ r, len, material, y = 0, renderOrder = 2 }: { r: number; len: number; material: THREE.Material; y?: number; renderOrder?: number }) {
  return (
    <mesh material={material} position={[0, y - len / 2, 0]} renderOrder={renderOrder}>
      <capsuleGeometry args={[r, Math.max(0.01, len - 2 * r), 4, 12]} />
    </mesh>
  );
}

function Leg({ side, m, refs }: { side: 1 | -1; m: Mats; refs: { hip: React.RefObject<THREE.Group | null>; knee: React.RefObject<THREE.Group | null>; ankle: React.RefObject<THREE.Group | null> } }) {
  return (
    <group ref={refs.hip} position={[side * 0.1, 0, 0]}>
      {/* thigh */}
      <Seg r={0.075} len={0.45} material={m.body.skin} />
      <Seg r={0.088} len={0.2} material={m.body.shorts} y={0.02} />
      {/* femur: head, neck (high risk), shaft */}
      <mesh material={m.bone} position={[side * -0.055, -0.01, 0]} renderOrder={1}>
        <sphereGeometry args={[0.036, 14, 10]} />
      </mesh>
      <mesh material={m.risk} position={[side * -0.03, -0.035, 0]} rotation={[0, 0, side * 0.95]} renderOrder={1}>
        <capsuleGeometry args={[0.026, 0.06, 4, 10]} />
      </mesh>
      <Seg r={0.027} len={0.41} material={m.bone} y={-0.05} renderOrder={1} />
      <group ref={refs.knee} position={[0, -0.45, 0]}>
        <mesh material={m.bone} renderOrder={1}>
          <sphereGeometry args={[0.04, 14, 10]} />
        </mesh>
        {/* shin */}
        <Seg r={0.055} len={0.43} material={m.body.skin} />
        {/* tibia (high risk) + fibula */}
        <Seg r={0.026} len={0.4} material={m.risk} y={-0.02} renderOrder={1} />
        <mesh material={m.bone} position={[side * 0.035, -0.22, 0.01]} renderOrder={1}>
          <capsuleGeometry args={[0.011, 0.33, 4, 8]} />
        </mesh>
        <group ref={refs.ankle} position={[0, -0.43, 0]}>
          {/* shoe */}
          <mesh material={m.body.shoe} position={[0, -0.045, -0.06]} rotation={[Math.PI / 2, 0, 0]} renderOrder={2}>
            <capsuleGeometry args={[0.048, 0.17, 4, 12]} />
          </mesh>
          <mesh material={m.body.top} position={[0, -0.02, -0.05]} rotation={[Math.PI / 2, 0, 0]} renderOrder={2}>
            <capsuleGeometry args={[0.04, 0.12, 4, 12]} />
          </mesh>
          {/* foot bones: heel + metatarsals (high risk) */}
          <mesh material={m.bone} position={[0, -0.04, 0.03]} renderOrder={1}>
            <sphereGeometry args={[0.028, 12, 10]} />
          </mesh>
          {[-0.025, 0, 0.025].map((x) => (
            <mesh key={x} material={m.risk} position={[x, -0.055, -0.1]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1}>
              <capsuleGeometry args={[0.009, 0.12, 4, 8]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

function Arm({ side, m, refs }: { side: 1 | -1; m: Mats; refs: { shoulder: React.RefObject<THREE.Group | null>; elbow: React.RefObject<THREE.Group | null> } }) {
  return (
    <group ref={refs.shoulder} position={[side * 0.2, 0.44, 0]}>
      <mesh material={m.body.top} renderOrder={2}>
        <sphereGeometry args={[0.07, 14, 10]} />
      </mesh>
      <Seg r={0.048} len={0.3} material={m.body.skin} />
      <Seg r={0.02} len={0.28} material={m.bone} y={-0.01} renderOrder={1} />
      <group ref={refs.elbow} position={[0, -0.3, 0]}>
        <Seg r={0.04} len={0.27} material={m.body.skin} />
        <Seg r={0.016} len={0.25} material={m.bone} y={-0.01} renderOrder={1} />
        <mesh material={m.bone} position={[side * 0.018, -0.14, 0]} renderOrder={1}>
          <capsuleGeometry args={[0.009, 0.2, 4, 8]} />
        </mesh>
        <mesh material={m.body.skin} position={[0, -0.3, 0]} renderOrder={2}>
          <sphereGeometry args={[0.045, 12, 10]} />
        </mesh>
      </group>
    </group>
  );
}

export default function Runner() {
  const m = useMemo(makeMaterials, []);
  const root = useRef<THREE.Group>(null);
  const pelvis = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const L = { hip: useRef<THREE.Group>(null), knee: useRef<THREE.Group>(null), ankle: useRef<THREE.Group>(null) };
  const R = { hip: useRef<THREE.Group>(null), knee: useRef<THREE.Group>(null), ankle: useRef<THREE.Group>(null) };
  const AL = { shoulder: useRef<THREE.Group>(null), elbow: useRef<THREE.Group>(null) };
  const AR = { shoulder: useRef<THREE.Group>(null), elbow: useRef<THREE.Group>(null) };
  const phase = useRef(0);
  const proj = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, size }, dt) => {
    const p = story.get();
    const s = storyState(p);
    const freq = 1.45 + 0.55 * s.sprint;
    phase.current += Math.min(dt, 0.05) * freq * Math.PI * 2;
    const φ = phase.current;
    const amp = 1 + 0.18 * s.sprint;
    const lean = -0.12 - 0.1 * s.sprint;

    const legAngles = (ph: number) => {
      const hip = 0.22 + 0.62 * amp * Math.sin(ph);
      const swing = Math.max(0, Math.sin(ph - 0.35));
      const knee = -(0.28 + 0.55 * (0.5 + 0.5 * Math.cos(ph - 0.2)) + 0.75 * amp * swing * swing);
      const ankle = 0.28 * Math.sin(ph) - 0.12;
      return { hip, knee, ankle };
    };
    const a = legAngles(φ);
    const b = legAngles(φ + Math.PI);
    if (L.hip.current) L.hip.current.rotation.x = a.hip;
    if (L.knee.current) L.knee.current.rotation.x = a.knee;
    if (L.ankle.current) L.ankle.current.rotation.x = a.ankle;
    if (R.hip.current) R.hip.current.rotation.x = b.hip;
    if (R.knee.current) R.knee.current.rotation.x = b.knee;
    if (R.ankle.current) R.ankle.current.rotation.x = b.ankle;

    // arms counter-swing the same-side leg
    if (AL.shoulder.current) {
      AL.shoulder.current.rotation.x = -0.15 - 0.8 * amp * Math.sin(φ);
      AL.shoulder.current.rotation.z = -0.16;
    }
    if (AR.shoulder.current) {
      AR.shoulder.current.rotation.x = -0.15 - 0.8 * amp * Math.sin(φ + Math.PI);
      AR.shoulder.current.rotation.z = 0.16;
    }
    if (AL.elbow.current) AL.elbow.current.rotation.x = 1.75 + 0.2 * Math.sin(φ);
    if (AR.elbow.current) AR.elbow.current.rotation.x = 1.75 + 0.2 * Math.sin(φ + Math.PI);

    if (pelvis.current) {
      pelvis.current.position.y = 1.0 + 0.045 * Math.cos(2 * φ);
      pelvis.current.rotation.y = -0.1 * Math.sin(φ);
      pelvis.current.rotation.z = 0.05 * Math.sin(φ);
      pelvis.current.rotation.x = lean * 0.4;
    }
    if (torso.current) {
      torso.current.rotation.y = 0.22 * Math.sin(φ);
      torso.current.rotation.x = lean;
    }
    if (head.current) head.current.rotation.x = -lean * 0.8;
    if (tail.current) tail.current.rotation.x = -1.1 + 0.35 * Math.cos(2 * φ - 0.6);

    // X-ray crossfade
    const x = s.finish ? 0 : s.xray;
    for (const [k, mm] of Object.entries(m.body)) {
      mm.color.copy(m.base[k]).lerp(XRAY_BODY, x);
      mm.emissive.copy(BLACK).lerp(XRAY_BODY, x * 0.9);
      mm.emissiveIntensity = 0.7 * x;
      mm.opacity = 1 - 0.86 * x;
      mm.depthWrite = x < 0.05;
    }
    m.bone.opacity = x * 0.95;
    m.risk.opacity = x;
    m.risk.emissiveIntensity = 0.8 + 1.4 * x;
    m.risk.emissive.copy(LIME);
    // project label anchors to screen space
    XRAY_LABELS.forEach((l) => {
      const el = labelEls[l.id];
      if (!el) return;
      proj.set(l.pos[0], l.pos[1], l.pos[2]).project(camera);
      const sx = ((proj.x + 1) / 2) * size.width;
      const sy = ((1 - proj.y) / 2) * size.height;
      const behind = proj.z > 1;
      el.style.opacity = String(behind ? 0 : s.labels);
      el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(${l.left ? "-100%" : "0"}, -50%)`;
    });

    if (root.current) root.current.visible = !s.micro;
  });

  return (
    <group ref={root}>
      <group ref={pelvis} position={[0, 1, 0]}>
        {/* shorts / pelvis body */}
        <mesh material={m.body.shorts} position={[0, 0.03, 0]} scale={[1.55, 1.05, 1.1]} renderOrder={2}>
          <sphereGeometry args={[0.115, 18, 14]} />
        </mesh>
        {/* pelvis bones: two ilia + sacrum (high risk) */}
        {[1, -1].map((side) => (
          <mesh key={side} material={m.risk} position={[side * 0.085, 0.03, 0.015]} scale={[0.08, 0.065, 0.035]} renderOrder={1}>
            <sphereGeometry args={[1, 14, 10]} />
          </mesh>
        ))}
        <mesh material={m.risk} position={[0, 0.0, 0.075]} rotation={[0.35, 0, 0]} renderOrder={1}>
          <boxGeometry args={[0.07, 0.11, 0.035]} />
        </mesh>

        <Leg side={-1} m={m} refs={L} />
        <Leg side={1} m={m} refs={R} />

        <group ref={torso}>
          {/* torso (singlet) */}
          <mesh material={m.body.top} position={[0, 0.3, 0]} renderOrder={2}>
            <capsuleGeometry args={[0.13, 0.26, 4, 16]} />
          </mesh>
          <mesh material={m.body.skin} position={[0, 0.56, 0]} renderOrder={2}>
            <capsuleGeometry args={[0.045, 0.08, 4, 10]} />
          </mesh>
          {/* spine + ribs + clavicles */}
          {Array.from({ length: 9 }).map((_, i) => (
            <mesh key={i} material={m.bone} position={[0, 0.06 + i * 0.058, 0.02]} renderOrder={1}>
              <cylinderGeometry args={[0.02, 0.02, 0.034, 10]} />
            </mesh>
          ))}
          {[0.25, 0.32, 0.39, 0.46].map((y, i) => (
            <mesh key={y} material={m.bone} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1}>
              <torusGeometry args={[0.115 - i * 0.012, 0.009, 8, 24]} />
            </mesh>
          ))}
          {[1, -1].map((side) => (
            <mesh key={side} material={m.bone} position={[side * 0.1, 0.52, 0.01]} rotation={[0, 0, Math.PI / 2]} renderOrder={1}>
              <capsuleGeometry args={[0.009, 0.17, 4, 8]} />
            </mesh>
          ))}
          <Arm side={-1} m={m} refs={AL} />
          <Arm side={1} m={m} refs={AR} />
          {/* head */}
          <group ref={head} position={[0, 0.7, 0]}>
            <mesh material={m.body.skin} renderOrder={2}>
              <sphereGeometry args={[0.105, 20, 16]} />
            </mesh>
            <mesh material={m.body.hair} position={[0, 0.02, 0.02]} scale={[1.04, 1, 1.04]} renderOrder={2}>
              <sphereGeometry args={[0.107, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            </mesh>
            <group ref={tail} position={[0, 0.02, 0.1]}>
              <mesh material={m.body.hair} position={[0, -0.12, 0]} renderOrder={2}>
                <capsuleGeometry args={[0.03, 0.18, 4, 10]} />
              </mesh>
            </group>
            <mesh material={m.bone} renderOrder={1}>
              <sphereGeometry args={[0.095, 18, 14]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
