"use client";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Runner from "./Runner";
import Rivals from "./Rivals";
import Coach from "./Coach";
import Stadium from "./Stadium";
import Park from "./Park";
import Skyline from "./Skyline";
import { HAZE as HAZE_HEX } from "./dusk";
import Billboards from "./Billboards";
import { Dust } from "./Effects";
import MicroBone, { MICRO_ORIGIN } from "./MicroBone";
import { story, storyState, srange, range } from "@/lib/story";
import { CEREMONY, FINISH_INDEX, SLIDE_COUNT, TRIP_CAM, cover, dropRefsHold, runnerPose, scene, tripQ } from "@/lib/scene";
import { CEREMONY_VIEW, LEAVE } from "@/lib/ceremony";
import { pointAt, relative } from "@/lib/trackPath";
import { SIGN_FACE, signCorners, signPose } from "@/lib/signs";
import { apply as applySlides, type Quad } from "@/lib/slideLayer";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/* runner-relative camera views: x to her right, y up, z ahead */
const VIEWS = {
  hero: { pos: V(-2.5, 1.1, 3.7), tgt: V(0.7, 0.95, 0) },
  xray: { pos: V(-1.4, 1.1, 2.6), tgt: V(0, 0.92, 0) },
  dive: { pos: V(0.32, 0.98, 0.5), tgt: V(-0.07, 0.92, 0) },
  front: { pos: V(-2.4, 1.3, 3.9), tgt: V(0, 0.95, 0) },
  chase: { pos: V(1.7, 2.1, -5.2), tgt: V(0, 1.0, 2.8) },
  finish: { pos: V(-4.0, 1.4, 4.8), tgt: V(0.3, 0.95, -0.3) },
  finishClose: { pos: V(-2.6, 1.15, 3.2), tgt: V(0.2, 0.95, -0.2) },
  wide: { pos: V(2.6, 2.9, -7.8), tgt: V(0, 1.0, 3.2) }, // pulled back while she runs between slides
};
/* opening view: high over the home straight, the whole oval in frame to the right of the titles */
const AERIAL = { pos: V(-20, 185, 120), tgt: V(0, 0, -8) };
const HAZE = new THREE.Color(HAZE_HEX);
/* ?qa=1: per-frame hooks for automated motion checks */
const QA = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("qa") === "1";
const DARK = new THREE.Color("#141416");

/* a runner-relative point on an orbit round her from view A to view B (the shorter way round),
   radius and height eased across, so a swing from behind her to in front never cuts through her */
function orbitRel(A: THREE.Vector3, B: THREE.Vector3, t: number, out: THREE.Vector3) {
  const a0 = Math.atan2(A.x, A.z);
  let a1 = Math.atan2(B.x, B.z);
  if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
  if (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
  const ang = a0 + (a1 - a0) * t;
  const r0 = Math.hypot(A.x, A.z), r = r0 + (Math.hypot(B.x, B.z) - r0) * t;
  return out.set(Math.sin(ang) * r, A.y + (B.y - A.y) * t, Math.cos(ang) * r);
}

function CameraRig() {
  const { camera, scene: three, size } = useThree();
  const desired = useMemo(() => ({ pos: new THREE.Vector3(), tgt: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);
  const lookAt = useRef(new THREE.Vector3());
  const wasMicro = useRef(false);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const rel3 = useMemo(() => new THREE.Vector3(), []);
  const c = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    camera.layers.enable(1);
    // a further near plane while high over the stadium keeps depth precise enough that the track and infield never flicker
    const cam = camera as THREE.PerspectiveCamera;
    const near = cam.position.y > 25 ? 1.2 : 0.3;
    if (cam.near !== near) {
      cam.near = near;
      cam.updateProjectionMatrix();
    }
    const st = scene.get();
    // her position with the track direction at her distance, so chase views stay steady while she turns
    const tp = pointAt(runnerPose.d);
    const p = { x: runnerPose.x, z: runnerPose.z, fx: tp.fx, fz: tp.fz };
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
        // drift gently in front of the bone section, easing closer as the pores open
        const u = (sp - 0.43) / (0.865 - 0.43);
        const ang = -0.28 + u * 0.56;
        const R = 14 - 1.2 * s.porosity;
        desired.pos.set(MICRO_ORIGIN.x + Math.sin(ang) * R - 0.9, MICRO_ORIGIN.y + 0.3 + 0.35 * Math.sin(sp * 7), MICRO_ORIGIN.z + Math.cos(ang) * R);
        desired.tgt.set(MICRO_ORIGIN.x - 0.9, MICRO_ORIGIN.y + 0.15, MICRO_ORIGIN.z);
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
        // bird's eye over the whole track with the titles, descending onto her as they fade, then the X-ray
        const t0 = srange(sp, 0.06, 0.18);
        const t1 = srange(sp, 0.18, 0.28);
        const t2 = s.dive;
        rel(VIEWS.hero.pos, a);
        desired.pos.copy(AERIAL.pos).lerp(a, t0);
        rel(VIEWS.xray.pos, b);
        desired.pos.lerp(b, t1);
        rel(VIEWS.dive.pos, a);
        desired.pos.lerp(a, t2);
        rel(VIEWS.hero.tgt, a);
        desired.tgt.copy(AERIAL.tgt).lerp(a, t0);
        rel(VIEWS.xray.tgt, b);
        desired.tgt.lerp(b, t1);
        rel(VIEWS.dive.tgt, a);
        desired.tgt.lerp(a, t2);
      }
    } else {
      // trip (lib/scene TRIP_CAM): back straight off the previous sign while its slide settles onto
      // it, swing round behind her as she sets off, chase (widening mid-run), swing onto this
      // slide's sign as she halts, then close in until the sign exactly fills the stage, where
      // the slide grows out of it. Every phase is a function of q, so the move is continuous
      // from the first frame of the key press and runs backwards just as well. (The references
      // trip holds at the end of the approach while the coach hangs the medal on her: tripQ.)
      const i = st.trip;
      const q = tripQ(i, st.q);
      const last = i === FINISH_INDEX;
      const prevFinish = i - 1 === FINISH_INDEX;
      const C = TRIP_CAM;
      // no pull-back on the short run off the finish line: the wide view would rise into the
      // FINISH board (2.8-3.4 m up) just as the camera passes under it
      const pull = prevFinish ? 0 : Math.min(srange(q, C.pullOut[0], C.pullOut[1]), 1 - srange(q, C.pullIn[0], C.pullIn[1]));
      // chase view with the pull-back
      const w = VIEWS.wide;
      desired.pos.fromArray(relative(p, VIEWS.chase.pos.x + (w.pos.x - VIEWS.chase.pos.x) * pull, VIEWS.chase.pos.y + (w.pos.y - VIEWS.chase.pos.y) * pull, VIEWS.chase.pos.z + (w.pos.z - VIEWS.chase.pos.z) * pull));
      desired.tgt.fromArray(relative(p, VIEWS.chase.tgt.x + (w.tgt.x - VIEWS.chase.tgt.x) * pull, VIEWS.chase.tgt.y + (w.tgt.y - VIEWS.chase.tgt.y) * pull, VIEWS.chase.tgt.z + (w.tgt.z - VIEWS.chase.tgt.z) * pull));
      // sign views (world space). "fit": square on, at the distance where the face exactly covers
      // the 1920x1080 stage as laid out on this screen, so the slide can sit on it edge to edge
      const stageScale = Math.min(size.width / 1920, size.height / 1080);
      const fitDist = (SIGN_FACE.h * size.height) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * 1080 * stageScale);
      const signView = (n: number, fit: boolean, pos: THREE.Vector3, tgt: THREE.Vector3) => {
        const sp = signPose(n);
        const dist = fit ? fitDist : 7.5;
        pos.set(sp.x + sp.nx * dist, fit ? SIGN_FACE.y : 2.1, sp.z + sp.nz * dist);
        tgt.set(sp.x, SIGN_FACE.y, sp.z);
      };
      if (i > 1) {
        const swing = 1 - srange(q, prevFinish ? 0 : C.swing[0], C.swing[1]);
        if (swing > 0) {
          if (prevFinish) {
            // off the finish line: orbit round her (via her left, the infield side) from the close
            // front view to the chase, rather than cutting straight through where she stands
            const pl = rel3.copy(VIEWS.chase.pos).lerp(VIEWS.wide.pos, pull);
            orbitRel(VIEWS.finishClose.pos, pl, 1 - swing, a);
            desired.pos.fromArray(relative(p, a.x, a.y, a.z));
            b.fromArray(relative(p, VIEWS.finishClose.tgt.x, VIEWS.finishClose.tgt.y, VIEWS.finishClose.tgt.z));
            desired.tgt.lerp(b, swing);
          } else {
            signView(i - 1, false, a, b);
            desired.pos.lerp(a, swing);
            desired.tgt.lerp(b, swing);
            const back = 1 - srange(q, C.back[0], C.back[1]);
            if (back > 0) {
              signView(i - 1, true, a, b);
              desired.pos.lerp(a, back);
              desired.tgt.lerp(b, back);
            }
          }
        }
      }
      // onto the finish line the swing is an orbit round her, so it gets a longer, gentler window
      const approach = last ? srange(q, 0.54, 0.86) : srange(q, C.approach[0], C.approach[1]);
      const zoomIn = srange(q, C.zoom[0], C.zoom[1]);
      if (approach > 0) {
        if (last) {
          // onto the finish line: orbit round her left from the chase to the front view
          const pl = rel3.copy(VIEWS.chase.pos).lerp(VIEWS.wide.pos, pull);
          orbitRel(pl, VIEWS.finish.pos, approach, a);
          desired.pos.fromArray(relative(p, a.x, a.y, a.z));
          b.fromArray(relative(p, VIEWS.finish.tgt.x, VIEWS.finish.tgt.y, VIEWS.finish.tgt.z));
          desired.tgt.lerp(b, approach);
          a.fromArray(relative(p, VIEWS.finishClose.pos.x, VIEWS.finishClose.pos.y, VIEWS.finishClose.pos.z));
          b.fromArray(relative(p, VIEWS.finishClose.tgt.x, VIEWS.finishClose.tgt.y, VIEWS.finishClose.tgt.z));
          desired.pos.lerp(a, zoomIn);
          desired.tgt.lerp(b, zoomIn);
        } else {
          if (i >= SLIDE_COUNT) {
            // the references sign: onto the coach and her beside it, easing in a little while he
            // hangs the medal on her, then away to the sign
            const t = srange(st.q, CEREMONY[0], CEREMONY[1]);
            const { pos: cp, tgt: ct } = CEREMONY_VIEW;
            b.set(ct.x, ct.y, ct.z);
            a.set(cp.x, cp.y, cp.z).lerp(b, 0.12 * t);
            const away = srange(st.q, LEAVE[0], LEAVE[1]);
            if (away > 0) {
              signView(i, false, rel3, c);
              a.lerp(rel3, away);
              b.lerp(c, away);
            }
          } else signView(i, false, a, b);
          desired.pos.lerp(a, approach);
          desired.tgt.lerp(b, approach);
          signView(i, true, a, b);
          desired.pos.lerp(a, zoomIn);
          desired.tgt.lerp(b, zoomIn);
        }
      }
    }

    if (fog) {
      fog.color.copy(micro ? DARK : HAZE);
      fog.near = micro ? 9 : 220;
      fog.far = micro ? 30 : 2100;
    }
    if (micro !== wasMicro.current) snap = true;
    wasMicro.current = micro;

    // gentle follow, so camera moves never look rushed (QA can pin it to the path with window.__camSnap)
    const k = snap || (QA && (window as unknown as { __camSnap?: boolean }).__camSnap) ? 1 : 1 - Math.pow(0.012, Math.min(dt, 0.25));
    camera.position.lerp(desired.pos, k);
    lookAt.current.lerp(desired.tgt, k);
    camera.up.lerp(desired.up, k).normalize();
    camera.lookAt(lookAt.current);
    if (QA) {
      const w = window as unknown as Record<string, unknown>;
      Object.assign(w, { __cam: camera, __desired: desired, __lookAt: lookAt.current, __runner: runnerPose });
      (w.__onFrame as ((dt: number, k: number) => void) | undefined)?.(dt, k);
    }
  });
  return null;
}

/* Keeps every visible slide glued to its billboard: projects each sign's face with the camera of
   this very frame (after CameraRig has moved it) and hands the quads to the slide layer. */
const SIGN_CORNERS = new Map<number, THREE.Vector3[]>();
for (let i = 1; i <= SLIDE_COUNT; i++) if (i !== FINISH_INDEX) SIGN_CORNERS.set(i, signCorners(i).map(([x, y, z]) => new THREE.Vector3(x, y, z)));
/* while a slide's opaque stage covers the scene at rest there is nothing to draw: stop the render loop
   (the last frame stays up behind any letterbox bars) and start it again the moment the page moves.
   A resize clears the canvas, so it draws a few frames again first. */
function HoldWhenCovered() {
  const setFrameloop = useThree((s) => s.setFrameloop);
  useEffect(() => {
    let t: number | undefined;
    const off = cover.subscribe((c) => {
      window.clearTimeout(t);
      setFrameloop(c ? "never" : "always");
    });
    const onResize = () => {
      if (!cover.get()) return;
      setFrameloop("always");
      window.clearTimeout(t);
      t = window.setTimeout(() => cover.get() && setFrameloop("never"), 400);
    };
    window.addEventListener("resize", onResize);
    return () => {
      off();
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
      setFrameloop("always");
    };
  }, [setFrameloop]);
  return null;
}

function SlideGlue() {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    camera.updateMatrixWorld();
    const quadOf = (i: number): Quad | null => {
      const cs = SIGN_CORNERS.get(i);
      if (!cs) return null;
      const out: Quad = [];
      for (const c of cs) {
        v.copy(c).applyMatrix4(camera.matrixWorldInverse);
        if (v.z > -0.05) return null; // behind the camera: nothing to land on
        v.applyMatrix4(camera.projectionMatrix);
        out.push([((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height]);
      }
      return out;
    };
    applySlides(quadOf, { w: size.width, h: size.height });
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
  useEffect(dropRefsHold, []); // no ceremony to hold the last trip for
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
          dpr={1}
          shadows={{ type: THREE.PCFShadowMap }}
          camera={{ fov: 34, near: 0.3, far: 4200, position: [0, 1.3, 4.3] }}
          gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.8;
            if (QA) {
              // window.__norender skips the GPU work, so motion can be traced at full frame rate on software GL
              const w = window as unknown as Record<string, unknown>;
              const render = gl.render.bind(gl), clear = gl.clear.bind(gl);
              gl.render = (sc, cam) => {
                w.__renders = ((w.__renders as number) || 0) + 1;
                if (!w.__norender) render(sc, cam);
              };
              gl.clear = (c, d, st) => void (!w.__norender && clear(c, d, st));
            }
          }}
        >
          <fog attach="fog" args={[HAZE_HEX, 220, 2100]} />
          <CameraRig />
          <SlideGlue />
          <HoldWhenCovered />
          <Suspense fallback={null}>
            <Environment resolution={128} frames={1}>
              {/* dusk: a lavender sky, the afterglow low in the west, a floodlight bank, dark ground */}
              <Lightformer intensity={1.3} color="#c9c2f2" position={[0, 40, 0]} rotation-x={Math.PI / 2} scale={[100, 100, 1]} />
              <Lightformer intensity={1.6} color="#ffb48a" position={[-60, 8, 15]} rotation-y={Math.PI / 2} scale={[80, 14, 1]} />
              <Lightformer intensity={3} color="#f4f2ff" position={[30, 40, -40]} scale={[18, 18, 1]} />
              <Lightformer intensity={0.4} color="#4f5640" position={[0, -10, 0]} rotation-x={-Math.PI / 2} scale={[100, 100, 1]} />
            </Environment>
            <Stadium />
            <Park />
            <Skyline />
            <Billboards />
            <Dust />
            <Runner />
            <Rivals />
            <Coach />
            <MicroBone />
          </Suspense>
          <EffectComposer multisampling={2}>
            <Bloom intensity={0.45} luminanceThreshold={0.9} luminanceSmoothing={0.2} mipmapBlur />
          </EffectComposer>
        </Canvas>
      </div>
    </CanvasBoundary>
  );
}
