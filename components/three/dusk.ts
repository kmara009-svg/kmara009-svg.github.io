/* The dusk palette, shared by the sky dome, the lake's reflections, the skyline's haze and the fog
   (CameraRig resets the fog to HAZE every frame), so the land always fades into the sky behind it. */
import * as THREE from "three";

export const HAZE = "#a995b4";
export const SKY = {
  horizon: new THREE.Color("#f3ad93"),
  mid: new THREE.Color("#a487cc"),
  zenith: new THREE.Color("#33367f"),
  glow: new THREE.Color("#ff8d4d"),
  sunDir: new THREE.Vector3(-0.93, 0.0, 0.36).normalize(), // just set, in the west-south-west
};
export const skyUniforms = () => ({
  uHorizon: { value: SKY.horizon },
  uMid: { value: SKY.mid },
  uZenith: { value: SKY.zenith },
  uGlow: { value: SKY.glow },
  uSunDir: { value: SKY.sunDir },
});
/* sky radiance (linear) in unit direction d; haze at and below the horizon */
export const SKY_GLSL = /* glsl */ `
uniform vec3 uHorizon; uniform vec3 uMid; uniform vec3 uZenith; uniform vec3 uGlow; uniform vec3 uSunDir;
vec3 skyColor(vec3 d, vec3 haze) {
  float h = d.y;
  vec3 c = mix(uHorizon, uMid, smoothstep(0.02, 0.3, h));
  c = mix(c, uZenith, smoothstep(0.22, 0.85, h));
  float s = max(dot(normalize(vec3(d.x, 0.0, d.z)), uSunDir), 0.0);
  c += uGlow * (0.45 * pow(s, 4.0) + 0.8 * pow(s, 32.0)) * (1.0 - smoothstep(-0.02, 0.4, h));
  return mix(haze, c, smoothstep(-0.005, 0.06, h));
}`;

/* Night falls away from the floodlights: lit surfaces of the park dim with distance from the
   stadium (an ellipse round the bowl), down to `floor` of their light. Works with instancing. */
export function duskify<T extends THREE.Material>(m: T, near = 120, far = 360, floor = 0.4): T {
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vDuskXZ;").replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vDuskXZ = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xz;
      #else
        vDuskXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
      #endif`
    );
    s.fragmentShader = s.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vDuskXZ;").replace(
      "#include <opaque_fragment>",
      `outgoingLight *= mix(1.0, ${floor.toFixed(3)}, smoothstep(${near.toFixed(1)}, ${far.toFixed(1)}, length(vDuskXZ * vec2(0.8, 1.0))));
      #include <opaque_fragment>`
    );
  };
  m.customProgramCacheKey = () => `dusk-${near}-${far}-${floor}`;
  return m;
}
