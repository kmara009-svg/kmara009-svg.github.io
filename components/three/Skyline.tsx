"use client";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { canvasTexture, rng } from "./build";
import { SKY_GLSL, skyUniforms } from "./dusk";

/* The dusk sky over Albert Park and the Melbourne skyline to the north: the CBD towers, Southbank
   with Eureka's gold crown and Australia 108, the Arts Centre spire, and the apartment towers
   along Queens Road across the lake. One instanced draw for every tower, windows from one mipmapped
   texture (so distant facades blend instead of shimmering), hazed into the sky behind them. */

const NOISE_GLSL = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return s;
}`;

/* ------------------------------------------------------------------ sky */
function SkyDome() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...skyUniforms() },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = position;
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww; // on the far plane: drawn last, only where nothing else is
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 fogColor;
          varying vec3 vDir;
          ${SKY_GLSL}
          ${NOISE_GLSL}
          void main() {
            vec3 d = normalize(vDir);
            vec3 c = skyColor(d, fogColor);
            // streaks of cloud lit from below by the afterglow
            if (d.y > 0.0) {
              vec2 q = d.xz / (d.y + 0.1);
              float n = fbm(q * vec2(0.55, 1.9) + vec2(4.3, 1.1));
              float cl = smoothstep(0.5, 0.78, n) * smoothstep(0.0, 0.06, d.y) * (1.0 - smoothstep(0.32, 0.7, d.y));
              float s = max(dot(normalize(vec3(d.x, 0.0, d.z)), uSunDir), 0.0);
              vec3 lit = mix(uHorizon * 1.1, uGlow * 1.2, 0.25 + 0.5 * s * s);
              c = mix(c, mix(lit, uMid * 0.75, smoothstep(0.05, 0.45, d.y)), cl * 0.8);
            }
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
        side: THREE.BackSide,
        depthWrite: false,
        fog: true,
      }),
    []
  );
  useFrame(({ camera }) => ref.current?.position.copy(camera.position));
  return (
    <mesh ref={ref} material={mat} renderOrder={10} frustumCulled={false}>
      <sphereGeometry args={[100, 48, 24]} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ towers */
/* 8 bays (3 m) by 8 floors (3.6 m) of windows: dark glass, some lit warm, a few cool */
function windowTexture() {
  const t = canvasTexture(256, 256, (g) => {
    const r = rng(7);
    g.clearRect(0, 0, 256, 256);
    for (let j = 0; j < 8; j++) {
      const floorLit = r() < 0.22;
      for (let i = 0; i < 8; i++) {
        const lit = r() < (floorLit ? 0.7 : 0.14);
        g.fillStyle = lit ? (r() < 0.75 ? "#ffcf94" : "#dfe8ff") : "#1a2130";
        g.fillRect(i * 32 + 6, j * 32 + 8, 20, 18);
      }
    }
  });
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

type Tower = { x: number; z: number; w: number; d: number; h: number; ry?: number; color: string; kind?: number };
const GLASS = ["#4f5d70", "#5a6678", "#3e4a5c", "#6a7180", "#58606b", "#7b7a78", "#8a8378", "#465568", "#5f6f86"];
function towers(): Tower[] {
  const r = rng(77);
  const out: Tower[] = [];
  const pick = () => GLASS[Math.floor(r() * GLASS.length)];
  const cluster = (cx: number, cz: number, sx: number, sz: number, n: number, hMin: number, hMax: number, peak: number, wMin = 22, wMax = 48) => {
    for (let i = 0; i < n; i++) {
      const x = cx + (r() - 0.5) * 2 * sx, z = cz + (r() - 0.5) * 2 * sz;
      const centre = Math.exp(-((x - cx) ** 2) / (2 * (sx * peak) ** 2));
      const h = hMin + (hMax - hMin) * Math.pow(r(), 1.6) * (0.35 + 0.65 * centre);
      const w = wMin + r() * (wMax - wMin);
      out.push({ x, z, w, d: w * (0.7 + r() * 0.6), h, ry: (r() - 0.5) * 0.25, color: pick() });
    }
  };
  cluster(-160, -2720, 640, 200, 110, 45, 250, 0.55); // CBD
  cluster(-40, -2260, 280, 90, 30, 60, 200, 0.7); // Southbank
  cluster(-860, -2420, 230, 160, 26, 30, 120, 1); // Docklands
  cluster(880, -1000, 80, 640, 16, 30, 95, 2, 16, 28); // Queens Road / St Kilda Road
  cluster(300, -2050, 300, 120, 18, 20, 70, 2); // low-rise in front of the city
  // landmarks
  out.push({ x: -70, z: -2240, w: 38, d: 36, h: 268, color: "#2f3b52" }, { x: -70, z: -2240, w: 37, d: 35, h: 29, color: "#ffc35a", kind: 1 }); // Eureka and its gold crown
  out.push({ x: -170, z: -2215, w: 44, d: 34, h: 317, color: "#5d6474", ry: 0.12 }, { x: -170, z: -2215, w: 44.6, d: 34.6, h: 8, color: "#ffbf55", kind: 2 }); // Australia 108
  out.push({ x: -520, z: -2620, w: 36, d: 30, h: 251, color: "#2b4a78" }, { x: -490, z: -2600, w: 26, d: 24, h: 222, color: "#2b4a78" }); // Rialto
  out.push({ x: 40, z: -2700, w: 30, d: 30, h: 265, color: "#6e7682" }, { x: 0, z: -2675, w: 32, d: 32, h: 260, color: "#55606e" }); // Collins Street
  out.push({ x: -330, z: -2860, w: 30, d: 30, h: 270, color: "#4a5262" });
  out.push({ x: 110, z: -2120, w: 30, d: 30, h: 26, color: "#4a5060" }, { x: 110, z: -2120, w: 2.6, d: 2.6, h: 136, color: "#bcd0ff", kind: 3 }); // the Arts Centre and its lit spire
  return out;
}

const TOWER_VERT = /* glsl */ `
attribute float aKind;
varying vec2 vFacade;
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vTint;
varying float vKind;
varying float vSeed;
void main() {
  vec3 s = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vec3 lp = position * s; // metres in the tower's own frame, base at 0
  vFacade = abs(normal.x) > 0.5 ? vec2(lp.z, lp.y) : vec2(lp.x, lp.y);
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  #ifdef USE_INSTANCING_COLOR
    vTint = instanceColor;
  #else
    vTint = vec3(0.35);
  #endif
  vKind = aKind;
  vSeed = fract(instanceMatrix[3].x * 0.0131 + instanceMatrix[3].z * 0.0071);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const TOWER_FRAG = /* glsl */ `
uniform sampler2D uWin;
uniform vec3 fogColor;
varying vec2 vFacade;
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vTint;
varying float vKind;
varying float vSeed;
${SKY_GLSL}
void main() {
  vec3 n = normalize(vN);
  vec3 toFrag = vWorld - cameraPosition;
  float dist = length(toFrag);
  vec3 dir = toFrag / dist;
  // dusk light: the afterglow on west faces, the sky on everything
  float glow = max(dot(n, uSunDir), 0.0);
  vec3 c = vTint * (0.16 + 0.22 * glow + 0.1 * max(n.y, 0.0)) + uGlow * 0.06 * glow;
  if (vKind > 0.5) {
    c = vTint * (vKind > 1.5 ? 1.4 : 1.1); // lit crowns and the spire
  } else if (abs(n.y) < 0.5) {
    vec4 w = texture2D(uWin, vec2(vFacade.x / 24.0 + vSeed * 7.0, vFacade.y / 28.8 + vSeed * 3.0));
    c = mix(c, w.rgb, w.a * 0.85);
  }
  // aerial perspective: fade into the sky directly behind, more near the ground
  float k = 1.0 - exp(-dist / 1900.0);
  k = mix(k, 1.0, 0.45 * (1.0 - smoothstep(0.0, 160.0, vWorld.y)) * smoothstep(600.0, 2400.0, dist));
  c = mix(c, skyColor(dir, fogColor), clamp(k, 0.0, 0.94));
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function Towers() {
  const list = useMemo(towers, []);
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    g.deleteAttribute("uv");
    return g;
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...skyUniforms(), uWin: { value: windowTexture() } },
        vertexShader: TOWER_VERT,
        fragmentShader: TOWER_FRAG,
        fog: true,
      }),
    []
  );
  useLayoutEffect(() => {
    const m = ref.current!;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    const kinds = new Float32Array(list.length);
    list.forEach((t, i) => {
      // crowns sit on top of their tower
      const base = t.kind === 1 || t.kind === 3 ? list[i - 1].h : t.kind === 2 ? list[i - 1].h * 0.72 : 0;
      o.position.set(t.x, base - 0.3, t.z);
      o.rotation.set(0, t.ry ?? 0, 0);
      o.scale.set(t.w, t.h, t.d);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(t.color));
      kinds[i] = t.kind ?? 0;
    });
    m.geometry.setAttribute("aKind", new THREE.InstancedBufferAttribute(kinds, 1));
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [list]);
  return <instancedMesh ref={ref} args={[geometry, material, list.length]} />;
}

export default function Skyline() {
  return (
    <group>
      <SkyDome />
      <Towers />
    </group>
  );
}
