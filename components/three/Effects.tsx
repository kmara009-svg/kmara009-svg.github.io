"use client";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { runnerPose, scene } from "@/lib/scene";
import { storyState } from "@/lib/story";

/* Dust kicked up behind the runner. Lives in her frame: local +Z is ahead, so dust drifts to -Z. */
export function Dust() {
  const group = useRef<THREE.Group>(null);
  const pts = useRef<THREE.Points>(null);
  const N = 500;
  const { positions, vel } = useMemo(() => {
    const positions = new Float32Array(N * 3);
    const vel = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 3;
      positions[i * 3 + 1] = Math.random() * 1.2;
      positions[i * 3 + 2] = -Math.random() * 10;
      vel[i * 3] = (Math.random() - 0.5) * 0.3;
      vel[i * 3 + 1] = 0.05 + Math.random() * 0.2;
      vel[i * 3 + 2] = -(0.8 + Math.random() * 1.2);
    }
    return { positions, vel };
  }, []);
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    if (!pts.current || !group.current) return;
    const st = scene.get();
    const inMicro = st.mode === "story" && storyState(st.storyP).micro;
    group.current.visible = !inMicro;
    group.current.position.set(runnerPose.x, 0, runnerPose.z);
    group.current.rotation.y = runnerPose.heading;
    const k = 0.6 + Math.min(runnerPose.speed, 12) * 0.15;
    const arr = pts.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < N; i++) {
      arr[i * 3] += vel[i * 3] * d;
      arr[i * 3 + 1] += vel[i * 3 + 1] * d;
      arr[i * 3 + 2] += vel[i * 3 + 2] * d * k;
      if (arr[i * 3 + 2] < -12 || arr[i * 3 + 1] > 1.8) {
        arr[i * 3] = (Math.random() - 0.5) * 1.2;
        arr[i * 3 + 1] = Math.random() * 0.3;
        arr[i * 3 + 2] = -0.2 - Math.random() * 1.5;
      }
    }
    pts.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <group ref={group}>
      <points ref={pts}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#e9d9b8" size={0.05} sizeAttenuation transparent opacity={0.45} depthWrite={false} />
      </points>
    </group>
  );
}
