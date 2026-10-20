"use client";
import * as THREE from "three";
import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { SIGNS, SIGN_FACE, signPose } from "@/lib/signs";
import { FINISH_INDEX, SLIDE_COUNT } from "@/lib/scene";

/* one 16:9 board per slide, rendered from a canvas: eyebrow, title and slide number */
function signTexture(eyebrow: string, title: string, index: number) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 576;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1e1e1e";
  g.fillRect(0, 0, 1024, 576);
  // lime diagonal stripe block on the right edge
  g.fillStyle = "#c6f432";
  g.beginPath();
  g.moveTo(940, 0);
  g.lineTo(1024, 0);
  g.lineTo(1024, 576);
  g.lineTo(880, 576);
  g.closePath();
  g.fill();
  g.fillStyle = "#1e1e1e";
  for (let y = -40; y < 620; y += 48) {
    g.beginPath();
    g.moveTo(960 - y * 0.15, y);
    g.lineTo(1024, y + 10);
    g.lineTo(1024, y + 26);
    g.lineTo(960 - y * 0.15 - 2.4, y + 16);
    g.closePath();
    g.fill();
  }
  // eyebrow chip
  g.font = "700 40px Inter, Arial, sans-serif";
  const ew = g.measureText(eyebrow.toUpperCase()).width + 48;
  g.fillStyle = "#c6f432";
  g.fillRect(56, 56, ew, 62);
  g.fillStyle = "#1e1e1e";
  g.textBaseline = "middle";
  g.fillText(eyebrow.toUpperCase(), 80, 88);
  // title, wrapped to at most three lines
  g.fillStyle = "#f7f7f4";
  g.font = "900 104px Inter, Arial, sans-serif";
  const words = title.toUpperCase().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (g.measureText(t).width > 780 && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  const size = lines.length > 2 ? 84 : 104;
  g.font = `900 ${size}px Inter, Arial, sans-serif`;
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, 56, 220 + i * (size * 0.98)));
  // slide number
  g.fillStyle = "#c6f432";
  g.font = "700 36px Inter, Arial, sans-serif";
  g.fillText(`${String(index).padStart(2, "0")} / ${SLIDE_COUNT}`, 56, 520);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function Warmup({ textures }: { textures: THREE.Texture[] }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    for (const t of textures) gl.initTexture(t);
    // every frame the composer's render pass draws the scene into a render target (linear output,
    // tone mapping left to its last pass), so build the programs for that rather than for the screen
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(target);
    // lights switched on and off with the scroll (userData.toggled) get every program built both
    // ways, so switching one never compiles mid-scroll; the shadow pass's depth programs (which
    // count the lights too, and which compile() does not build) by one render into the target each way
    const toggled: THREE.Object3D[] = [];
    scene.traverse((o) => void ((o as THREE.Light).isLight && o.userData.toggled && toggled.push(o)));
    const was = toggled.map((o) => o.visible);
    for (const on of toggled.length ? [true, false] : [true]) {
      for (const o of toggled) o.visible = on;
      gl.compile(scene, camera);
      if (toggled.length) gl.render(scene, camera);
    }
    toggled.forEach((o, k) => (o.visible = was[k]));
    gl.setRenderTarget(prev);
    target.dispose();
  }, [gl, scene, camera, textures]);
  return null;
}

export default function Billboards() {
  const items = useMemo(
    () =>
      SIGNS.filter((s) => s.index !== FINISH_INDEX).map((s) => ({ ...s, pose: signPose(s.index), tex: signTexture(s.eyebrow, s.title, s.index) })),
    []
  );
  const post = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2b2c2f", roughness: 0.6, metalness: 0.4 }), []);
  const back = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2b2c2f", roughness: 0.8 }), []);
  const textures = useMemo(() => items.map((s) => s.tex), [items]);
  return (
    <group>
      <Warmup textures={textures} />
      {items.map((s) => (
        <group key={s.index} position={[s.pose.x, 0, s.pose.z]} rotation={[0, s.pose.yaw, 0]}>
          {[-1.7, 1.7].map((x) => (
            <mesh key={x} material={post} position={[x, 1.2, -0.1]} castShadow>
              <cylinderGeometry args={[0.06, 0.06, 2.4, 10]} />
            </mesh>
          ))}
          <mesh material={back} position={[0, 2.3, -0.08]} castShadow>
            <boxGeometry args={[4.4, 2.56, 0.12]} />
          </mesh>
          <mesh position={[0, SIGN_FACE.y, 0]}>
            <planeGeometry args={[SIGN_FACE.w, SIGN_FACE.h]} />
            <meshStandardMaterial map={s.tex} emissive="#ffffff" emissiveMap={s.tex} emissiveIntensity={0.25} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
