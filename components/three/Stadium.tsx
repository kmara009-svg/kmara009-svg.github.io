"use client";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import { HALF_STRAIGHT, INNER_R, LANES, LANE_W, OUTER_R, TRACK_LENGTH, lapLength, pointAt } from "@/lib/trackPath";
import { runnerPose } from "@/lib/scene";

/* ------------------------------------------------------------------ textures */
function trackTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 1024;
  const g = c.getContext("2d")!;
  g.fillStyle = "#b4432c";
  g.fillRect(0, 0, 256, 1024);
  const img = g.getImageData(0, 0, 256, 1024);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i] += n;
    img.data[i + 1] += n * 0.7;
    img.data[i + 2] += n * 0.6;
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = "rgba(255,255,255,0.92)";
  for (let k = 0; k <= LANES; k++) {
    const y = Math.round((k / LANES) * 1024);
    g.fillRect(0, Math.min(1019, Math.max(0, y - 2)), 256, 5);
  }
  g.fillRect(0, 0, 256, 10); // inner kerb
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function grassTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#4f8a2f";
  g.fillRect(0, 0, 512, 512);
  // mown stripes
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
    g.fillRect(i * 64, 0, 64, 512);
  }
  const img = g.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 30;
    img.data[i] += n * 0.6;
    img.data[i + 1] += n;
    img.data[i + 2] += n * 0.4;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function groundTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#6e7a52";
  g.fillRect(0, 0, 512, 512);
  const img = g.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 36;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n * 0.8;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function chequerTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 32;
  const g = c.getContext("2d")!;
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 === 0 ? "#f7f7f4" : "#1e1e1e";
      g.fillRect(i * 16, j * 16, 16, 16);
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function boardTexture(text: string, w = 1024, h = 128, font = "900 84px Inter, Arial, sans-serif") {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1e1e1e";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#c6f432";
  g.font = font;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function finishBoardTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 128;
  const g = c.getContext("2d")!;
  for (let i = 0; i < 32; i++)
    for (let j = 0; j < 4; j++) {
      g.fillStyle = (i + j) % 2 === 0 ? "#f7f7f4" : "#1e1e1e";
      g.fillRect(i * 32, j * 32, 32, 32);
    }
  g.fillStyle = "#1e1e1e";
  g.fillRect(256, 0, 512, 128);
  g.fillStyle = "#c6f432";
  g.font = "900 96px Inter, Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("FINISH", 512, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ geometry */
/* ring between the inner kerb and the outer edge, UV u along the lap, v across the lanes */
function trackGeometry(samples = 720) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const L = lapLength(INNER_R);
  const width = LANES * LANE_W;
  for (let i = 0; i <= samples; i++) {
    const d = (i / samples) * L;
    const p = pointAt(d, INNER_R);
    const nx = -p.fz, nz = p.fx; // outward (right-hand) normal
    pos.push(p.x, 0, p.z, p.x + nx * width, 0, p.z + nz * width);
    const u = (d / 4) ; // one texture repeat every 4 m
    uv.push(u, 0, u, 1);
    if (i < samples) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function apronGeometry(samples = 360, width = 7) {
  const pos: number[] = [];
  const idx: number[] = [];
  const L = lapLength(OUTER_R);
  for (let i = 0; i <= samples; i++) {
    const p = pointAt((i / samples) * L, OUTER_R);
    const nx = -p.fz, nz = p.fx;
    pos.push(p.x, -0.005, p.z, p.x + nx * width, -0.005, p.z + nz * width);
    if (i < samples) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function infieldGeometry(samples = 240) {
  const shape = new THREE.Shape();
  const L = lapLength(INNER_R - 0.05);
  for (let i = 0; i < samples; i++) {
    const p = pointAt((i / samples) * L, INNER_R - 0.05);
    if (i === 0) shape.moveTo(p.x, p.z);
    else shape.lineTo(p.x, p.z);
  }
  shape.closePath();
  const g = new THREE.ShapeGeometry(shape, 1);
  g.rotateX(Math.PI / 2); // shape is in XY; lay it flat (y = -z after rotation, flip below)
  g.scale(1, 1, -1);
  g.computeVertexNormals();
  // planar uvs in metres
  const uvs = g.attributes.uv as THREE.BufferAttribute;
  const posA = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < uvs.count; i++) uvs.setXY(i, posA.getX(i) / 12, posA.getZ(i) / 12);
  return g;
}

/* ------------------------------------------------------------------ crowd */
const SHIRTS = ["#c6f432", "#f7f7f4", "#1e1e1e", "#2d6cdf", "#d7263d", "#f2b705", "#8ec5ff", "#6b3fa0", "#f28c28", "#2a9d8f", "#e9e4d8", "#444a52"];
const SKINS = ["#f1c9a5", "#e0ac7e", "#c68642", "#8d5524", "#5c3a21", "#3b2314", "#ffdbac", "#a0673c"];

type Stand = { x0: number; x1: number; z0: number; rows: number; dir: 1 | -1; rowDepth: number; rise: number };
const STANDS: Stand[] = [
  { x0: -58, x1: 58, z0: OUTER_R + 7.5, rows: 24, dir: 1, rowDepth: 0.85, rise: 0.5 }, // main stand, south
  { x0: -46, x1: 46, z0: -(OUTER_R + 7.5), rows: 14, dir: -1, rowDepth: 0.85, rise: 0.5 }, // north stand
];

function useCrowd() {
  return useMemo(() => {
    const seats: { x: number; y: number; z: number; shirt: THREE.Color; skin: THREE.Color; seed: number }[] = [];
    let rnd = 12345;
    const r = () => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (const s of STANDS) {
      for (let row = 0; row < s.rows; row++) {
        for (let x = s.x0 + 0.3; x < s.x1; x += 0.56) {
          if (r() < 0.14) continue; // empty seat
          seats.push({
            x: x + (r() - 0.5) * 0.08,
            y: (row + 1) * s.rise + 0.62,
            z: s.z0 + s.dir * ((row + 0.5) * s.rowDepth + 0.15),
            shirt: new THREE.Color(SHIRTS[Math.floor(r() * SHIRTS.length)]),
            skin: new THREE.Color(SKINS[Math.floor(r() * SKINS.length)]),
            seed: r() * 6.28,
          });
        }
      }
    }
    return seats;
  }, []);
}

function Crowd() {
  const seats = useCrowd();
  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const bob = (m: THREE.Material) => {
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float seed = instanceMatrix[3][0] * 1.7 + instanceMatrix[3][2] * 0.9;
            transformed.y += 0.035 * sin(uTime * 2.3 + seed) * step(0.35, fract(seed * 0.37));
          #endif`
        );
    };
    m.customProgramCacheKey = () => "crowd-bob";
  };
  const bodyMat = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({ color: "#ffffff" });
    bob(m);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const headMat = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({ color: "#ffffff" });
    bob(m);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    seats.forEach((s, i) => {
      dummy.position.set(s.x, s.y, s.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      bodies.current!.setMatrixAt(i, dummy.matrix);
      bodies.current!.setColorAt(i, s.shirt);
      dummy.position.set(s.x, s.y + 0.42, s.z);
      dummy.updateMatrix();
      heads.current!.setMatrixAt(i, dummy.matrix);
      heads.current!.setColorAt(i, s.skin);
    });
    bodies.current!.instanceMatrix.needsUpdate = true;
    heads.current!.instanceMatrix.needsUpdate = true;
    if (bodies.current!.instanceColor) bodies.current!.instanceColor.needsUpdate = true;
    if (heads.current!.instanceColor) heads.current!.instanceColor.needsUpdate = true;
  }, [seats]);
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, seats.length]} material={bodyMat} frustumCulled={false}>
        <capsuleGeometry args={[0.2, 0.34, 3, 8]} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, seats.length]} material={headMat} frustumCulled={false}>
        <sphereGeometry args={[0.12, 8, 7]} />
      </instancedMesh>
    </group>
  );
}

function Stands() {
  const concrete = useMemo(() => new THREE.MeshStandardMaterial({ color: "#9a9a96", roughness: 0.95 }), []);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a3b3e", roughness: 0.8 }), []);
  const roofMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7d8187", roughness: 0.7, metalness: 0.15, side: THREE.DoubleSide }), []);
  return (
    <group>
      {STANDS.map((s, si) => {
        const len = s.x1 - s.x0;
        const cx = (s.x0 + s.x1) / 2;
        const top = (s.rows + 1) * s.rise;
        const depth = s.rows * s.rowDepth;
        return (
          <group key={si}>
            {Array.from({ length: s.rows }).map((_, row) => (
              <mesh key={row} material={concrete} position={[cx, ((row + 1) * s.rise) / 2, s.z0 + s.dir * (row + 0.5) * s.rowDepth]} castShadow receiveShadow>
                <boxGeometry args={[len, (row + 1) * s.rise, s.rowDepth]} />
              </mesh>
            ))}
            {/* back wall + roof on columns */}
            <mesh material={dark} position={[cx, (top + 6) / 2, s.z0 + s.dir * (depth + 1)]} castShadow>
              <boxGeometry args={[len + 2, top + 6, 1.2]} />
            </mesh>
            {/* a cantilever roof over the back rows only, so the crowd stays visible from above */}
            <mesh material={roofMat} position={[cx, top + 7.5, s.z0 + s.dir * (depth * 0.8 + 1)]} rotation={[s.dir * -0.08, 0, 0]} castShadow>
              <boxGeometry args={[len + 2, 0.4, depth * 0.42 + 2]} />
            </mesh>
            {Array.from({ length: Math.floor(len / 18) + 1 }).map((_, k) => (
              <mesh key={k} material={dark} position={[s.x0 + k * 18, (top + 7) / 2, s.z0 + s.dir * (depth + 0.5)]}>
                <cylinderGeometry args={[0.35, 0.35, top + 7, 10]} />
              </mesh>
            ))}
            {/* front barrier */}
            <mesh material={dark} position={[cx, 0.6, s.z0 - s.dir * 0.4]}>
              <boxGeometry args={[len, 1.2, 0.12]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Floodlights() {
  const pole = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c9ccd1", roughness: 0.5, metalness: 0.6 }), []);
  const lamp = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f4f4f0", emissive: "#ffffff", emissiveIntensity: 0.6 }), []);
  return (
    <group>
      {[[-100, -75], [100, -75], [-100, 78], [100, 78]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh material={pole} position={[0, 21, 0]}>
            <cylinderGeometry args={[0.5, 0.9, 42, 10]} />
          </mesh>
          <mesh material={lamp} position={[0, 43, 0]} rotation={[0, Math.atan2(-x, -z), 0]}>
            <boxGeometry args={[7, 4.5, 0.6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Trees() {
  const data = useMemo(() => {
    let rnd = 777;
    const r = () => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const out: [number, number, number][] = [];
    while (out.length < 220) {
      const x = (r() - 0.5) * 520;
      const z = (r() - 0.5) * 420;
      if (Math.abs(x) < 125 && Math.abs(z) < 100) continue; // keep the stadium clear
      out.push([x, z, 0.7 + r() * 0.8]);
    }
    return out;
  }, []);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    data.forEach(([x, z, s], i) => {
      d.position.set(x, 4 * s + 1.5, z);
      d.scale.setScalar(s);
      d.updateMatrix();
      crowns.current!.setMatrixAt(i, d.matrix);
      crowns.current!.setColorAt(i, c.setHSL(0.3 + (i % 7) * 0.008, 0.45, 0.22 + (i % 5) * 0.02));
      d.position.set(x, 1, z);
      d.scale.set(s, 1, s);
      d.updateMatrix();
      trunks.current!.setMatrixAt(i, d.matrix);
    });
    crowns.current!.instanceMatrix.needsUpdate = true;
    trunks.current!.instanceMatrix.needsUpdate = true;
    if (crowns.current!.instanceColor) crowns.current!.instanceColor.needsUpdate = true;
  }, [data]);
  return (
    <group>
      <instancedMesh ref={crowns} args={[undefined, undefined, data.length]} frustumCulled={false}>
        <sphereGeometry args={[4, 10, 8]} />
        <meshLambertMaterial color="#ffffff" />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, data.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.35, 0.5, 2.5, 7]} />
        <meshLambertMaterial color="#5b4634" />
      </instancedMesh>
      {/* a few flat-roofed buildings beyond the car park */}
      {[[-190, -40, 40, 14, 60], [-200, 40, 30, 10, 35], [205, -30, 50, 18, 45], [210, 55, 28, 9, 30], [0, -190, 90, 12, 40], [-80, 200, 60, 16, 50], [90, 205, 45, 11, 42]].map(([x, z, w, h, d], i) => (
        <mesh key={i} position={[x, h / 2, z]} castShadow={false}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={i % 2 ? "#b8b4ac" : "#9fa3a8"} roughness={0.9} />
        </mesh>
      ))}
      {/* car park */}
      <mesh position={[0, -0.2, -148]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[230, 60]} />
        <meshStandardMaterial color="#8a8b86" roughness={1} />
      </mesh>
    </group>
  );
}

/* sun light with a shadow camera that follows the runner */
export function Sun() {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    if (!light.current) return;
    target.position.set(runnerPose.x, 0, runnerPose.z);
    target.updateMatrixWorld();
    light.current.position.set(runnerPose.x + 45, 90, runnerPose.z - 60);
  });
  return (
    <>
      <directionalLight
        ref={light}
        target={target}
        intensity={2.4}
        color="#fff4e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-near={10}
        shadow-camera-far={260}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <primitive object={target} />
      <hemisphereLight args={["#bcd7ff", "#5c6b3f", 0.55]} />
    </>
  );
}

export default function Stadium() {
  const track = useMemo(() => trackGeometry(), []);
  const apron = useMemo(() => apronGeometry(), []);
  const infield = useMemo(() => infieldGeometry(), []);
  const trackTex = useMemo(trackTexture, []);
  const grassTex = useMemo(() => {
    const t = grassTexture();
    t.repeat.set(1, 1);
    return t;
  }, []);
  const groundTex = useMemo(() => {
    const t = groundTexture();
    t.repeat.set(40, 40);
    return t;
  }, []);
  const chequer = useMemo(chequerTexture, []);
  const finishTex = useMemo(finishBoardTexture, []);
  const screenTex = useMemo(() => boardTexture("REFUEL · REBUILD · RETURN", 1024, 256, "900 96px Inter, Arial, sans-serif"), []);
  const finish = pointAt(0, INNER_R + (LANES * LANE_W) / 2);

  return (
    <group>
      <Sky distance={450000} sunPosition={[0.45, 0.5, -0.6]} turbidity={2.6} rayleigh={0.55} mieCoefficient={0.0025} mieDirectionalG={0.82} />
      <Sun />
      {/* ground, track, infield */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]} receiveShadow>
        <planeGeometry args={[1400, 1400]} />
        <meshStandardMaterial map={groundTex} roughness={1} />
      </mesh>
      <mesh geometry={track} receiveShadow>
        <meshStandardMaterial map={trackTex} roughness={0.95} />
      </mesh>
      <mesh geometry={apron} receiveShadow>
        <meshStandardMaterial color="#8d8f8a" roughness={1} />
      </mesh>
      <mesh geometry={infield} position={[0, -0.01, 0]} receiveShadow>
        <meshStandardMaterial map={grassTex} roughness={1} />
      </mesh>
      {/* start / finish line across the lanes, with a half gantry on the outside */}
      <group position={[finish.x, 0, finish.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
          <planeGeometry args={[0.6, LANES * LANE_W]} />
          <meshBasicMaterial map={chequer} />
        </mesh>
        {[-(LANES * LANE_W) / 2 - 0.6, (LANES * LANE_W) / 2 + 0.6].map((z, i) => (
          <mesh key={i} position={[0, 1.5, z]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 3, 10]} />
            <meshStandardMaterial color="#f7f7f4" />
          </mesh>
        ))}
        <mesh position={[0, 3.1, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow>
          <boxGeometry args={[LANES * LANE_W + 1.4, 0.6, 0.08]} />
          <meshStandardMaterial map={finishTex} emissive="#ffffff" emissiveMap={finishTex} emissiveIntensity={0.35} />
        </mesh>
      </group>
      <Stands />
      <Crowd />
      {/* big screen above the north stand */}
      <mesh position={[0, 24, -(OUTER_R + 7.5 + 14 * 0.85 + 2)]} rotation={[0, 0, 0]}>
        <boxGeometry args={[26, 6.5, 0.6]} />
        <meshStandardMaterial map={screenTex} emissive="#ffffff" emissiveMap={screenTex} emissiveIntensity={0.9} roughness={0.6} />
      </mesh>
      <Floodlights />
      <Trees />
    </group>
  );
}
