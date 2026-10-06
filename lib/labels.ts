/* X-ray bone labels: anchored to rig bones, projected to screen space each frame.
   DOM elements register here; the 3D scene writes their transforms directly. */
export const XRAY_LABELS = [
  { id: "pelvis", name: "Pelvis & sacrum", type: "Trabecular bone", left: false },
  { id: "femoral", name: "Femoral neck", type: "Trabecular bone", left: true },
  { id: "tibia", name: "Tibia · shin", type: "Cortical bone", left: false },
  { id: "foot", name: "Foot · metatarsals", type: "Cortical bone", left: true },
];

export const labelEls: Record<string, HTMLDivElement | null> = {};
