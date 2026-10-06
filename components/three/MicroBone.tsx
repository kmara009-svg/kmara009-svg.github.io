"use client";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import { story, storyState } from "@/lib/story";

export const MICRO_ORIGIN = new THREE.Vector3(0, -80, 0);

/* Trabecular bone as an organic isosurface: a warped gyroid (the classic model for the
   plate-and-rod architecture of cancellous bone) polygonised with marching cubes.
   porosity 0 = thick, continuous trabeculae; 1 = thin, perforated and broken. */
const RES = 36;
const SIZE2 = RES * RES;

function hash(x: number, y: number, z: number) {
  let h = x * 374761393 + y * 668265263 + z * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const fade = (t: number) => t * t * (3 - 2 * t);
/* value noise on a 4-cell lattice across the volume */
function noise(x: number, y: number, z: number) {
  const fx = x * 4, fy = y * 4, fz = z * 4;
  const ix = Math.floor(fx), iy = Math.floor(fy), iz = Math.floor(fz);
  const tx = fade(fx - ix), ty = fade(fy - iy), tz = fade(fz - iz);
  const c = (dx: number, dy: number, dz: number) => hash(ix + dx + 11, iy + dy + 7, iz + dz + 3);
  const lx = (a: number, b: number) => a + (b - a) * tx;
  const y0 = lx(c(0, 0, 0), c(1, 0, 0)) + (lx(c(0, 1, 0), c(1, 1, 0)) - lx(c(0, 0, 0), c(1, 0, 0))) * ty;
  const y1 = lx(c(0, 0, 1), c(1, 0, 1)) + (lx(c(0, 1, 1), c(1, 1, 1)) - lx(c(0, 0, 1), c(1, 0, 1))) * ty;
  return y0 + (y1 - y0) * tz;
}

export default function MicroBone() {
  const { gyroid, grain, edge } = useMemo(() => {
    const n = RES * RES * RES;
    const gyroid = new Float32Array(n);
    const grain = new Float32Array(n);
    const edge = new Float32Array(n);
    const k = Math.PI * 2 * 3.6;
    for (let z = 0; z < RES; z++)
      for (let y = 0; y < RES; y++)
        for (let x = 0; x < RES; x++) {
          const i = x + y * RES + z * SIZE2;
          const u = x / (RES - 1), v = y / (RES - 1), w = z / (RES - 1);
          // warp the lattice so it stops looking like a crystal
          const px = u + 0.045 * Math.sin(v * 9.1 + 1.3) + 0.03 * Math.sin(w * 7.3);
          const py = v + 0.045 * Math.sin(w * 8.3 + 0.4) + 0.03 * Math.sin(u * 6.1);
          const pz = w + 0.045 * Math.sin(u * 7.7 + 2.1) + 0.03 * Math.sin(v * 8.9);
          const g = Math.sin(k * px) * Math.cos(k * py) + Math.sin(k * py) * Math.cos(k * pz) + Math.sin(k * pz) * Math.cos(k * px);
          gyroid[i] = Math.abs(g);
          grain[i] = noise(u, v, w);
          const d = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5), Math.abs(w - 0.5)) * 2; // 0 centre → 1 face
          edge[i] = d > 0.86 ? (d - 0.86) / 0.14 : 0;
        }
    return { gyroid, grain, edge };
  }, []);

  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#e6dbc3",
        roughness: 0.62,
        metalness: 0,
        sheen: 0.55,
        sheenColor: new THREE.Color("#fff1d6"),
        sheenRoughness: 0.7,
        clearcoat: 0.06,
        envMapIntensity: 0.35,
        side: THREE.DoubleSide,
      }),
    []
  );
  const mc = useMemo(() => {
    const m = new MarchingCubes(RES, material, false, false, 90000);
    m.isolation = 0;
    m.scale.setScalar(3.2);
    m.frustumCulled = false;
    return m;
  }, [material]);

  const group = useRef<THREE.Group>(null);
  const last = useRef(-1);

  useFrame((_, dt) => {
    const p = story.get();
    const s = storyState(p);
    if (group.current) {
      group.current.visible = s.micro;
      group.current.rotation.y += Math.min(dt, 0.05) * 0.05;
    }
    if (!s.micro) return;
    const por = s.porosity;
    if (Math.abs(por - last.current) < 0.004) return;
    last.current = por;
    const t = 0.95 - 0.5 * por; // trabecular thickness
    mc.reset(); // clears the field and the cached normals
    const field = mc.field as Float32Array;
    for (let i = 0; i < field.length; i++) {
      // material where |gyroid| < t, eaten away first where the grain is high, faded at the box faces
      field[i] = t - gyroid[i] - por * 0.6 * grain[i] - edge[i] * 3;
    }
    mc.update();
  });

  return (
    <group ref={group} position={MICRO_ORIGIN} visible={false}>
      <primitive object={mc} />
      <pointLight position={[4, 3.5, 4]} intensity={12} color="#fff2dc" distance={20} decay={2} />
      <pointLight position={[-4.5, -1, 3.5]} intensity={6} color="#c6f432" distance={20} decay={2} />
      <pointLight position={[0, 4, -4.5]} intensity={4} color="#9fd0ff" distance={20} decay={2} />
      <ambientLight intensity={0.1} />
    </group>
  );
}
