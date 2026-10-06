/* X-ray bone labels: 3D anchor points projected to screen space each frame.
   DOM elements register here; the 3D scene writes their transforms directly. */
export const XRAY_LABELS = [
  { id: "pelvis", pos: [0.3, 1.1, 0] as const, name: "Pelvis & sacrum", type: "Trabecular bone", left: false },
  { id: "femoral", pos: [-0.34, 0.95, 0] as const, name: "Femoral neck", type: "Trabecular bone", left: true },
  { id: "tibia", pos: [0.3, 0.42, 0] as const, name: "Tibia · shin", type: "Cortical bone", left: false },
  { id: "foot", pos: [-0.32, 0.12, 0] as const, name: "Foot · metatarsals", type: "Cortical bone", left: true },
];

export const labelEls: Record<string, HTMLDivElement | null> = {};
