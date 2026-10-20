"use client";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { CLIPS, MODEL } from "./Runner";
import { FINISH_CROSS_Q, FINISH_SETTLE, RIVALS, finishRun, hasFinished, laneSpot, rivalTarget } from "@/lib/race";
import { storyD, tripPose, tripU } from "@/lib/runnerPath";
import { FINISH_INDEX, scene } from "@/lib/scene";
import { range, srange, storyState } from "@/lib/story";

/* Her four rivals: the same rigged model (a lighter copy, public/models/rival.glb) in her
   materials, and the same mocap run, walk and idle clips, each with her own skin tone, hair
   colour, kit and headband, recoloured in the shader from her textures with a kit mask
   (public/models/rival-kit.png; both made by scripts/model/rival-lod.mjs). Each runs in her own
   lane where lib/race puts her, and is skipped entirely when out of view. */
const RIVAL_MODEL = "/models/rival.glb";
const KIT_MASK = "/models/rival-kit.png";
useGLTF.preload(RIVAL_MODEL);

type Look = { skin: string; hair: string | null; top: string; shorts: string; shoes: string; band: number; height: number };
const LOOKS: Look[] = [
  { skin: "#eec8ad", hair: "#d8ae62", top: "#d62839", shorts: "#1c2950", shoes: "#f2f2f2", band: 3.2, height: 1.02 }, // lane 2: fair, blonde, red kit, blue band
  { skin: "#c99a73", hair: null, top: "#12a0a6", shorts: "#151515", shoes: "#ff7a1a", band: 1.7, height: 0.97 }, // lane 3: olive, black hair, teal kit, green band
  { skin: "#4a2f20", hair: null, top: "#f5c518", shorts: "#1f4d2e", shoes: "#f4f4f4", band: -1.6, height: 1.0 }, // lane 4: deep brown, yellow and green kit, magenta band
  { skin: "#e4b598", hair: "#9a4628", top: "#6b3fa0", shorts: "#141414", shoes: "#ff5fa2", band: 2.4, height: 0.99 }, // lane 5: light, auburn, purple kit, teal band
];
const SKIN_LUMA = 0.0605; // linear luminance of her painted skin tone (#613d26), the reference for every recolour

// the kit mask: skin red, top green, shorts blue, the shoes' accents white (all three, so a
// filtered blend of any two still splits cleanly)
const BODY_GLSL = /* glsl */ `
{
  vec3 km = texture2D(uKit, vMapUv).rgb;
  float accent = min(km.r, min(km.g, km.b));
  km -= accent;
  vec3 c = diffuseColor.rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(c, uSkin * (l / ${SKIN_LUMA}), km.r);
  c = mix(c, uTop * min(l / 0.7, 1.15), km.g);
  c = mix(c, uShorts * clamp(l / 0.012, 0.5, 1.8), km.b);
  c = mix(c, uShoes * min(l / 0.6, 1.2), accent);
  diffuseColor.rgb = c;
}`;
// the face texture: only texels close to her painted skin tone, so eyes, brows, lashes and lips stay
const FACE_GLSL = /* glsl */ `
{
  vec3 c = diffuseColor.rgb;
  float w = 1.0 - smoothstep(0.05, 0.13, distance(sqrt(max(c, 0.0)), vec3(0.346, 0.216, 0.138)));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  diffuseColor.rgb = mix(c, uSkin * (l / ${SKIN_LUMA}), w);
}`;
const HAIR_GLSL = /* glsl */ `
{
  float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  diffuseColor.rgb = mix(diffuseColor.rgb, uHair * (0.45 + 0.55 * clamp(l / 0.006, 0.0, 2.2)), uHairMix);
}`;
// turn the wax-print colours round the grey axis
const BAND_GLSL = /* glsl */ `
{
  vec3 k = vec3(0.57735);
  vec3 c = diffuseColor.rgb;
  float ca = cos(uHue), sa = sin(uHue);
  diffuseColor.rgb = max(c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca), 0.0);
}`;

function recolour(m: THREE.MeshStandardMaterial, kind: string, look: Look, kit: THREE.Texture) {
  const u: Record<string, THREE.IUniform> = {
    uKit: { value: kit },
    uSkin: { value: new THREE.Color(look.skin) },
    uTop: { value: new THREE.Color(look.top) },
    uShorts: { value: new THREE.Color(look.shorts) },
    uShoes: { value: new THREE.Color(look.shoes) },
    uHair: { value: new THREE.Color(look.hair ?? "#000000") },
    uHairMix: { value: look.hair ? 1 : 0 },
    uHue: { value: look.band },
  };
  const glsl = kind === "body" ? BODY_GLSL : kind === "face" ? FACE_GLSL : kind === "hair" ? HAIR_GLSL : BAND_GLSL;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D uKit;\nuniform vec3 uSkin, uTop, uShorts, uShoes, uHair;\nuniform float uHairMix, uHue;")
      .replace("#include <map_fragment>", `#include <map_fragment>\n${glsl}`);
  };
  m.customProgramCacheKey = () => `rival-${kind}`;
}

type Rival = {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: { run: THREE.AnimationAction; walk: THREE.AnimationAction; idle: THREE.AnimationAction } | null;
  pose: { x: number; z: number; h: number; gap: number; speed: number; back: number; wr: number; ww: number; wi: number; init: boolean };
};

export default function Rivals() {
  const runner = useGLTF(MODEL);
  const gltf = useGLTF(RIVAL_MODEL);
  const clipTexts = useLoader(THREE.FileLoader, CLIPS) as unknown as string[];
  const clips = useMemo(() => clipTexts.map((t) => THREE.AnimationClip.parse(JSON.parse(t))), [clipTexts]);
  const kitTex = useLoader(THREE.TextureLoader, KIT_MASK);

  const rivals = useMemo<Rival[]>(() => {
    const dress = runner.materials as Record<string, THREE.MeshStandardMaterial>;
    const kit = kitTex;
    kit.flipY = false; // glTF texture orientation, like the body texture it maps onto
    kit.needsUpdate = true;
    return LOOKS.map((look) => {
      const model = SkeletonUtils.clone(gltf.scene) as THREE.Group;
      const skinned: THREE.SkinnedMesh[] = [];
      model.traverse((o) => {
        const mesh = o as THREE.SkinnedMesh;
        if (!mesh.isSkinnedMesh) return;
        skinned.push(mesh);
        mesh.frustumCulled = false; // culled as a whole below, by her position
        const src = dress[(mesh.material as THREE.Material).name] ?? (mesh.material as THREE.MeshStandardMaterial);
        const m = src.clone();
        if (!/gold/i.test(src.name)) m.metalness = Math.min(m.metalness, 0.25);
        m.envMapIntensity = 0.9;
        const kind = src.name === "Ch03_Body" ? "body" : src.name === "Face" ? "face" : src.name === "Hair" ? "hair" : src.name === "Headband" ? "band" : "";
        if (kind) recolour(m, kind, look, kit);
        mesh.material = m;
        mesh.castShadow = !/gold/i.test(src.name); // as hers: all but the studs, which are far smaller than a shadow texel
      });
      for (const m of skinned.slice(1)) m.bind(skinned[0].skeleton, m.bindMatrix);
      model.scale.setScalar(look.height);
      const root = new THREE.Group();
      root.add(model);
      root.visible = false; // until the first frame has placed her
      return { root, mixer: new THREE.AnimationMixer(model), actions: null, pose: { x: 0, z: 0, h: 0, gap: 0, speed: 0, back: 0, wr: 1, ww: 0, wi: 0, init: false } };
    });
  }, [gltf, runner, kitTex]);

  useEffect(() => {
    rivals.forEach((rv, r) => {
      const [run, walk, idle] = clips.map((c) => rv.mixer.clipAction(c));
      for (const a of [run, walk, idle]) {
        a.play();
        a.setEffectiveWeight(0);
      }
      run.setEffectiveWeight(1);
      run.time = (r * 0.29 + 0.11) % run.getClip().duration; // out of step with her and with each other
      rv.actions = { run, walk, idle };
    });
    return () => rivals.forEach((rv) => rv.mixer.stopAllAction());
  }, [rivals, clips]);

  const finishT = useRef(0); // seconds since she crossed the line
  const frustum = useMemo(() => new THREE.Frustum(), []);
  const pm = useMemo(() => new THREE.Matrix4(), []);
  const sphere = useMemo(() => new THREE.Sphere(new THREE.Vector3(), 2.4), []);
  const QA = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("qa") === "1";

  useFrame(({ camera }, dt) => {
    const st = scene.get();
    const micro = st.mode === "story" && storyState(st.storyP).micro;
    const dd = Math.min(dt, 0.1);
    // the run-in clock: real time once she has crossed, but on the finish slide never further on than
    // the scroll is past the line, so stepping back winds it back while she still stands on the line
    // and the rivals are behind her again when she leaves it
    const cap = st.mode === "trip" && st.trip === FINISH_INDEX ? FINISH_SETTLE * range(st.q, FINISH_CROSS_Q, 1) : FINISH_SETTLE;
    finishT.current = hasFinished(st) ? Math.min(finishT.current + dd, cap) : 0;
    const herD = st.mode === "story" ? storyD(st.storyP) : tripPose(st.trip, tripU(st.trip, st.q)).d;
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const cam = camera.position;
    const qa: { x: number; z: number; d: number; visible: boolean; near: number }[] = [];

    rivals.forEach((rv, r) => {
      const plan = RIVALS[r];
      const tg = rivalTarget(r, st);
      const ps = rv.pose;
      let d = tg.d + finishRun(r, finishT.current);
      // a planned change of place relative to her (lib/race moves a rival while the camera is on a
      // sign; the story hands over under the bone section) is taken in one step, but only once she
      // is out of view, so a camera still catching up never sees her vanish; until then she keeps
      // her gap. Anything else is smoothed exactly like her, however fast the deck moves.
      let snap = !ps.init;
      if (ps.init && Math.abs(d - herD - ps.gap) > 7) {
        if (rv.root.visible) d = herD + ps.gap;
        else snap = true;
      }
      ps.gap = d - herD;
      const spot = laneSpot(d, plan.lane);
      if (snap) {
        ps.x = spot.x;
        ps.z = spot.z;
        ps.h = spot.heading;
        ps.speed = 0;
        ps.init = true;
      }
      const k = 1 - Math.exp(-dd / 0.07);
      const px = ps.x, pz = ps.z;
      ps.x += (spot.x - ps.x) * k;
      ps.z += (spot.z - ps.z) * k;
      let dh = spot.heading - ps.h;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      ps.h += dh * k;
      const inst = dd > 0 ? Math.min(Math.hypot(ps.x - px, ps.z - pz) / dd, 14) : 0;
      ps.speed += (inst - ps.speed) * (1 - Math.exp(-dd / 0.12));
      const along = (ps.x - px) * Math.sin(ps.h) + (ps.z - pz) * Math.cos(ps.h);
      ps.back += ((dd > 0 && along / dd < -0.4 ? 1 : 0) - ps.back) * (1 - Math.exp(-dd / 0.1));

      // out of the story's bone section, in view, and never so close that the camera would pass through her
      sphere.center.set(ps.x, 0.9, ps.z);
      const dy = cam.y - Math.min(Math.max(cam.y, 0.1), 1.75);
      const near = Math.hypot(cam.x - ps.x, cam.z - ps.z, dy);
      const visible = !micro && near > 1.2 && frustum.intersectsSphere(sphere);
      rv.root.visible = visible;
      if (QA) qa.push({ x: ps.x, z: ps.z, d, visible, near });
      if (!visible) return;
      rv.root.position.set(ps.x, 0, ps.z);
      rv.root.rotation.y = ps.h;

      const a = rv.actions;
      if (a) {
        const v = ps.speed;
        let wr: number, ww: number, wi: number;
        if (tg.treadmill) {
          wr = 1;
          ww = wi = 0;
        } else {
          wr = srange(v, 1.3, 2.6);
          wi = 1 - srange(v, 0.08, 0.7);
          ww = (1 - wi) * (1 - wr);
        }
        const kw = 1 - Math.exp(-dd / 0.18);
        ps.wr += (wr - ps.wr) * kw;
        ps.ww += (ww - ps.ww) * kw;
        ps.wi += (wi - ps.wi) * kw;
        a.run.setEffectiveWeight(ps.wr);
        a.walk.setEffectiveWeight(ps.ww);
        a.idle.setEffectiveWeight(ps.wi);
        const sprint = st.mode === "trip" && st.trip === FINISH_INDEX ? 0.3 : 0;
        const dir = 1 - 2 * ps.back;
        a.run.setEffectiveTimeScale(dir * Math.max(0.85, Math.min(3.7, v / 3.4 + sprint)));
        a.walk.setEffectiveTimeScale(dir * Math.max(0.7, Math.min(1.8, v / 1.3)));
      }
      rv.mixer.update(dd);
    });
    if (QA) (window as unknown as Record<string, unknown>).__rivals = qa;
  });

  return (
    <group>
      {rivals.map((rv, i) => (
        <primitive key={i} object={rv.root} />
      ))}
    </group>
  );
}
