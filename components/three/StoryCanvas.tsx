"use client";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, SMAA } from "@react-three/postprocessing";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Runner from "./Runner";
import Stadium from "./Stadium";
import { Dust } from "./Effects";
import MicroBone, { MICRO_ORIGIN } from "./MicroBone";
import { story, storyState, srange, range } from "@/lib/story";
import { SLIDE_COUNT, runnerPose, scene } from "@/lib/scene";
import { pointAt, relative } from "@/lib/trackPath";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/* runner-relative camera views: x to her right, y up, z ahead */
const VIEWS = {
  hero: { pos: V(-2.5, 1.1, 3.7), tgt: V(0.7, 0.95, 0) },
  xray: { pos: V(-1.4, 1.1, 2.6), tgt: V(0, 0.92, 0) },
  dive: { pos: V(0.32, 0.98, 0.5), tgt: V(-0.07, 0.92, 0) },
  front: { pos: V(-2.4, 1.3, 3.9), tgt: V(0, 0.95, 0) },
  chase: { pos: V(1.7, 2.1, -5.2), tgt: V(0, 1.0, 2.8) },
  finish: { pos: V(-4.0, 1.4, 4.8), tgt: V(0.3, 0.95, -0.3) },
  satellite: { pos: V(0, 230, -0.4), tgt: V(0, 0, 0.3) },
};
const HAZE = new THREE.Color("#d3dbe6");
const DARK = new THREE.Color("#141416");

function CameraRig() {
  const { camera, scene: three } = useThree();
  const desired = useMemo(() => ({ pos: new THREE.Vector3(), tgt: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);
  const lookAt = useRef(new THREE.Vector3());
  const wasMicro = useRef(false);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    camera.layers.enable(1);
    const st = scene.get();
    const p = pointAt(runnerPose.d);
    const rel = (v: THREE.Vector3, out: THREE.Vector3) => out.fromArray(relative(p, v.x, v.y, v.z));
    const fog = three.fog as THREE.Fog | null;
    let micro = false;
    let snap = false;
    desired.up.set(0, 1, 0);

    if (st.mode === "story") {
      const sp = st.storyP;
      const s = storyState(sp);
      micro = s.micro;
      if (micro) {
        const ang = 0.6 + sp * 2.4;
        const R = 6.4 - 0.7 * s.porosity;
        desired.pos.set(MICRO_ORIGIN.x + Math.cos(ang) * R, MICRO_ORIGIN.y + 0.7 + 0.5 * Math.sin(sp * 9), MICRO_ORIGIN.z + Math.sin(ang) * R);
        desired.tgt.copy(MICRO_ORIGIN);
      } else if (s.finish) {
        // back in colour: swing from a front view round to the chase view used between slides
        const t = srange(sp, 0.865, 1);
        rel(VIEWS.front.pos, a);
        rel(VIEWS.chase.pos, b);
        desired.pos.lerpVectors(a, b, t);
        rel(VIEWS.front.tgt, a);
        rel(VIEWS.chase.tgt, b);
        desired.tgt.lerpVectors(a, b, t);
      } else {
        const t1 = srange(sp, 0.1, 0.28);
        const t2 = s.dive;
        rel(VIEWS.hero.pos, a);
        rel(VIEWS.xray.pos, b);
        desired.pos.lerpVectors(a, b, t1);
        rel(VIEWS.dive.pos, a);
        desired.pos.lerp(a, t2);
        rel(VIEWS.hero.tgt, a);
        rel(VIEWS.xray.tgt, b);
        desired.tgt.lerpVectors(a, b, t1);
        rel(VIEWS.dive.tgt, a);
        desired.tgt.lerp(a, t2);
      }
    } else {
      // trip: street → satellite → street (Google-Maps style), then the slide appears
      const q = st.q;
      const rise = srange(q, 0.0, 0.32);
      const fall = 1 - srange(q, 0.68, 1.0);
      const alt = Math.min(rise, fall);
      const last = st.trip >= SLIDE_COUNT;
      const k = last ? srange(q, 0.6, 0.96) : 0; // final slide lands on the finish-line view
      const street = { pos: a.copy(VIEWS.chase.pos).lerp(VIEWS.finish.pos, k), tgt: b.copy(VIEWS.chase.tgt).lerp(VIEWS.finish.tgt, k) };
      const sat = VIEWS.satellite;
      const e = alt * alt * (3 - 2 * alt);
      const px = street.pos.x + (sat.pos.x - street.pos.x) * e;
      const py = street.pos.y + (sat.pos.y - street.pos.y) * e;
      const pz = street.pos.z + (sat.pos.z - street.pos.z) * e;
      const tx = street.tgt.x + (sat.tgt.x - street.tgt.x) * e;
      const ty = street.tgt.y + (sat.tgt.y - street.tgt.y) * e;
      const tz = street.tgt.z + (sat.tgt.z - street.tgt.z) * e;
      desired.pos.fromArray(relative(p, px, py, pz));
      desired.tgt.fromArray(relative(p, tx, ty, tz));
      fwd.set(p.fx, 0, p.fz);
      desired.up.set(0, 1, 0).lerp(fwd, e).normalize();
    }

    if (fog) {
      fog.color.copy(micro ? DARK : HAZE);
      fog.near = micro ? 3.0 : 260;
      fog.far = micro ? 10.5 : 1700;
    }
    if (micro !== wasMicro.current) snap = true;
    wasMicro.current = micro;

    const k = snap ? 1 : 1 - Math.pow(0.0002, Math.min(dt, 0.25));
    camera.position.lerp(desired.pos, k);
    lookAt.current.lerp(desired.tgt, k);
    camera.up.lerp(desired.up, k).normalize();
    camera.lookAt(lookAt.current);
  });
  return null;
}

class CanvasBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function webglOK() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/* Static-image fallback: crossfades pre-rendered frames by story progress. */
export function StaticFallback() {
  const refs = useRef<(HTMLImageElement | null)[]>([]);
  useEffect(
    () =>
      story.subscribe((p) => {
        const s = storyState(p);
        const o = [s.finish ? 0 : 1 - s.xray, s.finish || s.micro ? 0 : s.xray, s.micro ? 1 : 0, s.finish ? 1 : 0];
        refs.current.forEach((el, i) => el && (el.style.opacity = String(o[i])));
      }),
    []
  );
  const frames = ["hero", "xray", "micro", "finish"];
  return (
    <div className="absolute inset-0 bg-ink">
      {frames.map((f, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={f}
          ref={(el) => {
            refs.current[i] = el;
          }}
          src={`/fallback/${f}.jpg`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: i === 0 ? 1 : 0, transition: "opacity 0.3s linear" }}
        />
      ))}
    </div>
  );
}

export default function StoryCanvas() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => setOk(webglOK()), []);
  if (ok === null) return <div className="absolute inset-0 bg-ink" />;
  if (!ok) return <StaticFallback />;
  return (
    <CanvasBoundary fallback={<StaticFallback />}>
      <div className="absolute inset-0">
        <Canvas
          dpr={[1, 1.5]}
          shadows={{ type: THREE.PCFSoftShadowMap }}
          camera={{ fov: 34, near: 0.2, far: 3000, position: [0, 1.3, 4.3] }}
          gl={{ antialias: false, powerPreference: "high-performance", stencil: false, logarithmicDepthBuffer: true }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.8;
          }}
        >
          <fog attach="fog" args={["#d3dbe6", 260, 1700]} />
          <CameraRig />
          <Suspense fallback={null}>
            <Environment resolution={128} frames={1}>
              <Lightformer intensity={1.6} color="#dfeaff" position={[0, 40, 0]} rotation-x={Math.PI / 2} scale={[100, 100, 1]} />
              <Lightformer intensity={3} color="#fff1d6" position={[30, 40, -40]} scale={[18, 18, 1]} />
              <Lightformer intensity={0.5} color="#7f8a66" position={[0, -10, 0]} rotation-x={-Math.PI / 2} scale={[100, 100, 1]} />
            </Environment>
            <Stadium />
            <Dust />
            <Runner />
            <MicroBone />
          </Suspense>
          <EffectComposer multisampling={0}>
            <SMAA />
            <Bloom intensity={0.45} luminanceThreshold={0.9} luminanceSmoothing={0.2} mipmapBlur />
          </EffectComposer>
        </Canvas>
      </div>
    </CanvasBoundary>
  );
}
