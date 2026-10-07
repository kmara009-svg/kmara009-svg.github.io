"use client";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { story, storyState } from "@/lib/story";

export const MICRO_ORIGIN = new THREE.Vector3(0, -400, 0);

/* The proximal femur in coronal section, as in a textbook osteoporosis illustration: a cream
   cortical shell around orange trabecular bone. The section face is a canvas texture redrawn as
   porosity changes: at 0 the interior is finely stippled and the cortex thick; at 1 the pores
   have grown and merged into large holes and the cortex has thinned. The slab is extruded so it
   reads as a solid piece of bone, and the camera drifts gently in front of it. */

/* outline in bone units (roughly 1 = 1.2 cm): head to the left, greater trochanter to the right, shaft down */
function femurShape() {
  const s = new THREE.Shape();
  s.moveTo(2.3, -4.6); // lateral shaft, bottom
  s.lineTo(2.35, -0.6);
  s.bezierCurveTo(2.4, 0.6, 2.7, 1.6, 2.5, 2.4); // lateral flare up to the greater trochanter
  s.bezierCurveTo(2.4, 2.9, 2.1, 3.25, 1.6, 3.3); // trochanter tip
  s.bezierCurveTo(1.1, 3.35, 0.7, 3.0, 0.4, 2.75); // trochanteric fossa
  s.bezierCurveTo(-0.5, 3.1, -1.3, 3.9, -2.03, 4.6); // superior neck up to the head
  s.absarc(-3.5, 3.55, 1.8, Math.PI * 0.2, Math.PI * 1.8, false); // the head
  s.bezierCurveTo(-1.5, 1.5, -1.0, 0.9, -0.95, 0.2); // inferior neck
  s.bezierCurveTo(-0.95, -0.2, -1.25, -0.5, -1.15, -0.9); // lesser trochanter
  s.bezierCurveTo(-1.0, -1.3, -0.9, -1.6, -0.9, -2.0); // medial shaft
  s.lineTo(-0.9, -4.6);
  s.closePath();
  return s;
}

const TEX_W = 900;
type Pore = { x: number; y: number; r0: number; g: number };

function makeFace() {
  const shape = femurShape();
  const pts = shape.getPoints(48);
  const box = new THREE.Box2();
  for (const p of pts) box.expandByPoint(p);
  const w = box.max.x - box.min.x, h = box.max.y - box.min.y;
  const k = TEX_W / w;
  const texH = Math.round(h * k);
  const toPx = (p: THREE.Vector2) => [(p.x - box.min.x) * k, (box.max.y - p.y) * k] as const;
  const path = new Path2D();
  pts.forEach((p, i) => {
    const [x, y] = toPx(p);
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  });
  path.closePath();

  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = texH;
  const g = canvas.getContext("2d")!;

  // base layer: warm trabecular gradient with fine lighter grain, drawn once
  const base = document.createElement("canvas");
  base.width = TEX_W;
  base.height = texH;
  const b = base.getContext("2d")!;
  const grad = b.createLinearGradient(0, 0, TEX_W, texH);
  grad.addColorStop(0, "#f3bd68");
  grad.addColorStop(0.5, "#e59a3f");
  grad.addColorStop(1, "#cf7e2b");
  b.fillStyle = grad;
  b.fillRect(0, 0, TEX_W, texH);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 9000; i++) {
    b.fillStyle = `rgba(255, 236, 200, ${0.08 + rnd() * 0.18})`;
    const r = 0.8 + rnd() * 2.2;
    b.beginPath();
    b.arc(rnd() * TEX_W, rnd() * texH, r, 0, Math.PI * 2);
    b.fill();
  }

  // pores: random points inside the outline; a few seeds grow into the big holes of osteoporotic bone
  const pores: Pore[] = [];
  while (pores.length < 1400) {
    const x = rnd() * TEX_W, y = rnd() * texH;
    if (!g.isPointInPath(path, x, y)) continue;
    const big = rnd() < 0.12;
    pores.push({ x, y, r0: 1.4 + rnd() * 1.8, g: big ? 0.8 + rnd() * 0.5 : 0.08 + rnd() * 0.17 });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  // ExtrudeGeometry maps uv = (x, y) in shape units; map the outline's box onto the texture
  texture.repeat.set(1 / w, 1 / h);
  texture.offset.set(-box.min.x / w, -box.min.y / h);

  const draw = (por: number) => {
    g.clearRect(0, 0, TEX_W, texH);
    g.save();
    g.clip(path);
    g.drawImage(base, 0, 0);
    // pores grow and merge as bone is lost
    const grow = Math.pow(por, 1.25);
    for (const p of pores) {
      const r = p.r0 + 19 * grow * p.g;
      g.fillStyle = r > 9 ? "#4a2a12" : "#5a3418";
      g.beginPath();
      g.arc(p.x, p.y, r, 0, Math.PI * 2);
      g.fill();
      if (r > 12) {
        g.strokeStyle = "rgba(255, 205, 150, 0.28)";
        g.lineWidth = 1.5;
        g.stroke();
      }
    }
    // cortical shell: a band inside the outline that thins as bone is lost
    const t = (0.46 - 0.3 * por) * k;
    g.lineWidth = t * 2;
    g.strokeStyle = "#ede0c8";
    g.lineJoin = "round";
    g.stroke(path);
    // cortex pores at high loss
    if (por > 0.35) {
      g.fillStyle = "rgba(90, 52, 24, 0.9)";
      for (let i = 0; i < pores.length; i += 9) {
        const p = pores[i];
        g.beginPath();
        g.arc(p.x, p.y, 1.2 + 3.5 * (por - 0.35), 0, Math.PI * 2);
        g.fill();
      }
    }
    // soft shading along the edge for roundness
    g.lineWidth = 6;
    g.strokeStyle = "rgba(120, 90, 60, 0.35)";
    g.stroke(path);
    g.restore();
    texture.needsUpdate = true;
  };

  return { shape, texture, draw, centre: new THREE.Vector2((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2) };
}

export default function MicroBone() {
  const face = useMemo(() => (typeof document === "undefined" ? null : makeFace()), []);
  const geometry = useMemo(() => {
    if (!face) return null;
    const geo = new THREE.ExtrudeGeometry(face.shape, { depth: 1.1, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 3, curveSegments: 24 });
    geo.translate(-face.centre.x, -face.centre.y, -0.55);
    return geo;
  }, [face]);
  const materials = useMemo(() => {
    if (!face) return [];
    const front = new THREE.MeshStandardMaterial({ map: face.texture, roughness: 0.72, metalness: 0 });
    const side = new THREE.MeshStandardMaterial({ color: "#e6d7bb", roughness: 0.6, metalness: 0 });
    return [front, side];
  }, [face]);

  const group = useRef<THREE.Group>(null);
  const last = useRef(-1);
  useFrame(() => {
    const p = story.get();
    const s = storyState(p);
    if (group.current) group.current.visible = s.micro;
    if (!s.micro || !face) return;
    const por = s.porosity;
    if (Math.abs(por - last.current) < 0.006) return;
    last.current = por;
    face.draw(por);
  });

  return (
    <group ref={group} position={MICRO_ORIGIN} visible={false}>
      {geometry ? <mesh geometry={geometry} material={materials} scale={0.62} rotation={[0, -0.12, 0]} /> : null}
      {/* dark shell so the sky never shows behind the bone */}
      <mesh>
        <sphereGeometry args={[60, 16, 12]} />
        <meshBasicMaterial color="#141416" side={THREE.BackSide} fog={false} />
      </mesh>
      <pointLight position={[4, 4, 7]} intensity={55} color="#fff3e0" distance={30} decay={2} />
      <pointLight position={[-6, -2, 5]} intensity={18} color="#ffd9a8" distance={30} decay={2} />
      <pointLight position={[2, 5, -4]} intensity={10} color="#c6f432" distance={30} decay={2} />
      <ambientLight intensity={0.35} />
    </group>
  );
}
