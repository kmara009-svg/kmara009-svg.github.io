// Replace the runner's trouser-tube legs with anatomically shaped bare legs.
//   npm i --no-save @gltf-transform/core @gltf-transform/extensions pngjs sharp
//   git show 815bfcf:public/models/runner.glb > /tmp/runner-src.glb   (the model before this rebuild)
//   node scripts/model/rebuild-legs.mjs /tmp/runner-src.glb public/models/runner.glb [profile.json]
// 1. Delete the old leg surface between the shoe collar and the mid-thigh shorts hem (common.mjs).
// 2. Loft a new leg per side along the bind-pose bone axis (ankle -> knee -> hip) from anatomical
//    cross-sections: four elliptical quadrants (front, lateral, back, medial) per height plus muscle
//    and bone landmarks (calf heads, tibialis, shin, patella, popliteal hollow, VMO, Achilles).
//    The top ring tucks inside the shorts hem and the bottom inside the shoe collar.
// 3. Skin it to UpLeg / Leg / Foot with a knee blend that is long in front and short behind.
// 4. UV it onto a freshly painted skin swatch (the old trouser texture area), with a flat normal map
//    there, and repaint the remaining shorts fabric black so the hem is clean.
import { io, analyse, boundary } from "./legs-common.mjs";
import { PNG } from "pngjs";
import fs from "node:fs";
import sharp from "sharp";

const [src, dst, profPath] = process.argv.slice(2);
const doc = await io.read(src);
const { root, prim, pos, J, W, joints, ji, keep } = analyse(doc);
const uv0 = prim.getAttribute("TEXCOORD_0").getArray();
const nrm0 = prim.getAttribute("NORMAL").getArray();
const P = profPath ? JSON.parse(fs.readFileSync(profPath, "utf8")) : {};

/* ---------- bind-pose joints (mesh space) ---------- */
const skin = root.listSkins()[0];
const ibm = skin.getInverseBindMatrices().getArray();
function jointPos(name) {
  const k = joints.findIndex((j) => j.getName() === `mixamorig:${name}`);
  const a = ibm.slice(16 * k, 16 * k + 16);
  const [a00, a01, a02, a10, a11, a12, a20, a21, a22] = [a[0], a[1], a[2], a[4], a[5], a[6], a[8], a[9], a[10]];
  const det = a00 * (a11 * a22 - a12 * a21) - a01 * (a10 * a22 - a12 * a20) + a02 * (a10 * a21 - a11 * a20);
  const i00 = (a11 * a22 - a12 * a21) / det, i01 = -(a01 * a22 - a02 * a21) / det, i02 = (a01 * a12 - a02 * a11) / det;
  const i10 = -(a10 * a22 - a12 * a20) / det, i11 = (a00 * a22 - a02 * a20) / det, i12 = -(a00 * a12 - a02 * a10) / det;
  const i20 = (a10 * a21 - a11 * a20) / det, i21 = -(a00 * a21 - a01 * a20) / det, i22 = (a00 * a11 - a01 * a10) / det;
  const [tx, ty, tz] = [a[12], a[13], a[14]];
  return [-(i00 * tx + i10 * ty + i20 * tz), -(i01 * tx + i11 * ty + i21 * tz), -(i02 * tx + i12 * ty + i22 * tz)];
}

/* ---------- anatomical profile (cm), by height in metres ---------- */
// y, front, lateral, back, medial: half-extents of the cross-section from the bone axis
const ROWS = P.rows ?? [
  [0.085, 3.2, 3.5, 3.4, 3.4],
  [0.115, 2.9, 3.15, 3.2, 3.25],
  [0.14, 2.55, 2.8, 3.05, 2.95],
  [0.165, 2.45, 2.65, 2.95, 2.8],
  [0.195, 2.45, 2.75, 3.2, 2.95],
  [0.23, 2.55, 3.05, 3.75, 3.35],
  [0.27, 2.7, 3.5, 4.6, 3.9],
  [0.31, 2.85, 4.0, 5.4, 4.45],
  [0.35, 2.95, 4.4, 6.0, 4.85],
  [0.39, 3.05, 4.65, 6.4, 5.1],
  [0.42, 3.1, 4.75, 6.55, 5.15],
  [0.45, 3.2, 4.75, 6.4, 5.05],
  [0.48, 3.35, 4.65, 5.9, 4.85],
  [0.51, 3.6, 4.6, 5.15, 4.75],
  [0.54, 4.0, 4.75, 4.55, 4.85],
  [0.565, 4.45, 4.95, 4.4, 5.1],
  [0.59, 4.7, 5.15, 4.55, 5.4],
  [0.615, 4.75, 5.35, 4.95, 5.85],
  [0.645, 5.0, 5.7, 5.6, 6.3],
  [0.68, 5.5, 6.15, 6.3, 6.75],
  [0.715, 6.0, 6.6, 6.9, 7.1],
  [0.75, 6.4, 7.0, 7.3, 7.3],
  [0.79, 6.6, 7.1, 7.5, 7.4],
];
// landmarks: angle (deg; 0 front, 90 lateral, 180 back, 270 medial), height, spreads, amplitude (cm)
const BUMPS = P.bumps ?? [
  { name: "gastrocnemius medial head", th: 212, y: 0.43, sth: 32, sy: 0.055, a: 0.55 },
  { name: "gastrocnemius lateral head", th: 148, y: 0.445, sth: 26, sy: 0.045, a: 0.35 },
  { name: "tibialis anterior", th: 50, y: 0.42, sth: 22, sy: 0.09, a: 0.3 },
  { name: "medial tibial surface", th: 320, y: 0.33, sth: 25, sy: 0.12, a: -0.25 },
  { name: "patella", th: 0, y: 0.592, sth: 24, sy: 0.018, a: 0.45 },
  { name: "popliteal hollow", th: 180, y: 0.575, sth: 30, sy: 0.022, a: -0.35 },
  { name: "vastus medialis", th: 300, y: 0.628, sth: 28, sy: 0.03, a: 0.45 },
  { name: "vastus lateralis", th: 70, y: 0.68, sth: 35, sy: 0.06, a: 0.25 },
  { name: "medial hamstring tendon", th: 210, y: 0.6, sth: 12, sy: 0.03, a: 0.15 },
  { name: "lateral hamstring tendon", th: 150, y: 0.6, sth: 12, sy: 0.03, a: 0.15 },
  { name: "achilles", th: 180, y: 0.17, sth: 20, sy: 0.04, a: 0.1 },
  { name: "achilles hollow medial", th: 212, y: 0.165, sth: 14, sy: 0.03, a: -0.15 },
  { name: "achilles hollow lateral", th: 148, y: 0.165, sth: 14, sy: 0.03, a: -0.15 },
];
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/* monotone cubic (Fritsch-Carlson) through the rows, per column: smooth slopes, no ribs, no overshoot */
const COLS = [1, 2, 3, 4].map((k) => {
  const xs = ROWS.map((r) => r[0]), ys = ROWS.map((r) => r[k]);
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
  return (y) => {
    if (y <= xs[0]) return ys[0];
    if (y >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (y > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (y - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
});
const rowAt = (y) => COLS.map((f) => f(y));
const D = Math.PI / 180;
const angDiff = (a, b) => { let d = (a - b) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };
function anatR(thDeg, y) {
  const [F, L, B, M] = rowAt(y);
  const c = Math.cos(thDeg * D), s = Math.sin(thDeg * D);
  const ax = c >= 0 ? F : B, ay = s >= 0 ? L : M;
  let r = 1 / Math.sqrt((c / ax) ** 2 + (s / ay) ** 2);
  for (const b of BUMPS) r += b.a * Math.exp(-0.5 * (angDiff(thDeg, b.th) / b.sth) ** 2 - 0.5 * ((y - b.y) / b.sy) ** 2);
  return r; // cm
}

/* ---------- the rings it must meet: shorts hem and shoe collar ---------- */
const edges = boundary(pos, keep);
function ringFn(side, axisAt, ylo, yhi) {
  // boundary edges of this leg in [ylo, yhi], as polar segments around the bone axis
  const segs = [];
  for (const e of edges) {
    const pa = [pos[3 * e.a], pos[3 * e.a + 1], pos[3 * e.a + 2], e.a], pb = [pos[3 * e.b], pos[3 * e.b + 1], pos[3 * e.b + 2], e.b];
    if (Math.sign(pa[0]) !== side || Math.sign(pb[0]) !== side) continue;
    if (Math.abs(pa[0]) < 0.004 || pa[1] < ylo || pa[1] > yhi || pb[1] < ylo || pb[1] > yhi) continue;
    segs.push([pa, pb]);
  }
  if (!segs.length) throw new Error(`no ring in ${ylo}..${yhi}`);
  // radius (cm) and height of the ring where a ray at angle th from the axis crosses it
  return (thDeg) => {
    const ay = (segs[0][0][1] + segs[0][1][1]) / 2;
    const [cx, , cz] = axisAt(ay);
    const dx = Math.sin(thDeg * D) * side, dz = Math.cos(thDeg * D);
    let best = null;
    for (const [pa, pb] of segs) {
      // solve c + t*d = pa + u*(pb - pa) in xz
      const ex = pb[0] - pa[0], ez = pb[2] - pa[2];
      const den = dx * (-ez) - dz * (-ex);
      if (Math.abs(den) < 1e-9) continue;
      const qx = pa[0] - cx, qz = pa[2] - cz;
      const t = (qx * (-ez) - qz * (-ex)) / den;
      const u = (dx * qz - dz * qx) / den;
      if (t <= 0 || u < -1e-6 || u > 1 + 1e-6) continue;
      if (!best || t > best.t) best = { t, y: pa[1] + (pb[1] - pa[1]) * u, ia: pa[3], ib: pb[3], u };
    }
    if (!best) return null;
    // the ring's skin weights at that point, as a joint -> weight map
    const w = new Map();
    for (const [i, f] of [[best.ia, 1 - best.u], [best.ib, best.u]]) for (let q = 0; q < 4; q++) if (W[4 * i + q] > 0) w.set(J[4 * i + q], (w.get(J[4 * i + q]) || 0) + W[4 * i + q] * f);
    return { r: best.t * 100, y: best.y, w };
  };
}

/* ---------- texture swatches ---------- */
const mat = root.listMaterials()[0];
const texBase = mat.getBaseColorTexture(), texN = mat.getNormalTexture(), texMR = mat.getMetallicRoughnessTexture();
const base = PNG.sync.read(Buffer.from(texBase.getImage()));
const nmap = PNG.sync.read(Buffer.from(texN.getImage()));
const mr = PNG.sync.read(Buffer.from(texMR.getImage()));
const rasterUV = (img, tri, fn, pad = 1.5) => {
  const [a, b, c] = tri.map(([u, v]) => [u * img.width, v * img.height]);
  const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]) - pad)), x1 = Math.min(img.width - 1, Math.ceil(Math.max(a[0], b[0], c[0]) + pad));
  const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]) - pad)), y1 = Math.min(img.height - 1, Math.ceil(Math.max(a[1], b[1], c[1]) + pad));
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(area) < 1e-9) return;
  const edge = (p, q, x, y) => ((q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0])) / Math.hypot(q[0] - p[0], q[1] - p[1]);
  const sgn = Math.sign(area);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, py = y + 0.5;
    if (sgn * edge(a, b, px, py) >= -pad && sgn * edge(b, c, px, py) >= -pad && sgn * edge(c, a, px, py) >= -pad) fn(4 * (y * img.width + x));
  }
};
const median = (arr) => { const s = [...arr].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
// her skin: texels under the forearms and upper arms
const armJ = new Set(["LeftForeArm", "RightForeArm", "LeftArm", "RightArm"].map((n) => ji(n)));
const skinSamples = { base: [[], [], []], mr: [[], [], []] };
for (const t of keep) {
  if (!t.every((i) => { let w = 0; for (let q = 0; q < 4; q++) if (armJ.has(J[4 * i + q])) w += W[4 * i + q]; return w > 0.9; })) continue;
  const u = (uv0[2 * t[0]] + uv0[2 * t[1]] + uv0[2 * t[2]]) / 3, v = (uv0[2 * t[0] + 1] + uv0[2 * t[1] + 1] + uv0[2 * t[2] + 1]) / 3;
  for (const [img, key] of [[base, "base"], [mr, "mr"]]) {
    const o = 4 * (Math.floor(v * img.height) * img.width + Math.floor(u * img.width));
    for (let k = 0; k < 3; k++) skinSamples[key][k].push(img.data[o + k]);
  }
}
const SKIN = skinSamples.base.map(median), SKIN_MR = skinSamples.mr.map(median);
console.log("skin", SKIN, "skin mr", SKIN_MR, "samples", skinSamples.base[0].length);

// the swatch each leg is mapped onto: the old trouser area of the texture
const SW = { L: null, R: null };
{
  const box = { L: [1, 1, 0, 0], R: [1, 1, 0, 0] };
  const { drop } = analyse(doc);
  for (const t of drop) {
    const side = pos[3 * t[0]] > 0 ? "L" : "R";
    for (const i of t) {
      const u = uv0[2 * i], v = uv0[2 * i + 1];
      if (v < 0.55) continue; // the small bare-ankle islands elsewhere are not reused
      const b = box[side];
      b[0] = Math.min(b[0], u); b[1] = Math.min(b[1], v); b[2] = Math.max(b[2], u); b[3] = Math.max(b[3], v);
    }
  }
  for (const s of ["L", "R"]) { const [u0, v0, u1, v1] = box[s]; SW[s] = [u0 + 0.012, Math.max(v0 + 0.012, 0.622), Math.min(u1 - 0.012, s === "R" ? 0.3 : 1), Math.min(v1, 0.845) - 0.008]; }
  console.log("swatches", JSON.stringify(SW));
  // nothing that stays may sample the swatches
  const bad = [];
  for (const t of keep) for (const s of ["L", "R"]) {
    const [u0, v0, u1, v1] = SW[s];
    const inside = t.some((i) => uv0[2 * i] > u0 && uv0[2 * i] < u1 && uv0[2 * i + 1] > v0 && uv0[2 * i + 1] < v1);
    if (inside) bad.push([s, t.map((i) => [+uv0[2 * i].toFixed(3), +uv0[2 * i + 1].toFixed(3), +pos[3 * i].toFixed(3), +pos[3 * i + 1].toFixed(3), +pos[3 * i + 2].toFixed(3)])]);
  }
  if (bad.length) { console.log("kept triangles touching swatches:", bad.length, JSON.stringify(bad.slice(0, 12))); if (!P.allowOverlap) process.exit(1); }
}
// paint: skin with gentle low-frequency variation and fine grain
let seed = 11;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const lowFreq = (u, v) => 0.5 * Math.sin(u * 37 + v * 11) * Math.sin(v * 29 - u * 7) + 0.5 * Math.sin(u * 13 - v * 41);
for (const s of ["L", "R"]) {
  const [u0, v0, u1, v1] = SW[s];
  for (const [img, kind] of [[base, "base"], [nmap, "n"], [mr, "mr"]]) {
    const X0 = Math.floor((u0 - 0.008) * img.width), X1 = Math.ceil((u1 + 0.008) * img.width), Y0 = Math.floor((v0 - 0.008) * img.height), Y1 = Math.ceil((v1 + 0.006) * img.height);
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const o = 4 * (y * img.width + x);
      if (kind === "base") {
        const k = 1 + 0.025 * lowFreq(x / img.width, y / img.height) + 0.006 * (rnd() - 0.5);
        for (let c = 0; c < 3; c++) img.data[o + c] = Math.max(0, Math.min(255, Math.round(SKIN[c] * k)));
      } else if (kind === "n") {
        img.data[o] = 128; img.data[o + 1] = 128; img.data[o + 2] = 255;
      } else for (let c = 0; c < 3; c++) img.data[o + c] = SKIN_MR[c];
      img.data[o + 3] = 255;
    }
  }
}
// the shorts left above the hem: plain black fabric (their lowest band was painted as skin)
{
  const shorts = [];
  for (const t of keep) {
    if (!t.every((i) => Math.abs(pos[3 * i]) > 0.004 && pos[3 * i + 1] > 0.74 && pos[3 * i + 1] < 0.95)) continue;
    const u = (uv0[2 * t[0]] + uv0[2 * t[1]] + uv0[2 * t[2]]) / 3, v = (uv0[2 * t[0] + 1] + uv0[2 * t[1] + 1] + uv0[2 * t[2] + 1]) / 3;
    if (v < 0.84 || u > 0.68) continue; // only the leg-of-the-shorts islands
    shorts.push(t);
  }
  const ink = [[], [], []];
  for (const t of shorts) {
    const u = (uv0[2 * t[0]] + uv0[2 * t[1]] + uv0[2 * t[2]]) / 3, v = (uv0[2 * t[0] + 1] + uv0[2 * t[1] + 1] + uv0[2 * t[2] + 1]) / 3;
    const o = 4 * (Math.floor(v * base.height) * base.width + Math.floor(u * base.width));
    const lum = 0.3 * base.data[o] + 0.59 * base.data[o + 1] + 0.11 * base.data[o + 2];
    if (lum < 60) for (let k = 0; k < 3; k++) ink[k].push(base.data[o + k]);
  }
  const INK = ink.map(median);
  let painted = 0;
  for (const t of shorts) {
    const tri = t.map((i) => [uv0[2 * i], uv0[2 * i + 1]]);
    rasterUV(base, tri, (o) => {
      const r = base.data[o], g = base.data[o + 1], b = base.data[o + 2];
      if (r > g * 1.1 && r - b > 30 && r > 50) { base.data[o] = INK[0]; base.data[o + 1] = INK[1]; base.data[o + 2] = INK[2]; painted++; }
    }, 2);
  }
  console.log("shorts ink", INK, "repainted texels", painted);
}
// base colour as a high-quality JPEG (no alpha is used); the small normal and roughness maps stay PNG
texBase.setImage(await sharp(PNG.sync.write(base)).jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer()).setMimeType("image/jpeg").setURI("Ch03_1001_Diffuse.jpg");
texN.setImage(await sharp(PNG.sync.write(nmap)).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer());
texMR.setImage(await sharp(PNG.sync.write(mr)).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer());

/* ---------- loft the legs ---------- */
const SEG = P.seg ?? 40, DY = P.dy ?? 0.008, Y0 = 0.085, Y1 = P.top ?? 0.772; // the top ring sits 1.5-2.5 cm up inside the shorts
const newPos = [], newNrm = [], newUv = [], newJ = [], newW = [], newIdx = [];
const base0 = pos.length / 3;
for (const side of [1, -1]) {
  const S = side > 0 ? "Left" : "Right", key = side > 0 ? "L" : "R";
  const A = jointPos(`${S}Foot`), K = jointPos(`${S}Leg`), H = jointPos(`${S}UpLeg`);
  const axisAt = (y) => {
    const [a, b] = y <= K[1] ? [A, K] : [K, H];
    const t = (y - a[1]) / (b[1] - a[1]);
    return [a[0] + (b[0] - a[0]) * t, y, a[2] + (b[2] - a[2]) * t];
  };
  const hem = ringFn(side, axisAt, 0.7, 0.8);
  const collar = ringFn(side, axisAt, 0.095, 0.135);
  const jUp = ji(`${S}UpLeg`), jLeg = ji(`${S}Leg`), jFoot = ji(`${S}Foot`);
  const rings = Math.round((Y1 - Y0) / DY);
  const surf = (thDeg, y) => {
    let r = anatR(thDeg, y);
    const h = hem(thDeg);
    if (h) {
      const tuck = 0.965 * h.r;
      r += (tuck - r) * smoothstep(h.y - 0.05, h.y - 0.004, y); // meet the hem just inside it
      r += (0.92 * h.r - r) * smoothstep(h.y, h.y + 0.012, y); // and stay inside the shorts above it
    }
    const c = collar(thDeg);
    if (c) {
      const inside = Math.min(r, 0.93 * c.r);
      r += (inside - r) * (1 - smoothstep(c.y + 0.004, c.y + 0.03, y)); // slip into the shoe
    }
    const [cx, , cz] = axisAt(y);
    return [cx + side * Math.sin(thDeg * D) * r / 100, y, cz + Math.cos(thDeg * D) * r / 100];
  };
  const [u0, v0, u1, v1] = SW[key];
  const first = base0 + newPos.length / 3;
  for (let ri = 0; ri <= rings; ri++) {
    const y = Y0 + ri * DY;
    for (let si = 0; si <= SEG; si++) {
      const th = (si / SEG) * 360 + 180; // seam at the back
      const p = surf(th, y);
      const e = 0.3, ey = 0.002;
      const pa = surf(th + e, y), pb = surf(th - e, y), pc = surf(th, y + ey), pd = surf(th, y - ey);
      const tx = [pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]], ty = [pc[0] - pd[0], pc[1] - pd[1], pc[2] - pd[2]];
      let n = [ty[1] * tx[2] - ty[2] * tx[1], ty[2] * tx[0] - ty[0] * tx[2], ty[0] * tx[1] - ty[1] * tx[0]];
      const [cx, , cz] = axisAt(y);
      if (n[0] * (p[0] - cx) + n[2] * (p[2] - cz) < 0) n = n.map((v) => -v);
      const ln = Math.hypot(...n) || 1;
      newPos.push(...p);
      newNrm.push(...n.map((v) => v / ln));
      newUv.push(u0 + (u1 - u0) * (si / SEG), v1 - (v1 - v0) * (ri / rings));
      // weights: knee blend long in front, short behind; ankle shares the foot like the shoe collar does
      const c = Math.cos(th * D);
      const hk = 0.045 + 0.02 * c;
      const wLegK = 1 - smoothstep(K[1] - hk + 0.01, K[1] + hk, y);
      const wFoot = 0.72 * (1 - smoothstep(0.085, 0.165, y));
      const wl = wLegK * (1 - wFoot), wu = 1 - wLegK, wf = wFoot;
      const wm = new Map([[jUp, wu], [jLeg, wl], [jFoot, wf]]);
      // near the hem, take on the shorts' own weights so the fabric and the thigh move as one
      const h = hem(th);
      if (h) {
        const k = smoothstep(h.y - 0.06, h.y - 0.005, y);
        if (k > 0) {
          for (const [j, v] of wm) wm.set(j, v * (1 - k));
          for (const [j, v] of h.w) wm.set(j, (wm.get(j) || 0) + v * k);
        }
      }
      const top = [...wm.entries()].filter(([, v]) => v > 1e-4).sort((p, q) => q[1] - p[1]).slice(0, 4);
      const sum = top.reduce((a, [, v]) => a + v, 0);
      while (top.length < 4) top.push([0, 0]);
      newJ.push(...top.map(([j]) => j));
      newW.push(...top.map(([, v]) => v / sum));
    }
  }
  const legIdx = [];
  for (let ri = 0; ri < rings; ri++) for (let si = 0; si < SEG; si++) {
    const a = first + ri * (SEG + 1) + si, b = a + 1, c = a + SEG + 1, d = c + 1;
    legIdx.push(a, b, d, a, d, c);
  }
  // winding per leg (the right leg is the mirror image): the face normal must agree with the vertex normal
  const P3 = (i) => { const k = i - base0; return [newPos[3 * k], newPos[3 * k + 1], newPos[3 * k + 2]]; };
  let agree = 0;
  for (let t = 0; t < legIdx.length; t += 3 * 97) {
    const [pa, pb, pc] = [legIdx[t], legIdx[t + 1], legIdx[t + 2]].map(P3);
    const u = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], v = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const fn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const k = legIdx[t] - base0;
    agree += Math.sign(fn[0] * newNrm[3 * k] + fn[1] * newNrm[3 * k + 1] + fn[2] * newNrm[3 * k + 2]);
  }
  if (agree < 0) for (let t = 0; t < legIdx.length; t += 3) [legIdx[t + 1], legIdx[t + 2]] = [legIdx[t + 2], legIdx[t + 1]];
  console.log(S, "winding", agree < 0 ? "flipped" : "kept");
  newIdx.push(...legIdx);
}
/* ---------- write ---------- */
const cat = (old, add, Ctor) => { const o = new Ctor(old.length + add.length); o.set(old); o.set(add, old.length); return o; };
prim.getAttribute("POSITION").setArray(cat(pos, newPos, Float32Array));
prim.getAttribute("NORMAL").setArray(cat(nrm0, newNrm, Float32Array));
prim.getAttribute("TEXCOORD_0").setArray(cat(uv0, newUv, Float32Array));
const jOld = prim.getAttribute("JOINTS_0").getArray();
prim.getAttribute("JOINTS_0").setArray(cat(jOld, newJ, jOld.constructor));
const wOld = prim.getAttribute("WEIGHTS_0").getArray();
prim.getAttribute("WEIGHTS_0").setArray(cat(wOld, newW, wOld.constructor));
prim.getIndices().setArray(new Uint32Array([...keep.flat(), ...newIdx]));
await io.write(dst, doc);
console.log("legs:", newPos.length / 3, "verts", newIdx.length / 3, "tris; kept", keep.length, "tris; wrote", dst, fs.statSync(dst).size);
