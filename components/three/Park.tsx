"use client";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Builder, box, canvasTexture, distTo, flat, grain, inside, loop, merge, offset, paint, path, ribbon, rng, solid, type P2 } from "./build";
import { SKY_GLSL, duskify, skyUniforms } from "./dusk";

/* Albert Park round the stadium: the lake to the north-east with its wooded islands and a fleet
   of dinghies, the ring road (the Grand Prix circuit) and the shore path with their lamps,
   parkland trees, palm-lined drives, the aquatic centre (MSAC) to the north-west, the car park,
   and the low streets of South Melbourne and Middle Park beyond. Instanced and merged: about a
   dozen draws for all of it. North is -z. */

const LAKE = loop(
  [
    [205, 112], [182, 40], [178, -40], [156, -118], [80, -162], [-20, -176], [-92, -226], [-140, -330], [-160, -500],
    [-150, -700], [-110, -900], [-60, -1080], [-20, -1250], [40, -1380], [150, -1430], [260, -1390], [330, -1250],
    [360, -1060], [420, -900], [520, -760], [600, -560], [620, -360], [560, -170], [480, -20], [400, 100], [310, 160], [244, 152],
  ],
  200
);
const ISLANDS = [
  loop([[250, -480], [330, -470], [395, -520], [410, -600], [370, -660], [300, -680], [240, -640], [220, -560]], 48),
  loop([[60, -950], [110, -930], [135, -975], [115, -1030], [70, -1035], [45, -995]], 28),
];
const RING = offset(LAKE, 34); // Lakeside Drive and Aughtie Drive: the road round the lake
const SHORE_PATH = offset(LAKE, 12);
const nearestOnRing = (x: number, z: number): P2 => RING.reduce((b, p) => (Math.hypot(p[0] - x, p[1] - z) < Math.hypot(b[0] - x, b[1] - z) ? p : b));
const ROADS: { pts: P2[]; w: number; closed?: boolean }[] = [
  { pts: RING, w: 9, closed: true },
  { pts: path([[-150, 268], [-150, 120], [-152, -20], [-146, -150], nearestOnRing(-130, -215)], 60), w: 9 }, // Aughtie Drive
  { pts: [[-1400, 268], [1400, 268]], w: 14 }, // Albert Road
  { pts: [[-415, 268], [-415, -2000]], w: 11 },
  { pts: [[760, 268], [760, -2000]], w: 14 }, // Queens Road
  { pts: [[172, 150], nearestOnRing(215, 160)], w: 8 }, // into the car park
];
const PATHS: { pts: P2[]; w: number; closed?: boolean }[] = [
  { pts: SHORE_PATH, w: 3.2, closed: true },
  { pts: [[-72, -72], [72, -72]], w: 4 },
  { pts: [[-118, 106], [-145, 106]], w: 6 },
];
const MSAC = { x0: -345, x1: -205, z0: -250, z1: -120 };
const CARPARK = { x0: 8, x1: 172, z0: 119, z1: 168 };
/* footprints the trees keep out of */
const inStadium = (x: number, z: number) => Math.abs(x) < 136 && z > -94 && z < 124;
const inRect = (x: number, z: number, r: { x0: number; x1: number; z0: number; z1: number }, m: number) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
const LAKE_PAD = offset(LAKE, 7);
function clearGround(x: number, z: number) {
  if (inStadium(x, z) || inRect(x, z, MSAC, 12) || inRect(x, z, CARPARK, 8)) return false;
  if (inside([x, z], LAKE_PAD)) return false;
  for (const r of ROADS) if (distTo([x, z], r.pts, r.closed) < r.w / 2 + 4) return false;
  for (const p of PATHS) if (distTo([x, z], p.pts, p.closed) < p.w / 2 + 2.5) return false;
  return true;
}

/* ------------------------------------------------------------------ textures and materials */
function grassTexture() {
  const t = canvasTexture(512, 512, (g) => {
    g.fillStyle = "#56693c";
    g.fillRect(0, 0, 512, 512);
    const r = rng(3);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = r() < 0.5 ? "rgba(30,45,20,0.10)" : "rgba(150,160,90,0.08)";
      g.beginPath();
      g.ellipse(r() * 512, r() * 512, 20 + r() * 70, 14 + r() * 50, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    grain(g, 30, [0.7, 1, 0.5]);
  });
  t.repeat.set(1 / 26, 1 / 26);
  return t;
}
const lambert = (o: THREE.MeshLambertMaterialParameters) => duskify(new THREE.MeshLambertMaterial(o));

const WATER_VERT = /* glsl */ `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
/* the lake: deep blue looking down, the dusk sky mirrored at grazing angles, with slow ripples */
const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep;
varying vec3 vWorld;
${SKY_GLSL}
#include <fog_pars_fragment>
void main() {
  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 v = toCam / dist;
  vec2 p = vWorld.xz;
  float fade = 1.0 - smoothstep(120.0, 800.0, dist);
  // a gentle warp keeps the ripples from running in ruler-straight bands
  vec2 w = p + 7.0 * vec2(sin(p.y * 0.017 + 1.3), sin(p.x * 0.021 + 0.7));
  vec2 g = vec2(0.8, 0.6) * cos(dot(w, vec2(0.8, 0.6)) * 0.31 + uTime * 0.8) * 0.032;
  g += vec2(-0.45, 0.89) * cos(dot(w, vec2(-0.45, 0.89)) * 0.83 + uTime * 1.3) * 0.032 * fade;
  g += vec2(0.96, -0.28) * cos(dot(w, vec2(0.96, -0.28)) * 1.9 + uTime * 1.9) * 0.02 * fade;
  g += vec2(-0.7, -0.71) * cos(dot(w, vec2(-0.7, -0.71)) * 1.27 + uTime * 1.6) * 0.024 * fade;
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 r = reflect(-v, n);
  r.y = abs(r.y);
  float f = 0.035 + 0.965 * pow(1.0 - max(dot(v, n), 0.0), 5.0);
  gl_FragColor = vec4(mix(uDeep, skyColor(r, fogColor), f), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/* ------------------------------------------------------------------ geometry */
function groundGeometry() {
  const E = 4500;
  return merge([flat([[-E, -E], [E, -E], [E, E], [-E, E]], -0.3, [LAKE]), ...ISLANDS.map((i) => flat(i, -0.3))]);
}

/* roads, paths, paving, the stone lake edge and the car park, flat on the grass */
function decalGeometry() {
  const b = new Builder();
  for (const r of ROADS) b.add(ribbon(r.pts, r.w, -0.29, r.closed), "#37383c");
  for (const p of PATHS) b.add(ribbon(p.pts, p.w, -0.285, p.closed), "#a59e8b");
  b.add(ribbon(offset(LAKE, 1.4), 2.8, -0.282, true), "#968e7e");
  for (const i of ISLANDS) b.add(ribbon(offset(i, 1), 2, -0.282, true), "#968e7e");
  b.add(flat([[CARPARK.x0, CARPARK.z0], [CARPARK.x1, CARPARK.z0], [CARPARK.x1, CARPARK.z1], [CARPARK.x0, CARPARK.z1]], -0.288), "#3c3d41");
  b.add(flat([[-118, 97], [118, 97], [118, 116], [-118, 116]], -0.28), "#8d8b85"); // forecourt behind the main stand
  return b.build();
}

/* MSAC, park lamps along the ring road and shore path, car park lights */
function parkBuildings(glow: Builder) {
  const b = new Builder();
  const { x0, x1, z0, z1 } = MSAC;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
  b.add(box(w, 9, d, cx, 4.5, cz), "#3a4652");
  b.add(box(w + 1, 0.8, d + 1, cx, 9.2, cz), "#e9eaec");
  // five shallow barrel vaults
  for (let k = 0; k < 5; k++) {
    const vault = new THREE.CylinderGeometry(w / 10, w / 10, d - 4, 18, 1, false, -Math.PI / 2, Math.PI);
    vault.rotateX(-Math.PI / 2).scale(1, 0.42, 1); // axis along z, bulging up
    b.add(vault.translate(x0 + (k + 0.5) * (w / 5), 9.6, cz), "#e4e6e9");
  }
  // pool halls lit through their glass, the entrance foyer, in mullioned panes
  for (const s of [-1, 1]) for (let x = x0 + 4; x < x1 - 8; x += 8) glow.add(box(7.2, 5.5, 0.1, x + 4, 4, cz + s * (d / 2 + 0.06)), "#9fd2ff", 0.32 + 0.12 * Math.sin(x));
  for (let z = z0 + 6; z < z1 - 10; z += 8) glow.add(box(0.1, 5.5, 7.2, x1 + 0.06, 4, z + 4), "#ffe0b0", 0.3 + 0.1 * Math.cos(z));
  // lamps: ring road every 45 m, shore path every 38 m, car park
  const lamp = (x: number, z: number, h: number) => {
    b.add(box(0.18, h, 0.18, x, h / 2 - 0.3, z), "#2c2f33");
    glow.add(box(0.5, 0.25, 0.5, x, h - 0.3, z), "#ffdcae", 5);
  };
  const along = (pts: P2[], step: number, side: number, h: number) => {
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      const l = Math.hypot(bx - ax, bz - az);
      acc += l;
      if (acc < step) continue;
      acc = 0;
      const nx = -(bz - az) / l, nz = (bx - ax) / l;
      if (!inStadium(bx, bz)) lamp(bx + nx * side, bz + nz * side, h);
    }
  };
  along([...RING, RING[0]], 45, 6.5, 9);
  along([...SHORE_PATH, SHORE_PATH[0]], 38, 2.4, 4.5);
  for (let x = CARPARK.x0 + 14; x < CARPARK.x1; x += 36) for (const z of [CARPARK.z0 + 21, CARPARK.z1 - 2]) lamp(x, z, 10);
  return b.build();
}

/* a lumpy crown of three blobs, about 2 units across */
function crownGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const blobs = [[0, 0.05, 0, 1], [0.62, -0.16, 0.25, 0.74], [-0.5, -0.12, -0.36, 0.72]];
  for (const [x, y, z, s] of blobs) {
    const g = mergeVertices(new THREE.IcosahedronGeometry(s, 1).deleteAttribute("normal").deleteAttribute("uv")); // shared vertices: smooth, unbroken lumps
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const k = 1 + 0.16 * Math.sin(vx * 7.1 + vz * 3.3) * Math.cos(vy * 5.7 - vx * 2.1);
      p.setXYZ(i, vx * k, vy * k * 0.9, vz * k);
    }
    g.computeVertexNormals();
    parts.push(paint(g.translate(x, y, z), "#ffffff"));
  }
  return merge(parts);
}
/* a palm's crown: arching fronds round a knob, at the trunk's top (origin) */
function frondsGeometry() {
  const pos: number[] = [];
  const N = 12, S = 4, L = 4.6;
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2 + (k % 2) * 0.2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const lift = k % 2 ? 0.75 : 0.45;
    const P = (t: number, side: number): number[] => {
      const h = L * t, v = L * (lift * t - (lift + 0.35) * t * t), w = 0.62 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.7) * side;
      return [ca * h - sa * w, v - Math.abs(w) * 0.25, sa * h + ca * w];
    };
    for (let i = 0; i < S; i++) {
      const t0 = i / S, t1 = (i + 1) / S;
      const a0 = P(t0, -1), b0 = P(t0, 1), a1 = P(t1, -1), b1 = P(t1, 1);
      pos.push(...a0, ...a1, ...b0, ...b0, ...a1, ...b1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return merge([paint(g, "#5d8a3c"), paint(new THREE.SphereGeometry(0.55, 7, 5).translate(0, -0.2, 0), "#6b5638")]);
}
/* a dinghy: hull, mast, mainsail and jib (bow towards +x) */
function boatGeometry() {
  const b = new Builder();
  b.add(box(3.6, 0.5, 1.5, -0.3, 0.25, 0), "#f2f2ef");
  b.add(box(1.06, 0.5, 1.06, 1.5, 0.25, 0, Math.PI / 4), "#f2f2ef");
  b.add(new THREE.CylinderGeometry(0.05, 0.06, 6.6, 5).translate(0.5, 3.6, 0), "#cfd2d6");
  const tri = (pts: number[][]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3));
    g.computeVertexNormals();
    return g;
  };
  b.add(tri([[0.5, 0.8, 0], [0.5, 6.8, 0], [-2.3, 0.9, 0]]), "#f7f4ea");
  b.add(tri([[0.55, 5.6, 0], [2.0, 0.65, 0], [0.6, 0.9, 0]]), "#f7f4ea");
  return b.build();
}
/* a house: walls with a gabled roof, unit footprint, eaves at 1 */
function houseGeometry() {
  const b = new Builder();
  b.add(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), "#ffffff");
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const A = V(-0.55, 1, -0.55), B = V(0.55, 1, -0.55), Cc = V(0.55, 1, 0.55), D = V(-0.55, 1, 0.55), R1 = V(-0.55, 1.45, 0), R2 = V(0.55, 1.45, 0);
  b.add(solid([[A, R1, R2], [A, R2, B], [D, Cc, R2], [D, R2, R1], [A, D, R1], [B, R2, Cc]], V(0, 1.1, 0)), "#7a4a3e"); // ridge along x
  return b.build();
}
function carGeometry() {
  const b = new Builder();
  b.add(box(4.3, 0.8, 1.8, 0, 0.55, 0), "#ffffff");
  b.add(box(2.3, 0.6, 1.62, -0.25, 1.25, 0), "#30353c");
  return b.build();
}

/* ------------------------------------------------------------------ placements */
type Inst = { x: number; y: number; z: number; sx: number; sy: number; sz: number; ry: number; rx?: number; rz?: number; color?: THREE.ColorRepresentation };
const TREE_GREENS = ["#3d5a2d", "#4a6a33", "#5d6c43", "#2f4c2a", "#55703a", "#667249", "#40603a"];
function treePlacements() {
  const r = rng(11);
  const out: Inst[] = [];
  const add = (x: number, z: number, s: number) =>
    out.push({ x, y: 0, z, sx: s, sy: s * (0.85 + r() * 0.35), sz: s, ry: r() * 6.28, color: TREE_GREENS[Math.floor(r() * TREE_GREENS.length)] });
  // a belt of big trees round the lake
  let tries = 0;
  while (out.length < 280 && tries++ < 20000) {
    const i = Math.floor(r() * LAKE.length);
    const [x, z] = LAKE[i];
    const [ax, az] = LAKE[(i + 1) % LAKE.length];
    const l = Math.hypot(ax - x, az - z) || 1;
    const d = 16 + r() * 70;
    const px = x + ((az - z) / l) * d * -1, pz = z + ((ax - x) / l) * d;
    const qx = x - ((az - z) / l) * d * -1, qz = z - ((ax - x) / l) * d;
    const [tx, tz] = inside([px, pz], LAKE) ? [qx, qz] : [px, pz];
    if (clearGround(tx, tz)) add(tx, tz, 3.4 + r() * 2.6);
  }
  // the rest of the park, thinning out to the north
  tries = 0;
  while (out.length < 700 && tries++ < 40000) {
    const x = -405 + r() * 1150, z = -1900 + r() * 2165;
    if (z < -1500 && r() < 0.5) continue;
    if (clearGround(x, z)) add(x, z, 3 + r() * 2.8);
  }
  // wooded islands
  for (const isl of ISLANDS) {
    const xs = isl.map((p) => p[0]), zs = isl.map((p) => p[1]);
    const land = offset(isl, -5);
    let n = 0;
    tries = 0;
    while (n < (isl === ISLANDS[0] ? 46 : 16) && tries++ < 4000) {
      const x = Math.min(...xs) + r() * (Math.max(...xs) - Math.min(...xs)), z = Math.min(...zs) + r() * (Math.max(...zs) - Math.min(...zs));
      if (!inside([x, z], land)) continue;
      add(x, z, 3.4 + r() * 2.4);
      n++;
    }
  }
  return out;
}
function palmPlacements() {
  const r = rng(21);
  const out: P2[] = [];
  for (let z = -96; z <= 160; z += 22) out.push([-139, z]); // Aughtie Drive
  for (let x = -110; x <= 110; x += 22) out.push([x, 111]); // the forecourt
  for (let z = -60; z <= 96; z += 26) out.push([127 + r() * 3, z]); // the lake side
  return out.filter(([x, z]) => !(Math.abs(x + 124) < 4 && Math.abs(z - 14) < 4));
}
function boatPlacements() {
  const r = rng(31);
  const water = offset(LAKE, -28);
  const clear = ISLANDS.map((i) => offset(i, 30));
  const out: Inst[] = [];
  let tries = 0;
  while (out.length < 52 && tries++ < 10000) {
    const x = -150 + r() * 780, z = -1150 + r() * 1260;
    if (!inside([x, z], water) || clear.some((i) => inside([x, z], i))) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 24)) continue;
    const tint = r() < 0.15 ? ["#ffd0c8", "#cfe0ff", "#fff0b8"][Math.floor(r() * 3)] : "#ffffff";
    out.push({ x, y: -0.5, z, sx: 1.25, sy: 1.25, sz: 1.25, ry: 0.5 + (r() - 0.5) * 1.4 + (r() < 0.5 ? Math.PI : 0), rx: 0.12 + r() * 0.16, color: tint });
  }
  return out;
}
function housePlacements() {
  const r = rng(41);
  const out: Inst[] = [];
  const tints = ["#f4efe6", "#e8dcc6", "#d9d4cc", "#efe3c9", "#cbbfae", "#e2d2c0", "#bfb9b2"];
  const house = (x: number, z: number, along: "x" | "z") => {
    if (r() > 0.62) return;
    const w = 7 + r() * 2.5, d = 11 + r() * 5, h = r() < 0.25 ? 7 + r() * 2 : 4.2 + r() * 1.4;
    // width along the street, ridge parallel to it
    out.push({ x, y: -0.3, z, sx: w, sy: h, sz: d, ry: along === "x" ? 0 : Math.PI / 2, color: tints[Math.floor(r() * tints.length)] });
  };
  for (let z = 300; z < 1000; z += 54) for (let x = -1180; x < 1180; x += 10.5) for (const o of [-8, 8]) house(x, z + o, "x");
  for (let x = -1180; x < -440; x += 54) for (let z = -1650; z < 285; z += 10.5) for (const o of [-8, 8]) house(x + o, z, "z");
  return out;
}
function carPlacements() {
  const r = rng(51);
  const out: Inst[] = [];
  const paints = ["#e8e8e8", "#1e1f22", "#7d8288", "#b6babf", "#7a1f1f", "#24406e", "#f2f2f2", "#3c3f44", "#a8a08e", "#2f5a3a"];
  for (const z of [125.3, 129.9, 141, 145.6, 156.7, 161.3])
    for (let x = CARPARK.x0 + 4; x < CARPARK.x1 - 3; x += 2.7) if (r() < 0.72) out.push({ x, y: -0.3, z, sx: 1, sy: 1, sz: 1, ry: Math.PI / 2 + (r() < 0.5 ? Math.PI : 0) + (r() - 0.5) * 0.06, color: paints[Math.floor(r() * paints.length)] });
  return out;
}

/* an instanced mesh filled from placements */
function Instances({ geometry, material, items }: { geometry: THREE.BufferGeometry; material: THREE.Material; items: Inst[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current!;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    items.forEach((it, i) => {
      o.position.set(it.x, it.y, it.z);
      o.rotation.set(it.rx ?? 0, it.ry, it.rz ?? 0, "YXZ");
      o.scale.set(it.sx, it.sy, it.sz);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(it.color ?? "#ffffff"));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} />;
}

export default function Park() {
  const geo = useMemo(() => {
    const glow = new Builder();
    const buildings = parkBuildings(glow);
    return {
      ground: groundGeometry(),
      water: flat(offset(LAKE, 6), -0.42),
      decals: decalGeometry(),
      buildings,
      glow: glow.build(),
      crown: crownGeometry(),
      trunk: new THREE.CylinderGeometry(0.2, 0.32, 1, 5).translate(0, 0.5, 0),
      palmTrunk: new THREE.CylinderGeometry(0.28, 0.42, 1, 6, 3).translate(0, 0.5, 0),
      fronds: frondsGeometry(),
      boat: boatGeometry(),
      house: houseGeometry(),
      car: carGeometry(),
    };
  }, []);
  const mats = useMemo(() => {
    const decals = lambert({ vertexColors: true });
    decals.polygonOffset = true;
    decals.polygonOffsetFactor = -1;
    decals.polygonOffsetUnits = -4;
    const water = new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...skyUniforms(), uTime: { value: 0 }, uDeep: { value: new THREE.Color("#18264a") } },
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      fog: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 4,
    });
    return {
      ground: lambert({ map: grassTexture() }),
      water,
      decals,
      buildings: lambert({ vertexColors: true }),
      glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
      crown: lambert({ color: "#ffffff", vertexColors: true }),
      trunk: lambert({ color: "#5a4636" }),
      palmTrunk: lambert({ color: "#7d6a52" }),
      fronds: lambert({ vertexColors: true, side: THREE.DoubleSide }),
      boat: lambert({ vertexColors: true, side: THREE.DoubleSide }),
      house: lambert({ vertexColors: true }),
      car: lambert({ vertexColors: true }),
    };
  }, []);
  const items = useMemo(() => {
    const trees = treePlacements();
    const r = rng(61);
    const top = new THREE.Vector3(), e = new THREE.Euler();
    const palms = palmPlacements().map(([x, z]) => {
      const p = { x, z, h: 7.5 + r() * 3, lean: (r() - 0.5) * 0.08, ry: r() * 6.28 };
      top.set(0, p.h, 0).applyEuler(e.set(p.lean, p.ry, -p.lean, "YXZ"));
      return { ...p, top: top.clone() };
    });
    return {
      crowns: trees.map((t) => ({ ...t, y: t.sy * 1.2 + 1.6, sy: t.sy * 0.9 })),
      trunks: trees.map((t) => ({ x: t.x, y: -0.3, z: t.z, sx: t.sx * 0.9, sy: t.sy * 1.25 + 1.6, sz: t.sx * 0.9, ry: t.ry })),
      palmTrunks: palms.map((p) => ({ x: p.x, y: -0.3, z: p.z, sx: 1, sy: p.h, sz: 1, ry: p.ry, rx: p.lean, rz: -p.lean })),
      palmCrowns: palms.map((p) => ({ x: p.x + p.top.x, y: p.top.y - 0.4, z: p.z + p.top.z, sx: 1, sy: 1, sz: 1, ry: p.ry, color: r() < 0.5 ? "#ffffff" : "#d9e6c8" })),
      boats: boatPlacements(),
      houses: housePlacements(),
      cars: carPlacements(),
    };
  }, []);
  useFrame(({ clock }) => {
    mats.water.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <group>
      <mesh geometry={geo.ground} material={mats.ground} />
      <mesh geometry={geo.water} material={mats.water} />
      <mesh geometry={geo.decals} material={mats.decals} />
      <mesh geometry={geo.buildings} material={mats.buildings} />
      <mesh geometry={geo.glow} material={mats.glow} />
      <Instances geometry={geo.crown} material={mats.crown} items={items.crowns} />
      <Instances geometry={geo.trunk} material={mats.trunk} items={items.trunks} />
      <Instances geometry={geo.palmTrunk} material={mats.palmTrunk} items={items.palmTrunks} />
      <Instances geometry={geo.fronds} material={mats.fronds} items={items.palmCrowns} />
      <Instances geometry={geo.boat} material={mats.boat} items={items.boats} />
      <Instances geometry={geo.house} material={mats.house} items={items.houses} />
      <Instances geometry={geo.car} material={mats.car} items={items.cars} />
    </group>
  );
}
