"use client";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { CLIPS, MODEL, herRig } from "./Runner";
import { COACH_SPOT, lerpAngle } from "@/lib/runnerPath";
import { CEREMONY_LIGHT, COACH_TURN, MEDAL, ceremonyK } from "@/lib/ceremony";
import { FINISH_INDEX, SLIDE_COUNT, scene } from "@/lib/scene";
import { range, srange, storyState } from "@/lib/story";

/* The coach, waiting beside the references sign with her medal (public/models/coach.glb, made from
   her model by scripts/model/coach.mjs, so the same rig and mocap idle drive him). He is dressed in
   her materials, recoloured in the shader from bind-pose positions: a navy gingham shirt, dark
   trousers and belt, brown shoes, his own skin tone and dark brown hair, faded short at the sides.
   When she halts at him, his arms are driven by a two-bone IK on top of the idle clip:
   up over her head with the ribbon held open, down onto her shoulders, then back to his sides.
   The ribbon is a strip rebuilt each frame through six points, which slide from his hands to
   points on her rig as it settles on her. Every step is a function of the scroll (lib/ceremony). */
const COACH_MODEL = "/models/coach.glb";
useGLTF.preload(COACH_MODEL);

const SCALE = 1.1; // he is a head taller than her
const SKIN = "#c39274"; // as his face texture (coach-face.mjs COACH_SKIN)
const SKIN_LUMA = 0.0605; // her painted skin tone's linear luminance, which the body texture's skin is recoloured from
// where the shirt meets his neck, round the back and dipping into an open V at the front (as coach.mjs lays the collar)
const NECK = { y: 1.352, v: 0.045, zc: -0.004 };

const BODY_VERT = /* glsl */ `
#include <common>
varying vec3 vRest;
varying vec3 vRestN;`;
const BODY_GLSL = /* glsl */ `
{
  vec3 p = vRest;
  float ax = abs(p.x);
  float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 skin = uSkin * (l / ${SKIN_LUMA});
  // gingham: two sets of navy bands half a period wide, projected from whichever axis the
  // surface faces, each box-filtered over the pixel so it greys out evenly with distance
  vec3 n = pow(abs(normalize(vRestN)), vec3(6.0));
  n /= n.x + n.y + n.z;
  vec2 uvs[3];
  uvs[0] = p.zy; uvs[1] = p.xz; uvs[2] = p.xy;
  float check = 0.0;
  for (int k = 0; k < 3; k++) {
    vec2 f = uvs[k] / 0.024;
    vec2 w = max(fwidth(f), vec2(1e-4));
    vec2 a = f - 0.5 * w, b = f + 0.5 * w;
    vec2 band = ((floor(b) * 0.5 + max(fract(b) - 0.5, 0.0)) - (floor(a) * 0.5 + max(fract(a) - 0.5, 0.0))) / w;
    check += n[k] * (band.x + band.y) * 0.5;
  }
  vec3 shirt = mix(vec3(0.86, 0.87, 0.9), vec3(0.018, 0.03, 0.085), check);
#ifdef COLLAR
  diffuseColor.rgb = shirt;
#else
  float th = atan(p.x, p.z - ${NECK.zc});
  float neck = ${NECK.y} - ${NECK.v} * (1.0 - smoothstep(0.25, 0.75, abs(th)));
  float isShirt = smoothstep(0.965, 0.968, p.y) * (1.0 - smoothstep(neck - 0.002, neck + 0.002, p.y)) * (1.0 - smoothstep(0.535, 0.538, ax));
  float isBelt = smoothstep(0.962, 0.965, p.y) * (1.0 - smoothstep(0.994, 0.997, p.y));
  float isLegs = smoothstep(0.122, 0.128, p.y) * (1.0 - isBelt) * (1.0 - smoothstep(0.995, 0.998, p.y)) * step(ax, 0.3);
  float buckle = isBelt * (1.0 - smoothstep(0.016, 0.019, ax)) * step(0.0, p.z) * step(0.968, p.y) * step(p.y, 0.991);
  vec3 c = skin;
  c = mix(c, uShoes * (0.25 + 0.9 * l), 1.0 - smoothstep(0.122, 0.128, p.y));
  c = mix(c, uTrousers, isLegs);
  c = mix(c, mix(vec3(0.035, 0.018, 0.01), vec3(0.45, 0.42, 0.36), buckle), isBelt);
  c = mix(c, shirt, isShirt);
  diffuseColor.rgb = c;
#endif
}`;
// his hair: her texture's strands in dark brown, cut short (some skin through) low on the sides and at the back
const HAIR_GLSL = /* glsl */ `
{
  float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 hair = uHair * (0.45 + 0.55 * clamp(l / 0.006, 0.0, 2.2));
  float fade = (1.0 - smoothstep(1.43, 1.5, vRest.y)) * smoothstep(0.035, 0.07, abs(vRest.x) + max(0.0, -vRest.z - 0.02));
  diffuseColor.rgb = mix(hair, mix(uSkin, hair, 0.55), fade * 0.7);
}`;

function dress(m: THREE.MeshStandardMaterial, kind: "body" | "collar" | "hair", u: Record<string, THREE.IUniform>) {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", BODY_VERT).replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = position;\nvRestN = normal;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vRest;\nvarying vec3 vRestN;\nuniform vec3 uSkin, uShoes, uTrousers, uHair;${kind === "collar" ? "\n#define COLLAR" : ""}`)
      .replace("#include <map_fragment>", `#include <map_fragment>\n${kind === "hair" ? HAIR_GLSL : BODY_GLSL}`);
  };
  m.customProgramCacheKey = () => `coach-${kind}`;
}

/* ---------- IK ---------- */
const _s = new THREE.Vector3(), _e = new THREE.Vector3(), _w = new THREE.Vector3(), _d = new THREE.Vector3();
const _p = new THREE.Vector3(), _f = new THREE.Vector3(), _t = new THREE.Vector3(), _v = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qp = new THREE.Quaternion();
/* turn a bone so that a world direction it carries (from) points along another (to) */
function turnBone(bone: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) {
  _q.setFromUnitVectors(from.normalize(), to.normalize());
  applyWorld(bone, _q);
}
/* apply a world-space rotation to a bone, about its own origin */
function applyWorld(bone: THREE.Object3D, q: THREE.Quaternion) {
  bone.getWorldQuaternion(_qa);
  bone.parent!.getWorldQuaternion(_qp);
  bone.quaternion.copy(_qp.invert().multiply(_qa.premultiply(q)));
  bone.updateMatrixWorld(true);
}
/* shoulder-elbow-wrist reaching for target, the elbow bent towards pole */
function reach(arm: THREE.Bone, fore: THREE.Bone, hand: THREE.Bone, target: THREE.Vector3, pole: THREE.Vector3) {
  arm.getWorldPosition(_s);
  fore.getWorldPosition(_e);
  hand.getWorldPosition(_w);
  const a = _s.distanceTo(_e), b = _e.distanceTo(_w);
  _d.subVectors(target, _s);
  const c = THREE.MathUtils.clamp(_d.length(), Math.abs(a - b) + 1e-4, a + b - 1e-4);
  _d.normalize();
  const cosA = THREE.MathUtils.clamp((a * a + c * c - b * b) / (2 * a * c), -1, 1);
  _p.subVectors(pole, _s);
  _p.addScaledVector(_d, -_p.dot(_d)).normalize();
  _t.copy(_s).addScaledVector(_d, a * cosA).addScaledVector(_p, a * Math.sqrt(1 - cosA * cosA)); // the elbow
  turnBone(arm, _v.subVectors(_e, _s), _f.subVectors(_t, _s));
  fore.getWorldPosition(_e);
  hand.getWorldPosition(_w);
  _t.copy(_s).addScaledVector(_d, c); // the wrist, as far as the arm reaches
  turnBone(fore, _v.subVectors(_w, _e), _f.subVectors(_t, _e));
}

/* a point fixed to a bone of a skinned mesh, given in the mesh's bind pose (metres) */
type Anchor = { bone: THREE.Bone; local: THREE.Vector3 };
function anchor(mesh: THREE.SkinnedMesh, name: string, x: number, y: number, z: number): Anchor | null {
  const k = mesh.skeleton.bones.findIndex((b) => b.name === name);
  if (k < 0) return null;
  const local = new THREE.Vector3(x, y, z).applyMatrix4(mesh.bindMatrix).applyMatrix4(mesh.skeleton.boneInverses[k]);
  return { bone: mesh.skeleton.bones[k], local };
}
const at = (a: Anchor, out: THREE.Vector3) => out.copy(a.local).applyMatrix4(a.bone.matrixWorld);

/* ---------- the ribbon ---------- */
const RIBBON_N = 72;
const RIBBON_W = 0.022;
function makeRibbon() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((RIBBON_N + 1) * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array((RIBBON_N + 1) * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const idx: number[] = [];
  for (let i = 0; i < RIBBON_N; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  geo.setIndex(idx);
  return geo;
}
const curve = new THREE.CatmullRomCurve3(Array.from({ length: 6 }, () => new THREE.Vector3()), true, "centripetal");
const _c = new THREE.Vector3(), _tan = new THREE.Vector3(), _rad = new THREE.Vector3(), _b = new THREE.Vector3(), _pt = new THREE.Vector3();
function layRibbon(geo: THREE.BufferGeometry, pts: THREE.Vector3[]) {
  curve.points.forEach((p, i) => p.copy(pts[i]));
  _c.set(0, 0, 0);
  for (const p of pts) _c.add(p);
  _c.multiplyScalar(1 / pts.length);
  const pos = geo.attributes.position as THREE.BufferAttribute, nrm = geo.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i <= RIBBON_N; i++) {
    const t = (i % RIBBON_N) / RIBBON_N;
    curve.getPointAt(t, _pt);
    curve.getTangentAt(t, _tan);
    // flat against whatever it hangs round: across the loop's plane
    _rad.subVectors(_pt, _c);
    _b.crossVectors(_tan, _rad).normalize();
    const nx = _rad.addScaledVector(_tan, -_rad.dot(_tan)).normalize();
    pos.setXYZ(2 * i, _pt.x + _b.x * RIBBON_W * 0.5, _pt.y + _b.y * RIBBON_W * 0.5, _pt.z + _b.z * RIBBON_W * 0.5);
    pos.setXYZ(2 * i + 1, _pt.x - _b.x * RIBBON_W * 0.5, _pt.y - _b.y * RIBBON_W * 0.5, _pt.z - _b.z * RIBBON_W * 0.5);
    nrm.setXYZ(2 * i, nx.x, nx.y, nx.z);
    nrm.setXYZ(2 * i + 1, nx.x, nx.y, nx.z);
  }
  pos.needsUpdate = true;
  nrm.needsUpdate = true;
  geo.computeBoundingSphere();
}

/* where the ribbon lies on her (her bind pose, metres): round the back of her neck, over her
   collarbones and down to the medal on her breastbone. Indices: her right side, back, her left
   side, her left breast strand, the medal's ring, her right breast strand. */
const WORN: [string, number, number, number][] = [
  ["mixamorigNeck", -0.058, 1.322, 0.005],
  ["mixamorigNeck", 0, 1.338, -0.052],
  ["mixamorigNeck", 0.058, 1.322, 0.005],
  ["mixamorigSpine2", 0.034, 1.268, 0.098],
  ["mixamorigSpine2", 0, 1.222, 0.13],
  ["mixamorigSpine2", -0.034, 1.268, 0.098],
];
const MEDAL_R = 0.038;
const AWAY = new THREE.Vector3(COACH_SPOT.x - COACH_SPOT.her.x, 0, COACH_SPOT.z - COACH_SPOT.her.z).normalize(); // from her to him
const FILL = 110; // candela: about the evening key light's strength where they stand

export default function Coach() {
  const runner = useGLTF(MODEL);
  const gltf = useGLTF(COACH_MODEL);
  const clipTexts = useLoader(THREE.FileLoader, CLIPS) as unknown as string[];
  const idleClip = useMemo(() => THREE.AnimationClip.parse(JSON.parse(clipTexts[2])), [clipTexts]);

  const rig = useMemo(() => {
    const dressed = runner.materials as Record<string, THREE.MeshStandardMaterial>;
    const u: Record<string, THREE.IUniform> = {
      uSkin: { value: new THREE.Color(SKIN) },
      uShoes: { value: new THREE.Color("#4a2c1c") },
      uTrousers: { value: new THREE.Color("#2c303c") },
      uHair: { value: new THREE.Color("#4b3527") },
    };
    const model = SkeletonUtils.clone(gltf.scene) as THREE.Group;
    const skinned: THREE.SkinnedMesh[] = [];
    const bones: Record<string, THREE.Bone> = {};
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone;
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      skinned.push(mesh);
      mesh.frustumCulled = false; // culled as a whole below
      mesh.castShadow = true;
      const src = mesh.material as THREE.MeshStandardMaterial;
      let m: THREE.MeshStandardMaterial;
      if (src.name === "Ch03_Body") {
        m = dressed.Ch03_Body.clone();
        m.normalMap = null;
        m.roughnessMap = null;
        m.metalnessMap = null;
        m.metalness = 0;
        m.roughness = 0.82;
        dress(m, "body", u);
      } else if (src.name === "Collar") {
        m = new THREE.MeshStandardMaterial({ roughness: 0.82, side: THREE.DoubleSide });
        dress(m, "collar", u);
      } else if (src.name === "Hair") {
        m = dressed.Hair.clone();
        m.roughness = 0.62;
        dress(m, "hair", u);
      } else {
        m = src.clone(); // his face texture
        m.metalness = 0.05;
      }
      m.envMapIntensity = 0.9;
      mesh.material = m;
    });
    for (const m of skinned.slice(1)) m.bind(skinned[0].skeleton, m.bindMatrix);
    model.scale.setScalar(SCALE);
    const root = new THREE.Group();
    root.add(model);
    root.position.set(COACH_SPOT.x, 0, COACH_SPOT.z);
    root.rotation.y = COACH_SPOT.heading;
    root.visible = false; // until the first frame has looked at the camera

    // the medal: a gold disc with a raised rim and a lime ribbon
    const gold = new THREE.MeshStandardMaterial({ color: "#e0b440", metalness: 1, roughness: 0.28 });
    const medal = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(MEDAL_R, MEDAL_R, 0.006, 32), gold);
    disc.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(MEDAL_R * 0.82, 0.0022, 6, 32), gold);
    rim.position.z = 0.003;
    const rimBack = rim.clone();
    rimBack.position.z = -0.003;
    const ringTop = new THREE.Mesh(new THREE.TorusGeometry(0.007, 0.0018, 6, 16), gold);
    ringTop.position.y = MEDAL_R + 0.005;
    medal.add(disc, rim, rimBack, ringTop);
    medal.traverse((o) => (o.castShadow = true));
    const ribbonGeo = makeRibbon();
    const ribbon = new THREE.Mesh(ribbonGeo, new THREE.MeshStandardMaterial({ color: "#c6f432", roughness: 0.55, side: THREE.DoubleSide }));
    ribbon.castShadow = true;
    ribbon.frustumCulled = false;
    const prize = new THREE.Group();
    prize.add(medal, ribbon);
    prize.visible = false;

    // a floodlight on the two of them for the ceremony (always in the scene, so the lights never
    // change and no shader is rebuilt: it is only dimmed to nothing away from the last sign)
    const fill = new THREE.SpotLight("#fff2e2", 0, 0, 0.36, 0.85, 2);
    fill.position.set(CEREMONY_LIGHT.pos.x, CEREMONY_LIGHT.pos.y, CEREMONY_LIGHT.pos.z);
    fill.target.position.set(CEREMONY_LIGHT.tgt.x, CEREMONY_LIGHT.tgt.y, CEREMONY_LIGHT.tgt.z);

    const hand = (side: string) => anchor(skinned[0], `mixamorig${side}Hand`, side === "Left" ? 0.64 : -0.64, 1.265, 0.012); // the palm
    return { model, root, bones, prize, medal, ribbonGeo, fill, palmL: hand("Left"), palmR: hand("Right"), mixer: new THREE.AnimationMixer(model) };
  }, [gltf, runner]);

  useEffect(() => {
    const idle = rig.mixer.clipAction(idleClip);
    idle.play();
    idle.time = 1.3; // out of step with her
    return () => void idle.stop();
  }, [rig, idleClip]);

  const worn = useRef<Anchor[] | null>(null);
  const frustum = useMemo(() => new THREE.Frustum(), []);
  const pm = useMemo(() => new THREE.Matrix4(), []);
  const sphere = useMemo(() => new THREE.Sphere(new THREE.Vector3(COACH_SPOT.x, 1, COACH_SPOT.z), 2.2), []);
  const v = useMemo(() => Array.from({ length: 16 }, () => new THREE.Vector3()), []);
  const pts = useMemo(() => Array.from({ length: 6 }, () => new THREE.Vector3()), []);
  const saved = useMemo(() => Array.from({ length: 6 }, () => new THREE.Quaternion()), []);
  const qIK = useMemo(() => Array.from({ length: 6 }, () => new THREE.Quaternion()), []);
  const mBasis = useMemo(() => new THREE.Matrix4(), []);
  const QA = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("qa") === "1";

  useFrame(({ camera }, dt) => {
    const st = scene.get();
    const micro = st.mode === "story" && storyState(st.storyP).micro;
    const { root, bones, prize, medal, ribbonGeo, fill, palmL, palmR, mixer } = rig;
    fill.intensity = FILL * (st.mode !== "trip" ? 0 : st.trip >= SLIDE_COUNT ? 1 : st.trip === FINISH_INDEX ? range(st.q, 0.6, 1) : 0);
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const near = camera.position.distanceTo(sphere.center);
    const visible = !micro && near > 1.1 && near < 140 && frustum.intersectsSphere(sphere);
    root.visible = visible;
    prize.visible = visible;
    if (!visible || !palmL || !palmR) return;

    const k = ceremonyK(st);
    const raise = srange(k, ...MEDAL.raise), lower = srange(k, ...MEDAL.lower), settle = srange(k, ...MEDAL.settle);
    const ik = 1 - srange(k, ...MEDAL.drop);
    // turning to the camera he eases half a step back from her, so their feet stay clear
    const turn = srange(k, ...MEDAL.turn);
    root.rotation.y = lerpAngle(COACH_SPOT.heading, COACH_TURN, 0.6 * turn);
    root.position.set(COACH_SPOT.x + AWAY.x * 0.14 * turn, 0, COACH_SPOT.z + AWAY.z * 0.14 * turn);
    mixer.update(Math.min(dt, 0.1));
    root.updateMatrixWorld(true);

    // her frame: where her head and neck are, which way is towards him and to his left
    const her = herRig.mesh && herRig.bones ? herRig : null;
    if (her && !worn.current) worn.current = WORN.map(([b, x, y, z]) => anchor(her.mesh!, b, x, y, z)).filter((a): a is Anchor => !!a);
    const toHim = v[0].set(COACH_SPOT.x - COACH_SPOT.her.x, 0, COACH_SPOT.z - COACH_SPOT.her.z).normalize();
    const hisLeft = v[1].set(-toHim.z, 0, toHim.x); // his left, facing her (her right)
    const head = v[2];
    const neck = v[3];
    if (her) {
      her.bones!.mixamorigHead.updateWorldMatrix(true, false);
      her.bones!.mixamorigHead.getWorldPosition(head);
      her.bones!.mixamorigNeck.getWorldPosition(neck);
    } else {
      head.set(COACH_SPOT.her.x, 1.37, COACH_SPOT.her.z);
      neck.set(COACH_SPOT.her.x, 1.31, COACH_SPOT.her.z);
    }

    // his hands: held at his waist, then up over her head (arcing out in front of her face),
    // down to either side of her neck
    const hold = v[4].set(COACH_SPOT.x, 1.08, COACH_SPOT.z).addScaledVector(toHim, -0.27);
    const over = v[5].copy(head).setY(head.y + 0.34).addScaledVector(toHim, 0.03);
    const onto = v[6].copy(neck).setY(neck.y + 0.03).addScaledVector(toHim, 0.02);
    const mid = v[7].copy(hold).lerp(over, raise).addScaledVector(toHim, 0.16 * Math.sin(Math.PI * raise)).lerp(onto, lower);
    const spread = 0.12 + 0.03 * raise - 0.02 * lower;
    const tL = v[8].copy(mid).addScaledVector(hisLeft, spread);
    const tR = v[9].copy(mid).addScaledVector(hisLeft, -spread);

    if (ik > 0.001) {
      const B = bones;
      const chain = [B.mixamorigSpine1, B.mixamorigSpine2, B.mixamorigLeftArm, B.mixamorigLeftForeArm, B.mixamorigRightArm, B.mixamorigRightForeArm];
      chain.forEach((b, i) => saved[i].copy(b.quaternion));
      // lean in to her as his hands go up and over
      const lean = 0.16 * raise * (1 - 0.5 * lower);
      _q.setFromAxisAngle(v[10].copy(hisLeft), lean * 0.5);
      applyWorld(B.mixamorigSpine1, _q);
      applyWorld(B.mixamorigSpine2, _q);
      // the wrists, a hand's length short of where the palms should be
      const wristL = v[11].copy(tL).addScaledVector(toHim, 0.05);
      const wristR = v[12].copy(tR).addScaledVector(toHim, 0.05);
      const poleL = v[13].copy(tL).addScaledVector(hisLeft, 0.5).setY(tL.y - 0.6).addScaledVector(toHim, 0.4);
      const poleR = v[14].copy(tR).addScaledVector(hisLeft, -0.5).setY(tR.y - 0.6).addScaledVector(toHim, 0.4);
      reach(B.mixamorigLeftArm, B.mixamorigLeftForeArm, B.mixamorigLeftHand, wristL, poleL);
      reach(B.mixamorigRightArm, B.mixamorigRightForeArm, B.mixamorigRightHand, wristR, poleR);
      // blend the whole reach (and the lean) in and out over the animated pose
      chain.forEach((b, i) => qIK[i].copy(b.quaternion));
      chain.forEach((b, i) => b.quaternion.copy(saved[i]).slerp(qIK[i], ik));
      B.mixamorigHips.updateMatrixWorld(true);
    }

    // the ribbon: held open between his palms with the medal hanging under them; over her head the
    // loop's back passes behind her head and the medal in front of her face; then it lies on her
    const pL = at(palmL, v[8]), pR = at(palmR, v[9]);
    const hm = v[10].copy(pL).add(pR).multiplyScalar(0.5);
    const overness = raise * (1 - lower * 0.3);
    // (in WORN's order: his left palm is on her right)
    pts[0].copy(pL);
    pts[2].copy(pR);
    pts[1].copy(hm).setY(hm.y - 0.04 + 0.05 * overness).addScaledVector(toHim, 0.05 - 0.25 * overness);
    pts[4].copy(hm).setY(hm.y - 0.25).addScaledVector(toHim, -0.04 + 0.19 * overness);
    pts[3].copy(pR).lerp(pts[4], 0.5).addScaledVector(hisLeft, -0.03).addScaledVector(toHim, 0.05 * overness);
    pts[5].copy(pL).lerp(pts[4], 0.5).addScaledVector(hisLeft, 0.03).addScaledVector(toHim, 0.05 * overness);
    if (worn.current && worn.current.length === 6 && settle > 0) {
      worn.current.forEach((a) => a.bone.updateWorldMatrix(true, false));
      worn.current.forEach((a, i) => pts[i].lerp(at(a, v[15]), settle));
    }
    layRibbon(ribbonGeo, pts);
    // the medal hangs from the loop's lowest point, down from the two sides, facing out of the loop
    const top = pts[4];
    const down = v[11].copy(pts[0]).add(pts[2]).multiplyScalar(0.5).sub(top).negate().normalize();
    const face = v[12].subVectors(top, pts[1]);
    face.addScaledVector(down, -face.dot(down)).normalize();
    const side = v[13].crossVectors(face, down).normalize();
    mBasis.makeBasis(side, v[14].copy(down).negate(), face);
    medal.quaternion.setFromRotationMatrix(mBasis);
    medal.position.copy(top).addScaledVector(down, MEDAL_R + 0.009);
    if (QA) (window as unknown as Record<string, unknown>).__coach = { k, medal: medal.position.toArray(), palms: [...pL.toArray(), ...pR.toArray()] };
  });

  return (
    <group>
      <primitive object={rig.root} />
      <primitive object={rig.prize} />
      <primitive object={rig.fill} />
      <primitive object={rig.fill.target} />
    </group>
  );
}
