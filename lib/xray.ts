/* Real radiographs for the "where the skeleton pays" beats (Wikimedia Commons, credited on the
   references slide). Boxes are in 1920x1080 stage px and keep each image's own aspect ratio;
   marker points are fractions of the image box; each label sits at stage px (lx, ly = the
   middle of its first line) with a leader line to its marker. Nothing enters the top-right
   600x400 webcam zone. */
export type Marker = { id: string; fx: number; fy: number; name: string; type: string; lx: number; ly: number; align: "left" | "right" };
export type Radiograph = { src: string; alt: string; x: number; y: number; w: number; h: number; markers: Marker[] };
export type Credit = { what: string; file: string; author: string; licence: string; url: string; note?: string };

export const XRAY_HIP: Radiograph[] = [
  {
    // 1400 x 1069
    src: "/media/xray-pelvis.jpg",
    alt: "Frontal X-ray of an adult female pelvis showing the sacrum, both hip joints and the femoral necks",
    x: 600,
    y: 330,
    w: 700,
    h: 535,
    markers: [
      { id: "sacrum", fx: 0.5, fy: 0.17, name: "Pelvis & sacrum", type: "Trabecular bone", lx: 1350, ly: 470, align: "left" },
      { id: "femoral", fx: 0.155, fy: 0.52, name: "Femoral neck", type: "Trabecular bone", lx: 560, ly: 720, align: "right" },
    ],
  },
];

export const XRAY_LIMB: Radiograph[] = [
  {
    // 600 x 1344
    src: "/media/xray-tibia.jpg",
    alt: "Frontal X-ray of an adult lower leg and ankle showing the shafts of the tibia and fibula",
    x: 700,
    y: 290,
    w: 330,
    h: 740,
    markers: [{ id: "tibia", fx: 0.46, fy: 0.2, name: "Tibial shaft", type: "Cortical bone", lx: 600, ly: 600, align: "right" }],
  },
  {
    // 600 x 1375
    src: "/media/xray-foot.jpg",
    alt: "X-ray of an adult right foot from above showing the metatarsals and toes",
    x: 1110,
    y: 400,
    w: 279,
    h: 640,
    markers: [{ id: "foot", fx: 0.45, fy: 0.42, name: "Metatarsals", type: "Cortical bone", lx: 1450, ly: 700, align: "left" }],
  },
];

export const XRAY_CREDITS: Credit[] = [
  {
    what: "pelvis",
    file: "Medical X-Ray imaging DRL03 nevit.jpg",
    author: "Nevit Dilmen",
    licence: "CC BY-SA 3.0",
    url: "https://commons.wikimedia.org/wiki/File:Medical_X-Ray_imaging_DRL03_nevit.jpg",
    note: "cropped and toned; this version is shared under the same licence",
  },
  {
    what: "ankle",
    file: "X-ray of normal ankle - frontal.jpg",
    author: "Mikael Häggström",
    licence: "CC0",
    url: "https://commons.wikimedia.org/wiki/File:X-ray_of_normal_ankle_-_frontal.jpg",
  },
  {
    what: "foot",
    file: "X-ray of normal right foot by dorsoplantar projection.jpg",
    author: "Mikael Häggström",
    licence: "CC0",
    url: "https://commons.wikimedia.org/wiki/File:X-ray_of_normal_right_foot_by_dorsoplantar_projection.jpg",
  },
];
