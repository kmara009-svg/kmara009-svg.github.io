"use client";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { story, storyState } from "@/lib/story";

export const MICRO_ORIGIN = new THREE.Vector3(0, -80, 0);

/* Trabecular bone lattice: nodes on a jittered grid joined by struts.
   `porosity` 0 = dense, 1 = porous (struts thin and vanish). */
export default function MicroBone() {
  const N = 7;
  const spacing = 0.5;
  const { nodes, struts } = useMemo(() => {
    const rnd = mulberry32(7);
    const nodes: THREE.Vector3[] = [];
    const idx = (x: number, y: number, z: number) => x * N * N + y * N + z;
    for (let x = 0; x < N; x++)
      for (let y = 0; y < N; y++)
        for (let z = 0; z < N; z++) {
          nodes.push(
            new THREE.Vector3(
              (x - (N - 1) / 2) * spacing + (rnd() - 0.5) * 0.24,
              (y - (N - 1) / 2) * spacing + (rnd() - 0.5) * 0.24,
              (z - (N - 1) / 2) * spacing + (rnd() - 0.5) * 0.24
            )
          );
        }
    const struts: { a: number; b: number; thr: number; r: number }[] = [];
    for (let x = 0; x < N; x++)
      for (let y = 0; y < N; y++)
        for (let z = 0; z < N; z++) {
          const a = idx(x, y, z);
          const push = (b: number) => struts.push({ a, b, thr: 0.12 + rnd() * 0.88, r: 0.028 + rnd() * 0.03 });
          if (x < N - 1 && rnd() > 0.08) push(idx(x + 1, y, z));
          if (y < N - 1 && rnd() > 0.08) push(idx(x, y + 1, z));
          if (z < N - 1 && rnd() > 0.08) push(idx(x, y, z + 1));
        }
    return { nodes, struts };
  }, []);

  const strutMesh = useRef<THREE.InstancedMesh>(null);
  const nodeMesh = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  const last = useRef(-1);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);

  useFrame((_, dt) => {
    const p = story.get();
    const s = storyState(p);
    if (group.current) {
      group.current.visible = s.micro;
      group.current.rotation.y += Math.min(dt, 0.05) * 0.08;
    }
    if (!s.micro) return;
    const por = s.porosity;
    if (Math.abs(por - last.current) < 0.002 || !strutMesh.current || !nodeMesh.current) return;
    last.current = por;
    struts.forEach((st, i) => {
      const A = nodes[st.a];
      const B = nodes[st.b];
      dir.subVectors(B, A);
      const len = dir.length();
      q.setFromUnitVectors(up, dir.normalize());
      dummy.position.copy(A).lerp(B, 0.5);
      dummy.quaternion.copy(q);
      // fade each strut out as porosity passes its threshold
      const vis = 1 - smoothstep(st.thr - 0.1, st.thr, por * 0.74);
      const r = st.r * (1 - 0.5 * por) * vis;
      dummy.scale.set(Math.max(r, 0.0001), len * (0.55 + 0.45 * vis), Math.max(r, 0.0001));
      dummy.updateMatrix();
      strutMesh.current!.setMatrixAt(i, dummy.matrix);
    });
    strutMesh.current.instanceMatrix.needsUpdate = true;
    nodes.forEach((n, i) => {
      const vis = 1 - 0.35 * por;
      const r = (0.045 - 0.016 * por) * vis;
      dummy.position.copy(n);
      dummy.quaternion.identity();
      dummy.scale.setScalar(Math.max(r, 0.0001));
      dummy.updateMatrix();
      nodeMesh.current!.setMatrixAt(i, dummy.matrix);
    });
    nodeMesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={group} position={MICRO_ORIGIN} visible={false}>
      <instancedMesh ref={strutMesh} args={[undefined, undefined, struts.length]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 7, 1]} />
        <meshStandardMaterial color="#e4dac2" roughness={0.9} metalness={0} />
      </instancedMesh>
      <instancedMesh ref={nodeMesh} args={[undefined, undefined, nodes.length]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#ebe2cc" roughness={0.9} metalness={0} />
      </instancedMesh>
      <pointLight position={[3, 3, 3]} intensity={14} color="#fff2dc" distance={16} decay={2} />
      <pointLight position={[-3.5, -1, 2.5]} intensity={7} color="#c6f432" distance={16} decay={2} />
      <pointLight position={[0, 3, -3.5]} intensity={3} color="#7cc8ff" distance={14} decay={2} />
      <ambientLight intensity={0.22} />
    </group>
  );
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
