"use client";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { storyState, srange, smooth, range } from "@/lib/story";
import { XRAY_LABELS, labelEls } from "@/lib/labels";
import { SLIDE_COUNT, STORY_END_D, markerD, runnerPose, scene } from "@/lib/scene";
import { headingOf, pointAt } from "@/lib/trackPath";

/* Rigged, textured runner (Mixamo "Michelle" from the three.js examples) driven by a
   motion-captured Mixamo run clip retargeted onto her skeleton (public/models/run.json).
   The glowing X-ray skeleton is built from capsules parented to her actual rig bones,
   so it runs with her. Bone-local units are centimetres (the rig root is scaled 0.01). */

const MODEL = "/models/runner.glb";
const CLIP = "/models/run.json";
useGLTF.preload(MODEL);

const LIME = new THREE.Color("#c6f432");
const XRAY_BODY = new THREE.Color("#7cc8ff");
const BLACK = new THREE.Color("#000000");
const UP = new THREE.Vector3(0, 1, 0);

type BodyMat = THREE.MeshStandardMaterial & { userData: { base?: THREE.Color } };

function makeBoneMaterials() {
  const bone = new THREE.MeshStandardMaterial({ color: "#e8f1f5", emissive: "#5fb8ff", emissiveIntensity: 0.45, roughness: 0.4, transparent: true, opacity: 0, depthWrite: false });
  const risk = new THREE.MeshStandardMaterial({ color: "#d9ff5a", emissive: "#c6f432", emissiveIntensity: 1.8, roughness: 0.4, transparent: true, opacity: 0, depthWrite: false });
  return { bone, risk };
}

/* capsule from a bone's origin to its child's origin */
function segment(bones: Record<string, THREE.Bone>, from: string, to: string, r: number, mat: THREE.Material, opts: { x?: number; z?: number; shrink?: number } = {}) {
  const a = bones[from];
  const b = bones[to];
  if (!a || !b) return;
  const len = b.position.length() * (1 - (opts.shrink ?? 0));
  const dir = b.position.clone().normalize();
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.5, len - 2 * r), 4, 12), mat);
  mesh.quaternion.setFromUnitVectors(UP, dir);
  mesh.position.copy(dir).multiplyScalar(b.position.length() - len / 2);
  mesh.position.x += opts.x ?? 0;
  mesh.position.z += opts.z ?? 0;
  mesh.renderOrder = 1;
  a.add(mesh);
}
function blob(bones: Record<string, THREE.Bone>, at: string, pos: [number, number, number], scale: [number, number, number], mat: THREE.Material, rot?: [number, number, number]) {
  const a = bones[at];
  if (!a) return;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat);
  mesh.position.set(...pos);
  mesh.scale.set(...scale);
  if (rot) mesh.rotation.set(...rot);
  mesh.renderOrder = 1;
  a.add(mesh);
}
function ring(bones: Record<string, THREE.Bone>, at: string, y: number, radius: number, mat: THREE.Material) {
  const a = bones[at];
  if (!a) return;
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.85, 8, 28), mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = y;
  mesh.scale.z = 0.8;
  mesh.renderOrder = 1;
  a.add(mesh);
}

export default function Runner() {
  const gltf = useGLTF(MODEL);
  const clipText = useLoader(THREE.FileLoader, CLIP) as unknown as string;
  const clip = useMemo(() => THREE.AnimationClip.parse(JSON.parse(clipText)), [clipText]);
  const mats = useMemo(makeBoneMaterials, []);

  const { model, bodyMats, bones, mixer } = useMemo(() => {
    const model = SkeletonUtils.clone(gltf.scene) as THREE.Group;
    const bodyMats: BodyMat[] = [];
    const bones: Record<string, THREE.Bone> = {};
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone;
      const mesh = o as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) {
        mesh.frustumCulled = false;
        mesh.renderOrder = 2;
        mesh.castShadow = true;
        const src = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[];
        const cloned = src.map((m) => {
          const c = m.clone() as BodyMat;
          c.transparent = true;
          c.metalness = Math.min(c.metalness, 0.25);
          c.envMapIntensity = 0.9;
          c.userData.base = c.color.clone();
          bodyMats.push(c);
          return c;
        });
        mesh.material = cloned.length === 1 ? cloned[0] : cloned;
      }
    });

    // ----- X-ray skeleton, parented to the rig -----
    const { bone, risk } = mats;
    for (const side of ["Left", "Right"]) {
      // femur: head + neck (high risk) and shaft
      blob(bones, `mixamorig${side}UpLeg`, [0, 0, 0], [3.4, 3.4, 3.4], risk);
      const upLeg = bones[`mixamorig${side}UpLeg`];
      if (upLeg) {
        const neck = new THREE.Mesh(new THREE.CapsuleGeometry(2.6, 4.5, 4, 12), risk);
        neck.position.set(0, 4.2, 0);
        neck.renderOrder = 1;
        upLeg.add(neck);
      }
      segment(bones, `mixamorig${side}UpLeg`, `mixamorig${side}Leg`, 2.5, bone, { shrink: 0.2 });
      blob(bones, `mixamorig${side}Leg`, [0, 0, 0], [3.4, 3, 3.4], bone);
      // tibia (high risk) + fibula
      segment(bones, `mixamorig${side}Leg`, `mixamorig${side}Foot`, 2.3, risk);
      segment(bones, `mixamorig${side}Leg`, `mixamorig${side}Foot`, 0.9, bone, { x: side === "Left" ? 2.6 : -2.6 });
      // foot (high risk): heel, midfoot, metatarsals
      blob(bones, `mixamorig${side}Foot`, [0, 0, 0], [2.6, 2.6, 2.6], bone);
      segment(bones, `mixamorig${side}Foot`, `mixamorig${side}ToeBase`, 1.6, risk);
      for (const x of [-2.2, 0, 2.2]) segment(bones, `mixamorig${side}ToeBase`, `mixamorig${side}Toe_End`, 0.65, risk, { x });
      // arms
      segment(bones, `mixamorig${side}Shoulder`, `mixamorig${side}Arm`, 1.0, bone);
      segment(bones, `mixamorig${side}Arm`, `mixamorig${side}ForeArm`, 1.9, bone);
      segment(bones, `mixamorig${side}ForeArm`, `mixamorig${side}Hand`, 1.5, bone);
      segment(bones, `mixamorig${side}ForeArm`, `mixamorig${side}Hand`, 0.8, bone, { x: side === "Left" ? 2.2 : -2.2 });
      blob(bones, `mixamorig${side}Hand`, [0, 4, 0], [2.6, 4.5, 1.6], bone);
    }
    // pelvis: two ilia + sacrum (high risk)
    blob(bones, "mixamorigHips", [7.4, -1.5, -1.5], [6.2, 7.5, 3.4], risk, [0, 0, -0.25]);
    blob(bones, "mixamorigHips", [-7.4, -1.5, -1.5], [6.2, 7.5, 3.4], risk, [0, 0, 0.25]);
    blob(bones, "mixamorigHips", [0, -3, -4.5], [3.2, 5.5, 1.6], risk, [0.3, 0, 0]);
    // spine column, ribs, clavicles, skull
    segment(bones, "mixamorigHips", "mixamorigSpine", 2.0, bone);
    segment(bones, "mixamorigSpine", "mixamorigSpine1", 2.0, bone);
    segment(bones, "mixamorigSpine1", "mixamorigSpine2", 2.0, bone);
    segment(bones, "mixamorigSpine2", "mixamorigNeck", 2.0, bone);
    segment(bones, "mixamorigNeck", "mixamorigHead", 1.6, bone);
    ring(bones, "mixamorigSpine1", 1.5, 11.5, bone);
    ring(bones, "mixamorigSpine1", 5.0, 11.8, bone);
    ring(bones, "mixamorigSpine2", 2.0, 11.4, bone);
    ring(bones, "mixamorigSpine2", 5.6, 10.4, bone);
    blob(bones, "mixamorigHead", [0, 9.5, 0.5], [7.8, 8.8, 9.2], bone);

    const mixer = new THREE.AnimationMixer(model);
    return { model, bodyMats, bones, mixer };
  }, [gltf, mats]);

  useEffect(() => {
    const action = mixer.clipAction(clip);
    action.play();
    return () => {
      action.stop();
    };
  }, [mixer, clip]);

  const root = useRef<THREE.Group>(null);
  const proj = useMemo(() => new THREE.Vector3(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const tmp2 = useMemo(() => new THREE.Vector3(), []);

  const lastD = useRef(0);
  useFrame(({ camera, size }, dt) => {
    const st = scene.get();
    const s = storyState(st.mode === "story" ? st.storyP : 1);
    // where she is along the lap
    let d: number;
    // in the story she holds still while the X-ray is on, so the bone labels stay put
    const sp = st.storyP;
    const hold = srange(sp, 0.19, 0.23) * (1 - srange(sp, 0.4, 0.44));
    if (st.mode === "story") {
      const f = sp < 0.21 ? (sp / 0.21) * 0.38 : sp < 0.42 ? 0.38 : 0.38 + ((sp - 0.42) / 0.58) * 0.62;
      d = 34 + (STORY_END_D - 34) * f;
    }
    else d = markerD(st.trip - 1) + (markerD(st.trip) - markerD(st.trip - 1)) * smooth(range(st.q, 0.14, 0.7));
    const dd = Math.min(dt, 0.05);
    const speed = dd > 0 ? Math.min(Math.abs(d - lastD.current) / dd, 14) : 0;
    lastD.current = d;
    runnerPose.d = d;
    runnerPose.speed = speed;
    const tp = pointAt(d);
    runnerPose.x = tp.x;
    runnerPose.z = tp.z;
    runnerPose.heading = headingOf(tp);
    if (root.current) {
      root.current.position.set(tp.x, 0, tp.z);
      root.current.rotation.y = runnerPose.heading;
      root.current.visible = !s.micro;
    }
    if (s.micro) {
      XRAY_LABELS.forEach((l) => {
        const el = labelEls[l.id];
        if (el) el.style.opacity = "0";
      });
      return;
    }

    // clip speed follows her ground speed (the mocap run is roughly 3.4 m/s)
    const timeScale = Math.max(0.85, Math.min(2.4, speed / 3.4 + (st.trip >= SLIDE_COUNT && st.mode === "trip" ? 0.3 : 0)));
    mixer.update(dd * timeScale * (st.mode === "story" ? 1 - hold : 1));

    // X-ray crossfade on the skinned body
    const x = st.mode !== "story" || s.finish ? 0 : s.xray;
    for (const m of bodyMats) {
      m.color.copy(m.userData.base!).lerp(XRAY_BODY, x);
      m.emissive.copy(BLACK).lerp(XRAY_BODY, x * 0.9);
      m.emissiveIntensity = 0.7 * x;
      m.opacity = 1 - 0.88 * x;
      m.depthWrite = x < 0.05;
    }
    mats.bone.opacity = x * 0.95;
    mats.risk.opacity = x;
    mats.risk.emissiveIntensity = 0.8 + 1.4 * x;
    mats.risk.emissive.copy(LIME);

    // labels anchored to bones
    const anchor = (id: string) => {
      switch (id) {
        case "pelvis":
          return bones.mixamorigHips.getWorldPosition(tmp).add(tmp2.set(0.16, 0.08, 0));
        case "femoral":
          return bones.mixamorigRightUpLeg.getWorldPosition(tmp).add(tmp2.set(-0.14, 0.0, 0));
        case "tibia":
          bones.mixamorigLeftLeg.getWorldPosition(tmp);
          bones.mixamorigLeftFoot.getWorldPosition(tmp2);
          return tmp.lerp(tmp2, 0.5).add(tmp2.set(0.14, 0, 0));
        default:
          return bones.mixamorigRightFoot.getWorldPosition(tmp).add(tmp2.set(-0.14, -0.03, 0));
      }
    };
    XRAY_LABELS.forEach((l) => {
      const el = labelEls[l.id];
      if (!el) return;
      proj.copy(anchor(l.id)).project(camera);
      const sx = ((proj.x + 1) / 2) * size.width;
      const sy = ((1 - proj.y) / 2) * size.height;
      el.style.opacity = String(proj.z > 1 ? 0 : s.labels);
      el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(${l.left ? "-100%" : "0"}, -50%)`;
    });
  });

  return (
    <group ref={root}>
      <primitive object={model} />
    </group>
  );
}
