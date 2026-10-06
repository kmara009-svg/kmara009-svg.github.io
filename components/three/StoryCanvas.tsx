"use client";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom, SMAA } from "@react-three/postprocessing";
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Runner from "./Runner";
import Track, { Dust } from "./Track";
import MicroBone, { MICRO_ORIGIN } from "./MicroBone";
import { story, storyState, srange } from "@/lib/story";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const KEY = {
  hero: { pos: V(1.9, 1.3, 4.3), tgt: V(-0.5, 0.95, 0) },
  xray: { pos: V(1.45, 1.15, 2.7), tgt: V(0, 1.0, 0) },
  dive: { pos: V(0.42, 1.02, 0.5), tgt: V(0.07, 0.97, 0) },
  finishA: { pos: V(3.6, 0.85, 2.6), tgt: V(0, 0.95, -0.6) },
  finishB: { pos: V(3.3, 1.05, 3.1), tgt: V(-0.2, 0.9, -0.1) },
};

function CameraRig() {
  const { camera } = useThree();
  const desired = useMemo(() => ({ pos: KEY.hero.pos.clone(), tgt: KEY.hero.tgt.clone() }), []);
  const lookAt = useRef(KEY.hero.tgt.clone());
  const wasMicro = useRef(false);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const p = story.get();
    const s = storyState(p);
    let snap = false;
    if (s.micro) {
      const a = 0.6 + p * 2.4;
      const R = 4.6 - 0.9 * s.porosity;
      desired.pos.set(MICRO_ORIGIN.x + Math.cos(a) * R, MICRO_ORIGIN.y + 0.9 + 0.4 * Math.sin(p * 9), MICRO_ORIGIN.z + Math.sin(a) * R);
      desired.tgt.copy(MICRO_ORIGIN);
      if (!wasMicro.current) snap = true;
    } else if (s.finish) {
      desired.pos.lerpVectors(KEY.finishA.pos, KEY.finishB.pos, s.finishLine);
      desired.tgt.lerpVectors(KEY.finishA.tgt, KEY.finishB.tgt, s.finishLine);
      if (wasMicro.current) snap = true;
    } else {
      const t1 = srange(p, 0.1, 0.28);
      const t2 = s.dive;
      desired.pos.lerpVectors(KEY.hero.pos, KEY.xray.pos, t1).lerp(KEY.dive.pos, t2);
      desired.tgt.lerpVectors(KEY.hero.tgt, KEY.xray.tgt, t1).lerp(KEY.dive.tgt, t2);
      if (wasMicro.current) snap = true;
    }
    wasMicro.current = s.micro;
    const k = snap ? 1 : 1 - Math.pow(0.0005, Math.min(dt, 0.05));
    camera.position.lerp(desired.pos, k);
    lookAt.current.lerp(desired.tgt, k);
    camera.lookAt(tmp.copy(lookAt.current));
  });
  return null;
}

function Lights() {
  return (
    <>
      <hemisphereLight args={["#dfe9ff", "#3a1b14", 0.55]} />
      <directionalLight position={[3, 6, 4]} intensity={2.6} color="#fff3df" />
      <directionalLight position={[-4, 3, -5]} intensity={2.4} color="#c6f432" />
      <pointLight position={[-2, 0.4, 2.5]} intensity={6} color="#c6f432" distance={8} />
      <pointLight position={[0, 6, -14]} intensity={60} color="#ffffff" distance={40} />
      <pointLight position={[8, 7, -6]} intensity={40} color="#dcefff" distance={40} />
    </>
  );
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

/* Static-image fallback: crossfades pre-rendered frames by scroll progress. */
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

export default function StoryCanvas({ active }: { active: boolean }) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => setOk(webglOK()), []);
  if (ok === null) return <div className="absolute inset-0 bg-ink" />;
  if (!ok) return <StaticFallback />;
  return (
    <CanvasBoundary fallback={<StaticFallback />}>
      <div className="absolute inset-0">
        <Canvas
          dpr={[1, 1.5]}
          frameloop={active ? "always" : "never"}
          camera={{ fov: 34, near: 0.05, far: 120, position: [1.9, 1.3, 4.3] }}
          gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
          }}
        >
          <color attach="background" args={["#141416"]} />
          <fog attach="fog" args={["#141416", 9, 34]} />
          <Lights />
          <CameraRig />
          <Track />
          <Dust />
          <Runner />
          <MicroBone />
          <EffectComposer multisampling={0}>
            <SMAA />
            <Bloom intensity={0.75} luminanceThreshold={0.62} luminanceSmoothing={0.25} mipmapBlur />
          </EffectComposer>
        </Canvas>
      </div>
    </CanvasBoundary>
  );
}
