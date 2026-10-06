"use client";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { story, storyState } from "@/lib/story";

function makeTrackTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1024;
  const g = c.getContext("2d")!;
  g.fillStyle = "#b8442f";
  g.fillRect(0, 0, 1024, 1024);
  // grain
  const img = g.getImageData(0, 0, 1024, 1024);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    img.data[i] += n;
    img.data[i + 1] += n * 0.7;
    img.data[i + 2] += n * 0.6;
  }
  g.putImageData(img, 0, 0);
  // lane lines (6 lanes across the texture)
  g.fillStyle = "rgba(255,255,255,0.92)";
  for (let i = 0; i <= 6; i++) {
    const x = Math.round((i / 6) * 1024);
    g.fillRect(x - 5, 0, 10, 1024);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1.6, 6);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeChequerTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d")!;
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 === 0 ? "#f7f7f4" : "#1e1e1e";
      g.fillRect(i * 32, j * 32, 32, 32);
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeFinishTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1e1e1e";
  g.fillRect(0, 0, 1024, 128);
  for (let i = 0; i < 32; i++)
    for (let j = 0; j < 4; j++) {
      if ((i + j) % 2 === 0) {
        g.fillStyle = "#f7f7f4";
        g.fillRect(i * 32, j * 32, 32, 32);
      }
    }
  g.fillStyle = "#1e1e1e";
  g.fillRect(256, 0, 512, 128);
  g.fillStyle = "#c6f432";
  g.font = "900 96px Inter, Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("FINISH", 512, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function Track() {
  const tex = useMemo(makeTrackTexture, []);
  const finishTex = useMemo(makeFinishTexture, []);
  const chequerTex = useMemo(makeChequerTexture, []);
  const finish = useRef<THREE.Group>(null);
  const streaks = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const streakData = useMemo(
    () =>
      Array.from({ length: 48 }, () => ({
        x: (Math.random() - 0.5) * 7,
        y: 0.04 + Math.random() * 1.0,
        z: (Math.random() - 0.5) * 30,
        len: 0.8 + Math.random() * 2.2,
        v: 6 + Math.random() * 6,
      })),
    []
  );

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    const s = storyState(story.get());
    const speed = s.micro ? 0 : 2.2 + 3.2 * s.sprint;
    tex.offset.y -= d * speed * 0.14;
    if (finish.current) {
      finish.current.visible = s.finish;
      finish.current.position.z = 17 - 16.4 * s.finishLine;
    }
    if (streaks.current) {
      streaks.current.layers.set(1);
      const vis = s.micro ? 0 : 0.25 + 0.75 * s.sprint;
      streakData.forEach((st, i) => {
        st.z -= d * st.v * (0.5 + s.sprint);
        if (st.z < -22) st.z = 10;
        dummy.position.set(st.x, st.y, st.z);
        dummy.scale.set(1, 1, vis > 0 ? st.len * (0.6 + s.sprint) : 0.0001);
        dummy.updateMatrix();
        streaks.current!.setMatrixAt(i, dummy.matrix);
      });
      streaks.current.instanceMatrix.needsUpdate = true;
      (streaks.current.material as THREE.MeshBasicMaterial).opacity = 0.07 * vis;
    }
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -10]} receiveShadow>
        <planeGeometry args={[14, 70]} />
        <meshStandardMaterial map={tex} roughness={0.95} metalness={0} />
      </mesh>
      {/* kerbs */}
      {[-7.02, 7.02].map((x) => (
        <mesh key={x} position={[x, 0.03, -10]}>
          <boxGeometry args={[0.12, 0.06, 70]} />
          <meshStandardMaterial color="#f7f7f4" roughness={0.6} />
        </mesh>
      ))}
      {/* finish line + banner */}
      <group ref={finish} visible={false}>
        {/* chequered finish line on the track */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
          <planeGeometry args={[14, 0.6]} />
          <meshBasicMaterial map={chequerTex} />
        </mesh>
        {/* half gantry over the left lanes, a few metres past the line, with the FINISH board
            (kept left of centre so the top-right of the frame stays clear) */}
        {[1.5, 7.2].map((x) => (
          <mesh key={x} position={[x, 1.2, 5]}>
            <cylinderGeometry args={[0.05, 0.05, 2.4, 10]} />
            <meshStandardMaterial color="#f7f7f4" />
          </mesh>
        ))}
        <mesh position={[4.35, 2.2, 5]} rotation={[0, Math.PI, 0]}>
          <boxGeometry args={[5.7, 0.5, 0.06]} />
          <meshStandardMaterial map={finishTex} emissive="#ffffff" emissiveMap={finishTex} emissiveIntensity={0.4} />
        </mesh>
      </group>
      {/* speed streaks: cheap motion blur */}
      <instancedMesh ref={streaks} args={[undefined, undefined, 48]}>
        <boxGeometry args={[0.007, 0.007, 1]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.2} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
    </group>
  );
}

export function Dust() {
  const pts = useRef<THREE.Points>(null);
  const N = 700;
  const { positions, vel } = useMemo(() => {
    const positions = new Float32Array(N * 3);
    const vel = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = Math.random() * 1.8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 16 - 3;
      vel[i * 3] = (Math.random() - 0.5) * 0.3;
      vel[i * 3 + 1] = 0.05 + Math.random() * 0.2;
      vel[i * 3 + 2] = -(1.2 + Math.random() * 1.5);
    }
    return { positions, vel };
  }, []);
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    const s = storyState(story.get());
    if (!pts.current) return;
    pts.current.layers.set(1); // layer 1: skipped by the contact-shadow camera
    pts.current.visible = !s.micro;
    const k = 1 + 1.5 * s.sprint;
    const arr = pts.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < N; i++) {
      arr[i * 3] += vel[i * 3] * d;
      arr[i * 3 + 1] += vel[i * 3 + 1] * d;
      arr[i * 3 + 2] += vel[i * 3 + 2] * d * k;
      if (arr[i * 3 + 2] < -11 || arr[i * 3 + 1] > 2.2) {
        arr[i * 3] = (Math.random() - 0.5) * 8;
        arr[i * 3 + 1] = Math.random() * 0.5;
        arr[i * 3 + 2] = -2 + Math.random() * 5;
      }
    }
    pts.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={pts}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#f1e4cc" size={0.035} sizeAttenuation transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}
