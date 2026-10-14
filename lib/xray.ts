/* Real radiographs for the "where the skeleton pays" beats (Wikimedia Commons, credited on the
   references slide). Boxes are in 1920x1080 stage px; marker points are fractions of the image
   box; labels sit at stage px with a leader line to their marker. Kept clear of the top-right
   600x400 webcam zone. */
export type Marker = { id: string; fx: number; fy: number; name: string; type: string; lx: number; ly: number; align: "left" | "right" };
export type Radiograph = { src: string; alt: string; x: number; y: number; w: number; h: number; markers: Marker[] };
export type Credit = { file: string; author: string; licence: string; url: string };

export const XRAY_HIP: Radiograph[] = [
  {
    src: "/media/xray-pelvis.jpg",
    alt: "Frontal X-ray of an adult pelvis showing both hip joints, the femoral necks and the sacrum",
    x: 600,
    y: 300,
    w: 700,
    h: 525,
    markers: [
      { id: "sacrum", fx: 0.5, fy: 0.35, name: "Pelvis & sacrum", type: "Trabecular bone", lx: 1340, ly: 480, align: "left" },
      { id: "femoral", fx: 0.27, fy: 0.62, name: "Femoral neck", type: "Trabecular bone", lx: 560, ly: 900, align: "right" },
    ],
  },
];

export const XRAY_LIMB: Radiograph[] = [
  {
    src: "/media/xray-tibia.jpg",
    alt: "X-ray of an adult lower leg showing the tibia and fibula",
    x: 640,
    y: 140,
    w: 300,
    h: 860,
    markers: [{ id: "tibia", fx: 0.45, fy: 0.5, name: "Tibia · shin", type: "Cortical bone", lx: 560, ly: 560, align: "right" }],
  },
  {
    src: "/media/xray-foot.jpg",
    alt: "X-ray of an adult foot from above showing the metatarsals",
    x: 980,
    y: 300,
    w: 320,
    h: 700,
    markers: [{ id: "foot", fx: 0.5, fy: 0.4, name: "Foot · metatarsals", type: "Cortical bone", lx: 1340, ly: 560, align: "left" }],
  },
];

export const XRAY_CREDITS: Credit[] = [];
