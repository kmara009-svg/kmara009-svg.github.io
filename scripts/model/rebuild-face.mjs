// Give the runner a new face and hair: big painted eyes, brows, blush and lips on a face texture of its own, sleek
// pulled-back hair with a bun, a patterned headband with a bow, ears and gold studs.
// The second of two steps: its input is the output of rebuild-legs.mjs (the original head, rebuilt legs).
//   npm i --no-save @gltf-transform/core @gltf-transform/extensions sharp
//   node scripts/model/rebuild-legs.mjs ... /tmp/runner-legs.glb   (see its header), or, for the current legs,
//   git show 167a41b:public/models/runner.glb > /tmp/runner-legs.glb
//   node scripts/model/rebuild-face.mjs /tmp/runner-legs.glb public/models/runner.glb
// 1. Delete the old hair (the island holding the highest vertex: a cap plus puffs) and the slit eyelids and eyeballs.
// 2. Move the face (the front mask, lips and nose tip) to a primitive of its own: welded, eye sockets refilled with
//    a smooth biharmonic patch domed like a lid over an eyeball, cheeks softened, and given cylindrical uvs onto a
//    new texture (the underside of the chin, where a cylinder folds, gets a planar chart of its own).
// 3. Paint that texture in body space (face-paint.mjs), blending into the neck's colour along the seam.
// 4. Grow a hair shell from the head's open edge (the hairline is pulled down onto the forehead and the nape)
//    towards a pole at the back of the crown, shrink-wrapped over the skull; it stops just short of the pole and a
//    bun closes it.
// 5. Lay a headband where a tilted plane crosses the hair and tie a bow on it.
// 6. Hinge an ear on the hair behind each side of the face, swung out until it clears the hair, with a gold stud.
// 7. Drop the model's own animations (SambaDance and TPose, about 1.4 MB): the app plays the run, walk and idle clips
//    in public/models/*.json instead.
// Everything new is skinned to the head (the nape edge borrows the neck's weights).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsIOR, KHRMaterialsSpecular } from "@gltf-transform/extensions";
import sharp from "sharp";
import { v3, uf, weldIds, boundaryLoops, vertexNormals, raster, dilate, smooth, clamp, mix, rayTri, closestOnTri, slerp, resampleClosed, noise1, noise1p } from "./face-lib.mjs";
import { paintFace, paintEar, SKIN } from "./face-paint.mjs";

const [src, dst] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const root = doc.getRoot();
const mesh = root.listMeshes()[0];
const prim = mesh.listPrimitives()[0];
const body = prim.getMaterial();
const POS = prim.getAttribute("POSITION").getArray();
const NRM = prim.getAttribute("NORMAL").getArray();
const UV = prim.getAttribute("TEXCOORD_0").getArray();
const JNT = prim.getAttribute("JOINTS_0").getArray();
const WGT = prim.getAttribute("WEIGHTS_0").getArray();
const IDX = prim.getIndices().getArray();
const nV = POS.length / 3, nT = IDX.length / 3;
const P = (i) => [POS[3 * i] * 100, POS[3 * i + 1] * 100, POS[3 * i + 2] * 100];
const W = weldIds(POS);
const joints = root.listSkins()[0].listJoints();
const HEAD = joints.findIndex((j) => j.getName() === "mixamorig:Head");

/* ======================= 1. what goes ======================= */
const isl = uf(nV);
for (let i = 0; i < nV; i++) isl.union(i, W[i]);
for (let t = 0; t < nT; t++) { isl.union(IDX[3 * t], IDX[3 * t + 1]); isl.union(IDX[3 * t], IDX[3 * t + 2]); }
let topV = 0;
for (let i = 1; i < nV; i++) if (POS[3 * i + 1] > POS[3 * topV + 1]) topV = i;
const hairIsl = isl.find(topV);
const triIsl = (t) => isl.find(IDX[3 * t]);
const cnt = new Map();
for (let t = 0; t < nT; t++) cnt.set(triIsl(t), (cnt.get(triIsl(t)) || 0) + 1);
const bodyIsl = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0];

const comp = uf(nV);
for (let t = 0; t < nT; t++) { comp.union(IDX[3 * t], IDX[3 * t + 1]); comp.union(IDX[3 * t], IDX[3 * t + 2]); }
const pieces = new Map();
for (let t = 0; t < nT; t++) {
  if (triIsl(t) !== bodyIsl) continue;
  const r = comp.find(IDX[3 * t]);
  let g = pieces.get(r);
  if (!g) pieces.set(r, (g = { tris: [], min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }));
  g.tris.push(t);
  for (let k = 0; k < 3; k++) { const p = P(IDX[3 * t + k]); for (let a = 0; a < 3; a++) { g.min[a] = Math.min(g.min[a], p[a]); g.max[a] = Math.max(g.max[a], p[a]); } }
}
const dead = new Uint8Array(nT), faceTri = new Uint8Array(nT);
for (let t = 0; t < nT; t++) if (triIsl(t) === hairIsl) dead[t] = 1;
for (const g of pieces.values()) {
  const inner = Math.min(Math.abs(g.min[0]), Math.abs(g.max[0])), outer = Math.max(Math.abs(g.min[0]), Math.abs(g.max[0]));
  const eyePiece = g.tris.length < 150 && g.min[1] > 143.5 && g.max[1] < 147 && Math.sign(g.min[0]) === Math.sign(g.max[0]) && inner > 1.8 && outer < 8.5;
  if (eyePiece) for (const t of g.tris) dead[t] = 1;
  else if (g.min[1] > 133.5 && g.max[0] < 12 && g.min[0] > -12) for (const t of g.tris) faceTri[t] = 1;
}

/* ======================= 2. the face primitive ======================= */
const F = { pos: [], nrm: [], j: [], w: [], src: [] };
const addV = (p, n, j, w, s) => { F.pos.push(p); F.nrm.push(n); F.j.push(j); F.w.push(w); F.src.push(s); return F.pos.length - 1; };
const fv = new Map();
const fIdx = [], isFill = []; // isFill: the triangle fills an eye hole (not from the old mesh)
for (let t = 0; t < nT; t++) {
  if (!faceTri[t] || dead[t]) continue;
  const tri = [];
  for (let k = 0; k < 3; k++) {
    const i = IDX[3 * t + k], w = W[i];
    if (!fv.has(w)) fv.set(w, addV(P(i), [NRM[3 * i], NRM[3 * i + 1], NRM[3 * i + 2]], [...JNT.slice(4 * i, 4 * i + 4)], [...WGT.slice(4 * i, 4 * i + 4)], i));
    tri.push(fv.get(w));
  }
  fIdx.push(tri);
  isFill.push(false);
}
// eye holes: spider-web fill
// the zone stops short of the side of the head on the outside (ZONE_OUT), where a front-on height field fails
const EYE_C = [4.95, 145.4], ZONE = [3.45, 2.45], ZONE_OUT = 3.0;
const zoneD = (p) => {
  const X = Math.abs(p[0]) - EYE_C[0];
  return Math.cbrt(Math.abs(X / (X > 0 ? ZONE_OUT : ZONE[0])) ** 3 + Math.abs((p[1] - EYE_C[1]) / ZONE[1]) ** 3);
};
const origTris = fIdx.map((tri) => tri.map((i) => [...F.pos[i]]));
for (const l of boundaryLoops(fIdx)) {
  const c = l.reduce((a, i) => v3.add(a, F.pos[i]), [0, 0, 0]).map((x) => x / l.length);
  if (!(l.length < 120 && Math.abs(c[0]) > 2 && Math.abs(c[0]) < 8 && c[1] > 143 && c[1] < 147.5)) continue;
  const RINGS = 5, rings = [l];
  for (let k = 1; k < RINGS; k++) rings.push(l.map((i) => { const b = F.pos[i], s = 1 - k / RINGS; return addV([c[0] + (b[0] - c[0]) * s, c[1] + (b[1] - c[1]) * s, c[2]], [0, 0, 1], F.j[i], F.w[i], -1); }));
  const centre = addV([...c], [0, 0, 1], F.j[l[0]], F.w[l[0]], -1);
  for (let k = 0; k < RINGS; k++) for (let i = 0; i < l.length; i++) {
    const a = rings[k][i], b = rings[k][(i + 1) % l.length];
    if (k === RINGS - 1) { fIdx.push([b, a, centre]); isFill.push(true); continue; }
    const a2 = rings[k + 1][i], b2 = rings[k + 1][(i + 1) % l.length];
    fIdx.push([b, a, a2], [b, a2, b2]); isFill.push(true, true);
  }
}
// biharmonic patch over each eye zone, the face outside it as the boundary (so height and slope carry on
// smoothly), plus a gentle dome like a lid over an eyeball. Solved exactly with conjugate gradients on a regular
// grid.
{
  const BUMP = 0.42, GH = 0.12, GX = Math.ceil((ZONE[0] + 0.6) / GH), GY = Math.ceil((ZONE[1] + 0.6) / GH);
  const surfZ = (x, y) => { let best = -1e9; for (const [a, b, c] of origTris) { const t = rayTri([x, y, 50], [0, 0, -1], a, b, c); if (t > 0) best = Math.max(best, 50 - t); } return best; };
  for (const side of [-1, 1]) {
    const nx = 2 * GX + 1, ny = 2 * GY + 1, z = new Float64Array(nx * ny), unknown = new Uint8Array(nx * ny);
    const gx = (i) => side * (EYE_C[0] + (i - GX) * GH), gy = (j) => EYE_C[1] + (j - GY) * GH;
    const missing = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (zoneD([gx(i), gy(j)]) < 1) { unknown[k] = 1; continue; }
      z[k] = surfZ(gx(i), gy(j));
      if (z[k] < -1e8) missing.push(k);
    }
    // cells beyond the side of the face (no surface under them) take their neighbours' height
    const have = new Uint8Array(nx * ny).map((_, k) => (unknown[k] ? 0 : 1));
    for (const k of missing) have[k] = 0;
    for (let left = missing.length; left > 0; ) {
      left = 0;
      for (const k of missing) {
        if (have[k]) continue;
        const i = k % nx, j = (k - i) / nx;
        let sum = 0, cnt = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
          const q = jj * nx + ii;
          if (have[q]) { sum += z[q]; cnt++; }
        }
        if (cnt) { z[k] = sum / cnt; have[k] = 2; } else left++;
      }
      for (const k of missing) if (have[k] === 2) have[k] = 1;
    }
    // biharmonic stencil: 20 z - 8 (edge neighbours) + 2 (diagonals) + (two-away); known cells move to the right side
    const STENCIL = [[0, 0, 20], [-1, 0, -8], [1, 0, -8], [0, -1, -8], [0, 1, -8], [-1, -1, 2], [1, -1, 2], [-1, 1, 2], [1, 1, 2], [-2, 0, 1], [2, 0, 1], [0, -2, 1], [0, 2, 1]];
    const ids = [];
    for (let k = 0; k < z.length; k++) if (unknown[k]) ids.push(k);
    const apply = (x, out) => {
      for (const k of ids) {
        const i = k % nx, j = (k - i) / nx;
        let acc = 0;
        for (const [di, dj, w] of STENCIL) { const q = (j + dj) * nx + (i + di); if (unknown[q]) acc += w * x[q]; }
        out[k] = acc;
      }
    };
    const b = new Float64Array(z.length);
    for (const k of ids) {
      const i = k % nx, j = (k - i) / nx;
      for (const [di, dj, w] of STENCIL) { const q = (j + dj) * nx + (i + di); if (!unknown[q]) b[k] -= w * z[q]; }
    }
    const x = new Float64Array(z.length), r = new Float64Array(z.length), pv = new Float64Array(z.length), Ap = new Float64Array(z.length);
    for (const k of ids) { r[k] = b[k]; pv[k] = r[k]; }
    let rr = 0; for (const k of ids) rr += r[k] * r[k];
    const rr0 = rr;
    let it = 0;
    for (; it < 5000 && rr > 1e-24 * rr0; it++) {
      apply(pv, Ap);
      let pAp = 0; for (const k of ids) pAp += pv[k] * Ap[k];
      const alpha = rr / pAp;
      for (const k of ids) { x[k] += alpha * pv[k]; r[k] -= alpha * Ap[k]; }
      let rr2 = 0; for (const k of ids) rr2 += r[k] * r[k];
      for (const k of ids) pv[k] = r[k] + (rr2 / rr) * pv[k];
      rr = rr2;
    }
    if (rr > 1e-20 * rr0) throw new Error(`eye patch solve did not converge (${it} iterations)`);
    for (const k of ids) z[k] = x[k];
    const at = (i, j) => z[clamp(j, 0, ny - 1) * nx + clamp(i, 0, nx - 1)];
    const sample = (px, py) => {
      const fi = (Math.abs(px) - EYE_C[0]) / GH + GX, fj = (py - EYE_C[1]) / GH + GY;
      const i0 = clamp(Math.floor(fi), 0, nx - 2), j0 = clamp(Math.floor(fj), 0, ny - 2), u = fi - i0, v = fj - j0;
      return at(i0, j0) * (1 - u) * (1 - v) + at(i0 + 1, j0) * u * (1 - v) + at(i0, j0 + 1) * (1 - u) * v + at(i0 + 1, j0 + 1) * u * v;
    };
    const height = (px, py) => { const d = zoneD([px, py]); return sample(px, py) + (d < 1 ? BUMP * Math.pow(1 - d * d, 2) : 0); };
    F.pos.forEach((p, i) => {
      if (Math.sign(p[0]) !== side || zoneD(p) >= 1) return;
      const e = 0.05, dx = (height(p[0] + e, p[1]) - height(p[0] - e, p[1])) / (2 * e), dy = (height(p[0], p[1] + e) - height(p[0], p[1] - e)) / (2 * e);
      p[2] = height(p[0], p[1]);
      F.nrm[i] = v3.norm([-dx, -dy, 1]);
    });
    console.log(`eye patch ${side > 0 ? "left" : "right"}: ${ids.length} cells, converged in ${it} iterations`);
  }
}
for (let t = 0; t < fIdx.length; t++) {
  if (!isFill[t]) continue;
  const [a, b, c] = fIdx[t];
  if (v3.cross(v3.sub(F.pos[b], F.pos[a]), v3.sub(F.pos[c], F.pos[a]))[2] < 0) fIdx[t] = [a, c, b];
}
// soften the cheeks (the old mesh has a crease from under each eye down to the jaw), then take normals from the
// geometry, keeping the old ones along the neck seam so the shading carries straight across it
{
  const nb = F.pos.map(() => new Set());
  for (const [a, b, c] of fIdx) { nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  const border = new Set(boundaryLoops(fIdx).flat());
  const wgt = F.pos.map((p, i) => (border.has(i) || zoneD(p) < 1.1 ? 0 : smooth(1, 0.5, Math.hypot((Math.abs(p[0]) - 5.9) / 3.1, (p[1] - 141.6) / 3.0))));
  const step = (lam) => {
    const d = F.pos.map((p, i) => { if (!wgt[i]) return null; let m = [0, 0, 0]; for (const j of nb[i]) m = v3.add(m, F.pos[j]); return v3.mul(v3.sub(v3.mul(m, 1 / nb[i].size), p), lam * wgt[i]); });
    F.pos.forEach((p, i) => { if (d[i]) { p[0] += d[i][0]; p[1] += d[i][1]; p[2] += d[i][2]; } });
  };
  for (let it = 0; it < 24; it++) { step(0.5); step(-0.53); }
  // fuller, rounder cheeks, fuller lips and a softer, rounder jaw
  const N0 = vertexNormals(new Float32Array(F.pos.flat()), fIdx.flat());
  F.pos.forEach((p, i) => {
    if (border.has(i) || zoneD(p) < 1) return;
    const h = 0.34 * Math.exp(-(((Math.abs(p[0]) - 5.3) / 2.0) ** 2) - (((p[1] - 141.3) / 1.8) ** 2))
      + 0.3 * Math.exp(-((p[0] / 2.1) ** 2) - (((p[1] - 139.8) / 0.8) ** 2)) * smooth(0.55, 0.85, N0[3 * i + 2]) // front of the lips only, not inside the mouth
      + 0.45 * Math.exp(-(((Math.abs(p[0]) - 5.0) / 2.2) ** 2) - (((p[1] - 137.6) / 1.6) ** 2));
    p[0] += N0[3 * i] * h; p[1] += N0[3 * i + 1] * h; p[2] += N0[3 * i + 2] * h;
  });
  const N = vertexNormals(new Float32Array(F.pos.flat()), fIdx.flat());
  const seamV = [...border].filter((i) => F.pos[i][1] < 141.5).map((i) => F.pos[i]);
  F.pos.forEach((p, i) => {
    if (zoneD(p) < 1) return; // the eye patches keep their exact normals
    let d = 1e9; for (const q of seamV) d = Math.min(d, v3.len(v3.sub(p, q)));
    F.nrm[i] = v3.norm(v3.lerp(F.nrm[i], [N[3 * i], N[3 * i + 1], N[3 * i + 2]], smooth(0, 1.2, d)));
  });
}
// cylindrical uvs around a vertical axis behind the face
const ZC = -4, UA = (95 * Math.PI) / 180, YT = 158.5, YB = 133.5;
F.uv = F.pos.map((p) => [0.5 + Math.atan2(p[0], p[2] - ZC) / (2 * UA), (YT - p[1]) / (YT - YB)]);
// Under the chin the face turns downwards, where the cylinder squeezes it and folds it over itself. Those triangles
// get a chart of their own, a plan seen from below in a free corner of the texture (CHIN_BOX), with their own
// copies of the vertices they share with the rest of the face.
const FT = 1024;
const CHIN_BOX = [806, 8, 206, 196]; // x, y, w, h (px)
const uvArea = (t) => { const [a, b, c] = t.map((i) => F.uv[i]); return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); };
const faceNormal = (t) => v3.norm(v3.cross(v3.sub(F.pos[t[1]], F.pos[t[0]]), v3.sub(F.pos[t[2]], F.pos[t[0]])));
const cylSign = Math.sign(fIdx.reduce((acc, t) => acc + Math.sign(uvArea(t)) * (faceNormal(t)[2] > 0.5 ? 1 : 0), 0));
const isChin = fIdx.map((t) => {
  const n = faceNormal(t), y = (F.pos[t[0]][1] + F.pos[t[1]][1] + F.pos[t[2]][1]) / 3;
  return y < 138.5 && (n[1] < -0.45 || (n[1] < 0 && Math.sign(uvArea(t)) !== cylSign));
});
{
  const chinV = new Map(), chinPts = [];
  fIdx.forEach((t, k) => { if (isChin[k]) for (const i of t) if (!chinV.has(i)) { chinV.set(i, -1); chinPts.push(F.pos[i]); } });
  const xs = chinPts.map((p) => p[0]), zs = chinPts.map((p) => p[2]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const [bx, by, bw, bh] = CHIN_BOX, scale = Math.min(bw / (x1 - x0), bh / (z1 - z0));
  for (const i of chinV.keys()) {
    const j = addV([...F.pos[i]], [...F.nrm[i]], F.j[i], F.w[i], F.src[i]);
    F.uv[j] = [(bx + (F.pos[i][0] - x0) * scale) / FT, (by + (z1 - F.pos[i][2]) * scale) / FT];
    chinV.set(i, j);
  }
  fIdx.forEach((t, k) => { if (isChin[k]) fIdx[k] = t.map((i) => chinV.get(i)); });
  // checks: the chart does not fold, the rest of the face stays out of its box, and what folds in the cylinder now
  const chinTris = fIdx.filter((_, k) => isChin[k]);
  const chinSigns = new Set(chinTris.map((t) => Math.sign(uvArea(t))).filter((x) => x));
  if (chinSigns.size > 1) throw new Error("the chin chart folds");
  for (const [k, t] of fIdx.entries()) {
    if (isChin[k]) continue;
    for (const i of t) { const u = F.uv[i][0] * FT, v = F.uv[i][1] * FT; if (u > bx - 4 && u < bx + bw + 4 && v > by - 4 && v < by + bh + 4) throw new Error("the face overlaps the chin chart"); }
  }
  const folded = fIdx.filter((t, k) => !isChin[k] && Math.sign(uvArea(t)) === -cylSign);
  console.log(`chin chart: ${chinTris.length} triangles, ${scale.toFixed(1)} px/cm; ${folded.length} triangles still fold in the cylinder (lips and nose, under-the-lip and nostril surfaces)`);
}

/* ======================= 3. the face texture ======================= */
const EAR_BOX = [12, 6, 190, 190]; // a free corner of the face texture for the ears: x, y, w, h (px)
const faceTex = await (async () => {
  const { data: D, info } = await sharp(Buffer.from(body.getBaseColorTexture().getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const DW = info.width;
  const samp = (u, v) => {
    const x = u * DW - 0.5, y = v * DW - 0.5, x0 = clamp(Math.floor(x), 0, DW - 2), y0 = clamp(Math.floor(y), 0, DW - 2), fx = x - x0, fy = y - y0;
    return [0, 1, 2].map((k) => D[3 * (y0 * DW + x0) + k] * (1 - fx) * (1 - fy) + D[3 * (y0 * DW + x0 + 1) + k] * fx * (1 - fy) + D[3 * ((y0 + 1) * DW + x0) + k] * (1 - fx) * fy + D[3 * ((y0 + 1) * DW + x0 + 1) + k] * fx * fy);
  };
  // Along the seam with the neck the face blends into the neck's own colour (the body keeps its atlas there), so the
  // two meet without a step: each seam vertex takes the atlas colour it has on the neck side.
  const neckUV = new Map(); // welded position -> atlas uv on a kept body triangle
  for (let t = 0; t < nT; t++) {
    if (dead[t] || faceTri[t]) continue;
    for (let k = 0; k < 3; k++) { const i = IDX[3 * t + k]; if (!neckUV.has(W[i])) neckUV.set(W[i], [UV[2 * i], UV[2 * i + 1]]); }
  }
  const seam = boundaryLoops(fIdx).sort((a, b) => b.length - a.length)[0]
    .filter((i) => F.src[i] >= 0 && neckUV.has(W[F.src[i]]))
    .map((i) => ({ p: F.pos[i], c: samp(...neckUV.get(W[F.src[i]])) }));
  const seamInfo = (p) => {
    // distance to the seam and the neck colour there (inverse-distance blend of the nearest seam vertices)
    const near = seam.map((q) => ({ d: v3.len(v3.sub(p, q.p)), c: q.c })).sort((a, b) => a.d - b.d).slice(0, 3);
    let w = 0; const c = [0, 0, 0];
    for (const q of near) { const k = 1 / (q.d * q.d + 1e-4); w += k; for (let j = 0; j < 3; j++) c[j] += q.c[j] * k; }
    return { d: near[0].d, c: c.map((x) => x / w) };
  };
  const img = new Float32Array(FT * FT * 3), cov = new Uint8Array(FT * FT);
  const uvpx = new Float32Array(F.uv.flatMap((u) => [u[0] * FT, u[1] * FT]));
  raster(FT, FT, uvpx, fIdx.flat(), (px, py, l0, l1, l2, t) => {
    const tri = fIdx[t], i = py * FT + px;
    const p = [0, 1, 2].map((k) => F.pos[tri[0]][k] * l0 + F.pos[tri[1]][k] * l1 + F.pos[tri[2]][k] * l2);
    const s = seamInfo(p);
    img.set(paintFace(p, s.c, s.d), 3 * i);
    cov[i] = 1;
  });
  const [bx, by, bw, bh] = EAR_BOX;
  for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) {
    const i = y * FT + x;
    if (cov[i]) throw new Error("ear box overlaps the face");
    img.set(paintEar(((x + 0.5 - bx) / bw) * 2 - 1, 1 - ((y + 0.5 - by) / bh) * 2), 3 * i);
    cov[i] = 1;
  }
  dilate(img, cov, FT, FT, 6);
  for (let i = 0; i < FT * FT; i++) if (!cov[i]) img.set(SKIN, 3 * i);
  const u8 = Buffer.from(img.map((v) => clamp(Math.round(v), 0, 255)));
  return sharp(u8, { raw: { width: FT, height: FT, channels: 3 } }).jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();
})();

/* ======================= 4. hair ======================= */
// every triangle that is still skin near the head, for ray casts
const skinTris = [];
for (let t = 0; t < nT; t++) {
  if (dead[t] || faceTri[t] || triIsl(t) !== bodyIsl) continue;
  const tri = [0, 1, 2].map((k) => P(IDX[3 * t + k]));
  if (Math.max(...tri.map((p) => p[1])) > 128 && Math.max(...tri.map((p) => Math.abs(p[0]))) < 13) skinTris.push(tri);
}
const neckTris = skinTris.slice();
for (const tri of fIdx) skinTris.push(tri.map((i) => F.pos[i]));
const faceTris = fIdx.map((tri) => tri.map((i) => F.pos[i]));

// the head's open edge: boundary of the face + neck around the top of the head
const posKey = (p) => `${(p[0] / 100).toFixed(5)},${(p[1] / 100).toFixed(5)},${(p[2] / 100).toFixed(5)}`;
const keyId = new Map(), keyPos = [];
const kid = (p) => { const k = posKey(p); if (!keyId.has(k)) { keyId.set(k, keyPos.length); keyPos.push(p); } return keyId.get(k); };
const headTris = skinTris.map((tri) => tri.map(kid));
const openEdge = boundaryLoops(headTris).map((l) => l.map((i) => keyPos[i])).filter((l) => Math.max(...l.map((p) => p[1])) > 150).sort((a, b) => b.length - a.length)[0];
console.log("open edge", openEdge.length, "verts");

const C = [0, 147.6, -1.8], AX = [9.15, 10.35, 9.05];
const POLE = v3.norm([0, 0.42, -1]);
const ellR = (d) => 1 / Math.sqrt((d[0] / AX[0]) ** 2 + (d[1] / AX[1]) ** 2 + (d[2] / AX[2]) ** 2);
const castOut = (tris, o, d) => { let best = 0; for (const [a, b, c] of tris) { const t = rayTri(o, d, a, b, c); if (t > best) best = t; } return best; };
const capTris = skinTris.filter((tri) => Math.max(...tri.map((p) => p[1])) > 134.5);
const skinR = (d) => { const r = castOut(capTris, C, d); return r < 14 ? r : 0; };
const faceZ = (x, y) => { const t = castOut(faceTris, [x, y, 40], [0, 0, -1]); return t > 0 ? 40 - t : null; };
const nearest = (tris, p) => { let best = null, bd = 1e9; for (const [a, b, c] of tris) { const q = closestOnTri(p, a, b, c), d = v3.len(v3.sub(q, p)); if (d < bd) { bd = d; best = q; } } return best; };

// hairline: down onto the forehead in front, down the neck at the nape, along the open edge at the sides (under the ears)
const hairlineY = (x) => { const a = Math.abs(x); return 153.9 - 0.75 * (a / 4) ** 2 - 2.6 * Math.max(0, (a - 5.6) / 2.6) ** 2; };
let edge = openEdge.map((o) => {
  let E = o;
  const wTop = smooth(146.5, 149.5, o[1]);
  if (wTop > 0) {
    const x = o[0] * 0.965, y = Math.max(hairlineY(x), 147.2), z = faceZ(x, y);
    if (z !== null) E = v3.lerp(E, [x, y, z], wTop);
  }
  const wBack = smooth(-1.6, -3.2, o[2]);
  if (wBack > 0) {
    const yn = Math.min(o[1], 137.3 + 2.1 * (Math.abs(o[0]) / 4.6) ** 2);
    E = v3.lerp(E, nearest(neckTris, [o[0] * 0.97, yn, o[2]]), wBack);
  }
  return E;
});
const NC = 128;
edge = resampleClosed(edge, NC);
// start the loop at the nape centre so the uv seam sits at the back of the neck
let start = 0;
const napeScore = (p) => (p[2] < -2 ? Math.abs(p[0]) + 0.3 * p[1] : 1e9);
edge.forEach((p, i) => { if (napeScore(p) < napeScore(edge[start])) start = i; });
edge = edge.slice(start).concat(edge.slice(0, start));

const NR = 44, TMAX = 0.94;
const ts = [0, ...Array.from({ length: NR }, (_, j) => TMAX * Math.pow((j + 1) / NR, 1.15))];
const dirs = edge.map((E) => v3.norm(v3.sub(E, C)));
const grid = []; // grid[i][j] = { d, r, s }
for (let i = 0; i < NC; i++) {
  const r0 = v3.len(v3.sub(edge[i], C)), col = [];
  for (let j = 0; j <= NR; j++) {
    const d = slerp(dirs[i], POLE, ts[j]);
    const s = j === 0 ? 0 : skinR(d);
    const r = j === 0 ? r0 : Math.max(mix(r0, ellR(d), smooth(0, 0.35, ts[j])), s + 0.12);
    col.push({ d, r, s });
  }
  grid.push(col);
}
// shrink-wrap: smooth the radius over the grid while staying clear of the skin
for (let it = 0; it < 60; it++) {
  const nr = grid.map((col, i) => col.map((g, j) => {
    if (j === 0) return g.r;
    const up = grid[i][Math.min(NR, j + 1)].r, dn = grid[i][j - 1].r, l = grid[(i + NC - 1) % NC][j].r, rr = grid[(i + 1) % NC][j].r;
    let r = 0.5 * g.r + 0.125 * (up + dn + l + rr);
    if (g.s === 0) r += 0.08 * (ellR(g.d) - r);
    return Math.max(r, g.s + 0.12);
  }));
  grid.forEach((col, i) => col.forEach((g, j) => (g.r = nr[i][j])));
}
// thickness: rises over the first centimetre behind the hairline
const HT = 0.45;
const hairPos = grid.map((col) => {
  let arc = 0, prev = null;
  return col.map((g, j) => {
    const p = v3.add(C, v3.mul(g.d, g.r));
    if (prev) arc += v3.len(v3.sub(p, prev));
    prev = p;
    return v3.add(C, v3.mul(g.d, g.r + (j === 0 ? 0.03 : HT * smooth(0, 1.1, arc))));
  });
});
// the tucked lip under the edge
const tuck = edge.map((E) => v3.add(C, v3.mul(v3.norm(v3.sub(E, C)), v3.len(v3.sub(E, C)) - 0.3)));

const H = { pos: [], uv: [], j: [], w: [], idx: [] };
// skin weights near the edge: borrow the nearest skin vertex's (the nape follows the neck), fading to the head
const skinVerts = [];
for (let t = 0; t < nT; t++) {
  if (dead[t] || triIsl(t) !== bodyIsl) continue;
  for (let k = 0; k < 3; k++) { const i = IDX[3 * t + k], p = P(i); if (p[1] > 128 && Math.abs(p[0]) < 13) skinVerts.push(i); }
}
const skinW = (p) => {
  let best = -1, bd = 1e9;
  for (const i of skinVerts) { const q = P(i), d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2; if (d < bd) { bd = d; best = i; } }
  const m = new Map();
  for (let k = 0; k < 4; k++) if (WGT[4 * best + k] > 0) m.set(JNT[4 * best + k], (m.get(JNT[4 * best + k]) || 0) + WGT[4 * best + k]);
  return m;
};
const headOnly = () => new Map([[HEAD, 1]]);
const mixW = (a, b, t) => { const m = new Map(); for (const [k, v] of a) m.set(k, (m.get(k) || 0) + v * (1 - t)); for (const [k, v] of b) m.set(k, (m.get(k) || 0) + v * t); return m; };
const packW = (m) => {
  const e = [...m.entries()].filter(([, v]) => v > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const s = e.reduce((a, [, v]) => a + v, 0);
  while (e.length < 4) e.push([0, 0]);
  return { j: e.map(([k]) => k), w: e.map(([, v]) => v / s) };
};
const pushV = (G, p, uv, wm) => { const { j, w } = packW(wm); G.pos.push(p); G.uv.push(uv); G.j.push(j); G.w.push(w); return G.pos.length - 1; };

// shell vertices: rows = tuck, edge, 1..NR; one extra column repeats the first for the uv seam
const rows = NR + 2;
const edgeW = edge.map((E) => skinW(E));
for (let i = 0; i <= NC; i++) {
  const ii = i % NC;
  for (let r = 0; r < rows; r++) {
    const p = r === 0 ? tuck[ii] : hairPos[ii][r - 1];
    const t = r === 0 ? 0 : ts[r - 1];
    pushV(H, p, [i / NC, t / TMAX], mixW(edgeW[ii], headOnly(), smooth(0.02, 0.2, t)));
  }
}
const hv = (i, r) => i * rows + r;
for (let i = 0; i < NC; i++) for (let r = 0; r < rows - 1; r++) H.idx.push([hv(i, r), hv(i + 1, r), hv(i + 1, r + 1)], [hv(i, r), hv(i + 1, r + 1), hv(i, r + 1)]);
// outward winding
{
  const [a, b, c] = H.idx[NC * 2 * 10];
  const n = v3.cross(v3.sub(H.pos[b], H.pos[a]), v3.sub(H.pos[c], H.pos[a]));
  if (v3.dot(n, v3.sub(H.pos[a], C)) < 0) H.idx = H.idx.map(([a, b, c]) => [a, c, b]);
}
// circumference per row (for the part line width in uv)
const rowCirc = Array.from({ length: rows }, (_, r) => { let s = 0; for (let i = 0; i < NC; i++) s += v3.len(v3.sub(H.pos[hv(i + 1, r)], H.pos[hv(i, r)])); return s; });
// the parting runs back from the hairline's highest point
let partCol = 0;
for (let i = 0; i < NC; i++) if (edge[i][1] > edge[partCol][1] && edge[i][2] > 0) partCol = i;
const partU = partCol / NC;

// bun over the pole
const shellPole = v3.add(C, v3.mul(POLE, grid.reduce((a, col) => a + col[NR].r, 0) / NC + HT));
const BUN_R = [3.45, 2.55];
const bunC = v3.add(shellPole, v3.mul(POLE, 1.25));
const e1 = v3.norm(v3.cross(POLE, [1, 0, 0])), e2 = v3.cross(POLE, e1);
{
  const NT = 40, NP = 22, base = H.pos.length;
  for (let a = 0; a <= NT; a++) for (let b = 0; b <= NP; b++) {
    const th = (a / NT) * 2 * Math.PI, ph = (b / NP) * Math.PI;
    const twist = 1 + 0.075 * Math.sin(4 * th + 9 * ph) * Math.pow(Math.sin(ph), 0.6);
    const rp = BUN_R[0] * Math.sin(ph) * twist, ra = BUN_R[1] * Math.cos(ph) * twist;
    const p = v3.add(bunC, v3.add(v3.mul(POLE, ra), v3.add(v3.mul(e1, rp * Math.cos(th)), v3.mul(e2, rp * Math.sin(th)))));
    pushV(H, p, [a / NT + 0.45 * (b / NP), 0.66 + 0.32 * (b / NP)], headOnly());
  }
  for (let a = 0; a < NT; a++) for (let b = 0; b < NP; b++) {
    const v = (aa, bb) => base + aa * (NP + 1) + bb;
    H.idx.push([v(a, b), v(a, b + 1), v(a + 1, b + 1)], [v(a, b), v(a + 1, b + 1), v(a + 1, b)]);
  }
  // outward
  const t0 = H.idx[H.idx.length - NP * 2 * 10];
  const n = v3.cross(v3.sub(H.pos[t0[1]], H.pos[t0[0]]), v3.sub(H.pos[t0[2]], H.pos[t0[0]]));
  if (v3.dot(n, v3.sub(H.pos[t0[0]], bunC)) < 0) for (let k = H.idx.length - NT * NP * 2; k < H.idx.length; k++) { const [a, b, c] = H.idx[k]; H.idx[k] = [a, c, b]; }
}

/* ---------- hair texture: strands along v, the parting near partU ---------- */
const HW = 1024, HHT = 512;
const hairTex = await (async () => {
  const img = Buffer.alloc(HW * HHT * 3);
  for (let y = 0; y < HHT; y++) {
    // v = t / TMAX and row r holds ts[r - 1] = TMAX * ((r - 1) / NR) ^ 1.15, so r = 1 + NR * v ^ (1 / 1.15)
    const v = (y + 0.5) / HHT, row = clamp(Math.round(1 + NR * Math.pow(v, 1 / 1.15)), 1, rows - 1);
    const partHalf = 0.09 / rowCirc[row];
    for (let x = 0; x < HW; x++) {
      const u = (x + 0.5) / HW;
      // strands: a few octaves of streaks across u, each wandering slowly along v; periodic in u so the shell's
      // closing column and the bun's spiral uvs (which run past 1) meet without a seam
      let s = 0;
      // (each strand wanders on its own, slightly, so they run straight back rather than waving together)
      for (const [f, a] of [[180, 0.5], [97, 0.3], [41, 0.2]]) s += a * noise1p(u * f + 0.7 * noise1p(u * 13 + v * 4 + f, 13), f);
      const g = 0.55 + 0.9 * s;
      let c = [17 * g, 13 * g, 11 * g];
      // the parting: a fine line of scalp that fades out towards the crown
      let du = Math.abs(u - partU); du = Math.min(du, 1 - du);
      const part = smooth(1.6, 0.7, du / partHalf) * smooth(0.62, 0.35, v) * (v > 0.66 ? 0 : 1);
      c = c.map((k, n) => mix(k, [86, 54, 36][n], part * 0.9));
      img[3 * (y * HW + x)] = clamp(Math.round(c[0]), 0, 255);
      img[3 * (y * HW + x) + 1] = clamp(Math.round(c[1]), 0, 255);
      img[3 * (y * HW + x) + 2] = clamp(Math.round(c[2]), 0, 255);
    }
  }
  return sharp(img, { raw: { width: HW, height: HHT, channels: 3 } }).jpeg({ quality: 88 }).toBuffer();
})();

/* ======================= 5. headband, bow ======================= */
// the band follows where the hair crosses a plane tilted from over the crown down to below the occiput
const BAND_P = [0, 156.6, 4.8], BAND_N = v3.norm([0, 14.6, -16.0]); // tipped forward so the pattern shows from the front
const gPlane = (p) => v3.dot(v3.sub(p, BAND_P), BAND_N);
const hairNrm = vertexNormals(new Float32Array(H.pos.flat()), H.idx.flat());
const colPoint = (i, s) => {
  // point and normal at arc length s along shell column i (rows from the edge)
  let acc = 0;
  for (let r = 1; r < rows - 1; r++) {
    const a = H.pos[hv(i, r)], b = H.pos[hv(i, r + 1)], l = v3.len(v3.sub(b, a));
    if (acc + l >= s || r === rows - 2) {
      const t = clamp((s - acc) / l, 0, 1);
      const na = hairNrm.slice(3 * hv(i, r), 3 * hv(i, r) + 3), nb = hairNrm.slice(3 * hv(i, r + 1), 3 * hv(i, r + 1) + 3);
      return [v3.lerp(a, b, t), v3.norm(v3.lerp([...na], [...nb], t))];
    }
    acc += l;
  }
};
const colCross = (i, level) => {
  // arc length where g = level along column i
  let acc = 0;
  for (let r = 1; r < rows - 1; r++) {
    const a = H.pos[hv(i, r)], b = H.pos[hv(i, r + 1)], l = v3.len(v3.sub(b, a)), ga = gPlane(a) - level, gb = gPlane(b) - level;
    if (ga <= 0 && gb > 0) return acc + l * (-ga / (gb - ga));
    acc += l;
  }
  return null;
};
const B = { pos: [], uv: [], j: [], w: [], idx: [] };
const BK = 9;
const bandMid = [];
{
  let around = 0, prevMid = null;
  const cols = [];
  for (let i = 0; i < NC; i++) {
    const [mid] = colPoint(i, colCross(i, 0));
    const half = mix(1.35, 2.4, smooth(141, 155, mid[1]));
    cols.push({ sa: colCross(i, -half), sb: colCross(i, half), mid });
  }
  // the pattern repeats a whole number of times around the head (about every 7.5 cm), so it closes without a jump
  let total = 0;
  for (let i = 0; i < NC; i++) total += v3.len(v3.sub(cols[(i + 1) % NC].mid, cols[i].mid));
  const repeats = Math.max(1, Math.round(total / 7.5));
  for (let i = 0; i <= NC; i++) {
    const c = cols[i % NC];
    if (prevMid) around += v3.len(v3.sub(c.mid, prevMid));
    prevMid = c.mid;
    if (i < NC) { bandMid.push(c.mid); }
    for (let k = 0; k < BK; k++) {
      const f = k / (BK - 1);
      const [p, n] = colPoint(i % NC, mix(c.sa, c.sb, f));
      const puff = Math.sin(Math.PI * f);
      const off = k === 0 || k === BK - 1 ? -0.06 : 0.12 + 0.3 * Math.pow(puff, 0.45);
      pushV(B, v3.add(p, v3.mul(n, off)), [(around / total) * repeats, f], headOnly());
    }
  }
  for (let i = 0; i < NC; i++) for (let k = 0; k < BK - 1; k++) {
    const v = (ii, kk) => ii * BK + kk;
    B.idx.push([v(i, k), v(i + 1, k), v(i + 1, k + 1)], [v(i, k), v(i + 1, k + 1), v(i, k + 1)]);
  }
  const [a, b, c] = B.idx[40];
  if (v3.dot(v3.cross(v3.sub(B.pos[b], B.pos[a]), v3.sub(B.pos[c], B.pos[a])), v3.sub(B.pos[a], C)) < 0) B.idx = B.idx.map(([a, b, c]) => [a, c, b]);
}
// the bow: on the band, up on the crown towards her left
{
  const want = v3.norm([0.5, 0.82, 0.18]);
  let bi = 0;
  bandMid.forEach((p, i) => { if (v3.dot(v3.norm(v3.sub(p, C)), want) > v3.dot(v3.norm(v3.sub(bandMid[bi], C)), want)) bi = i; });
  const M0 = bandMid[bi];
  const T = v3.norm(v3.sub(bandMid[(bi + 1) % NC], bandMid[(bi + NC - 1) % NC]));
  const Nn = v3.norm(v3.sub(M0, C));
  const N = v3.norm(v3.sub(Nn, v3.mul(T, v3.dot(Nn, T))));
  const Bx = v3.cross(N, T);
  const knot = v3.add(M0, v3.mul(N, 1.15)); // sits on the band (whose top is about 0.5 above the hair)
  const base = () => B.pos.length;
  // loops
  for (const side of [-1, 1]) {
    const tilt = 0.5, dirT = v3.norm(v3.add(v3.mul(T, side * Math.cos(tilt)), v3.mul(N, Math.sin(tilt))));
    // each wing is a flattened loop of fabric lying across the band (its plane holds the band direction, tilted up,
    // and the across-band direction), swept as a tube whose broad side (Wd) faces out, pinched at the knot
    const up = v3.norm(v3.sub(Bx, v3.mul(dirT, v3.dot(Bx, dirT)))), Wd = v3.norm(v3.cross(dirT, up));
    const L = 4.4, Hh = 1.05, NS = 44, NW = 14, b0 = base();
    // a smooth factor makes the lower half 0.8 of the upper without a kink at the tip for the tube to fold on
    const path = (th) => { const sn = Math.sin(th); return v3.add(knot, v3.add(v3.mul(dirT, (L / 2) * (1 - Math.cos(th))), v3.mul(up, Hh * sn * (0.9 + 0.1 * sn)))); };
    for (let a = 0; a <= NS; a++) {
      const th = (a / NS) * 2 * Math.PI;
      const c = path(th), tg = v3.norm(v3.sub(path(th + 0.01), path(th - 0.01)));
      const inPlane = v3.norm(v3.cross(Wd, tg)); // across the tube, in the loop's plane
      const pinch = 0.28 + 0.72 * Math.pow(Math.sin(th / 2), 1.1);
      // thinner round the tip, where the loop turns tightest
      const wa = 1.6 * pinch, wb = (0.36 + 0.18 * pinch) * (1 - 0.3 * Math.exp(-(((th - Math.PI) / 0.6) ** 2)));
      for (let k = 0; k <= NW; k++) {
        const ph = (k / NW) * 2 * Math.PI;
        const p = v3.add(c, v3.add(v3.mul(Wd, wa * Math.cos(ph)), v3.mul(inPlane, wb * Math.sin(ph))));
        pushV(B, p, [(a / NS) * 0.9 + (side > 0 ? 0.05 : 0.55), 0.5 + 0.5 * Math.cos(ph)], headOnly());
      }
    }
    for (let a = 0; a < NS; a++) for (let k = 0; k < NW; k++) {
      const v = (aa, kk) => b0 + aa * (NW + 1) + kk;
      B.idx.push([v(a, k), v(a + 1, k), v(a + 1, k + 1)], [v(a, k), v(a + 1, k + 1), v(a, k + 1)]);
    }
    {
      // outward: away from the tube's centre line
      const k0 = B.idx.length - NS * NW * 2, t0 = B.idx[k0 + NW * 2 * 11 + 3];
      const cc = path((11.5 / NS) * 2 * Math.PI);
      const nn = v3.cross(v3.sub(B.pos[t0[1]], B.pos[t0[0]]), v3.sub(B.pos[t0[2]], B.pos[t0[0]]));
      if (v3.dot(nn, v3.sub(B.pos[t0[0]], cc)) < 0) for (let k = k0; k < B.idx.length; k++) { const [a, b, c] = B.idx[k]; B.idx[k] = [a, c, b]; }
    }
  }
  // knot
  const NT = 20, NP = 12, b0 = base();
  for (let a = 0; a <= NT; a++) for (let b = 0; b <= NP; b++) {
    const th = (a / NT) * 2 * Math.PI, ph = (b / NP) * Math.PI;
    const p = v3.add(knot, v3.add(v3.mul(T, 0.95 * Math.sin(ph) * Math.cos(th)), v3.add(v3.mul(Bx, 1.15 * Math.sin(ph) * Math.sin(th)), v3.mul(N, 0.72 * Math.cos(ph)))));
    pushV(B, p, [a / NT * 0.5, b / NP], headOnly());
  }
  for (let a = 0; a < NT; a++) for (let b = 0; b < NP; b++) {
    const v = (aa, bb) => b0 + aa * (NP + 1) + bb;
    const tri1 = [v(a, b), v(a, b + 1), v(a + 1, b + 1)], tri2 = [v(a, b), v(a + 1, b + 1), v(a + 1, b)];
    B.idx.push(tri1, tri2);
  }
  const k0 = B.idx.length - NT * NP * 2, t0 = B.idx[k0 + 30];
  if (v3.dot(v3.cross(v3.sub(B.pos[t0[1]], B.pos[t0[0]]), v3.sub(B.pos[t0[2]], B.pos[t0[0]])), v3.sub(B.pos[t0[0]], knot)) < 0) for (let k = k0; k < B.idx.length; k++) { const [a, b, c] = B.idx[k]; B.idx[k] = [a, c, b]; }
}

/* ---------- fabric texture: an orange and brown wax-print pattern ---------- */
const FW = 512, FH = 256;
const fabricTex = await (async () => {
  const img = Buffer.alloc(FW * FH * 3);
  const ORANGE = [222, 112, 36], BROWN = [92, 44, 22], CREAM = [244, 214, 160], GOLD = [236, 164, 52], RUST = [168, 64, 26];
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const u = (x + 0.5) / FW, v = (y + 0.5) / FH; // u along the band (tiles), v across
    let c = [...ORANGE];
    const put = (col, a) => { for (let k = 0; k < 3; k++) c[k] += (col[k] - c[k]) * clamp(a, 0, 1); };
    const aa = 1.2 / FH;
    // borders
    put(BROWN, smooth(0.085 + aa, 0.085 - aa, Math.min(v, 1 - v)));
    put(GOLD, smooth(aa, -aa, Math.abs(Math.min(v, 1 - v) - 0.115) - 0.012));
    // big lozenges along the middle
    const cu = ((u * 4) % 1) - 0.5, cv = v - 0.5;
    const dia = Math.abs(cu) / 0.42 + Math.abs(cv) / 0.3;
    put(BROWN, smooth(1 + 0.02, 1 - 0.02, dia));
    put(CREAM, smooth(0.62 + 0.03, 0.62 - 0.03, dia));
    put(RUST, smooth(0.38 + 0.03, 0.38 - 0.03, dia));
    put(BROWN, smooth(0.13 + 0.03, 0.13 - 0.03, Math.hypot(cu * 0.42 / 0.3, cv)));
    // dots between the lozenges
    const du = ((u * 4 + 0.5) % 1) - 0.5;
    for (const dv of [-0.2, 0.2]) put(CREAM, smooth(0.05 + 0.01, 0.05 - 0.01, Math.hypot(du * 0.42 / 0.3, v - 0.5 - dv)));
    // zigzag lines near the borders
    const zz = (vv) => Math.abs(v - vv - 0.025 * (Math.abs(((u * 24) % 1) - 0.5) * 4 - 1));
    put(BROWN, smooth(0.008 + aa, 0.008 - aa, Math.min(zz(0.16), zz(0.84))));
    for (let k = 0; k < 3; k++) img[3 * (y * FW + x) + k] = clamp(Math.round(c[k]), 0, 255);
  }
  return sharp(img, { raw: { width: FW, height: FH, channels: 3 } }).jpeg({ quality: 88 }).toBuffer();
})();

/* ======================= 6. ears and studs ======================= */
// Each ear hinges on its front edge, which sits on the hair just behind the face, and swings out from the head
// towards the back like a real ear. The front sheet is a shallow bowl (a raised rim round a concha), the back sheet
// a dome sunk into the head; they meet at the rim. If the hair still stands above any part of the bowl, the ear is
// pushed out until it clears.
const EAR = { pos: [], uv: [], j: [], w: [], idx: [] };
const GOLDM = { pos: [], uv: [], j: [], w: [], idx: [] };
const hairTris = H.idx.map((t) => t.map((i) => H.pos[i]));
const headSurface = hairTris.concat(faceTris); // where the ear's front edge sits, the hair meets the face
const castNear = (tris, o, d) => { let best = Infinity; for (const [a, b, c] of tris) { const t = rayTri(o, d, a, b, c); if (t > 0 && t < best) best = t; } return best; };
for (const s of [-1, 1]) {
  const yc = 144.9, zh = -0.9, ALPHA = 0.38, HE = 2.45, WE = 1.4, NT = 36, NR2 = 10;
  const hitAt = (y, z) => {
    const r = castOut(headSurface, [0, y, z], [s, 0, 0]);
    if (r < 6) throw new Error(`no head surface beside the ear at y=${y} z=${z}`);
    return [s * r, y, z];
  };
  const hinge = hitAt(yc, zh);
  let nh = v3.norm(v3.cross(v3.sub(hitAt(yc + 0.3, zh), hitAt(yc - 0.3, zh)), v3.sub(hitAt(yc, zh + 0.3), hitAt(yc, zh - 0.3))));
  if (nh[0] * s < 0) nh = v3.mul(nh, -1);
  // in the hair's tangent plane: up (leaning back 10 degrees) and back (towards the back of the head)
  const up0 = v3.norm(v3.sub([0, 1, 0], v3.mul(nh, nh[1])));
  let back0 = v3.norm(v3.cross(up0, nh));
  if (back0[2] > 0) back0 = v3.mul(back0, -1);
  const up = v3.norm(v3.add(v3.mul(up0, Math.cos(0.17)), v3.mul(back0, Math.sin(0.17))));
  let back = v3.norm(v3.cross(up, nh));
  if (back[2] > 0) back = v3.mul(back, -1);
  // swing out about the front edge: across the ear runs back and out, the ear faces out and a little forward
  const wv = v3.norm(v3.add(v3.mul(back, Math.cos(ALPHA)), v3.mul(nh, Math.sin(ALPHA))));
  const n = v3.norm(v3.sub(v3.mul(nh, Math.cos(ALPHA)), v3.mul(back, Math.sin(ALPHA))));
  let Ec = v3.add(hinge, v3.add(v3.mul(wv, WE * 0.92), v3.mul(n, -0.12)));
  const out = (rho, front) => (front ? 0.25 + 0.55 * smooth(0.45, 0.85, rho) - 0.8 * smooth(0.9, 1.0, rho) : -0.9 * (1 - rho * rho));
  const shape = (rho, th, front) => {
    const rr = rho * (1 + 0.08 * Math.sin(th) * (Math.sin(th) < 0 ? 1 : 0)); // fuller lobe
    return v3.add(Ec, v3.add(v3.mul(up, HE * rr * Math.sin(th)), v3.add(v3.mul(wv, WE * rr * Math.cos(th)), v3.mul(n, out(rho, front)))));
  };
  // clear the hair: the largest height of hair above the bowl, measured along the ear's normal
  let push = 0;
  for (let a = 0; a < NT; a++) for (let r = 0; r <= 8; r++) {
    const p = shape(r / NR2, (a / NT) * 2 * Math.PI, true), t = castNear(hairTris, p, n);
    if (t < 3) push = Math.max(push, t + 0.05);
  }
  Ec = v3.add(Ec, v3.mul(n, push));
  console.log(`ear ${s > 0 ? "left" : "right"}: pushed out ${push.toFixed(2)} cm to clear the hair`);
  const [bx, by, bw, bh] = EAR_BOX;
  for (const front of [true, false]) {
    const b0 = EAR.pos.length;
    for (let a = 0; a <= NT; a++) for (let r = 0; r <= NR2; r++) {
      const th = (a / NT) * 2 * Math.PI, rho = r / NR2;
      // the decal's u runs from the front edge to the back edge on both ears
      const uu = 0.5 + 0.5 * rho * Math.cos(th), vv = 0.5 - 0.5 * rho * Math.sin(th);
      pushV(EAR, shape(rho, th, front), [(bx + uu * bw) / FT, (by + vv * bh) / FT], headOnly());
    }
    for (let a = 0; a < NT; a++) for (let r = 0; r < NR2; r++) {
      const v = (aa, rr) => b0 + aa * (NR2 + 1) + rr;
      EAR.idx.push([v(a, r), v(a + 1, r), v(a + 1, r + 1)], [v(a, r), v(a + 1, r + 1), v(a, r + 1)]);
    }
    const k0 = EAR.idx.length - NT * NR2 * 2, t0 = EAR.idx[k0 + NR2 * 2 * 5 + 10];
    const nn = v3.cross(v3.sub(EAR.pos[t0[1]], EAR.pos[t0[0]]), v3.sub(EAR.pos[t0[2]], EAR.pos[t0[0]]));
    if ((v3.dot(nn, n) < 0) === front) for (let k = k0; k < EAR.idx.length; k++) { const [a, b, c] = EAR.idx[k]; EAR.idx[k] = [a, c, b]; }
  }
  // stud on the lobe
  const lobe = v3.add(shape(0.72, -Math.PI / 2, true), v3.mul(n, 0.12));
  const R = 0.3, NTs = 14, NPs = 8, b0 = GOLDM.pos.length;
  for (let a = 0; a <= NTs; a++) for (let b = 0; b <= NPs; b++) {
    const th = (a / NTs) * 2 * Math.PI, ph = (b / NPs) * Math.PI;
    pushV(GOLDM, [lobe[0] + R * Math.sin(ph) * Math.cos(th), lobe[1] + R * Math.cos(ph), lobe[2] + R * Math.sin(ph) * Math.sin(th)], [0, 0], headOnly());
  }
  for (let a = 0; a < NTs; a++) for (let b = 0; b < NPs; b++) {
    const v = (aa, bb) => b0 + aa * (NPs + 1) + bb;
    GOLDM.idx.push([v(a, b), v(a + 1, b + 1), v(a, b + 1)], [v(a, b), v(a + 1, b), v(a + 1, b + 1)]);
  }
}

/* ======================= 7. write ======================= */
const isUint8 = JNT instanceof Uint8Array;
const indexArray = (arr, nVerts) => (nVerts <= 65535 ? new Uint16Array(arr) : new Uint32Array(arr));
function addPrim(G, material, normals) {
  // drop zero-area triangles (the pole fans of the parametric parts) and any vertex left unused
  const P = (i) => G.pos[i];
  const tris = G.idx.filter(([a, b, c]) => v3.len(v3.cross(v3.sub(P(b), P(a)), v3.sub(P(c), P(a)))) > 1e-8);
  const remap = new Int32Array(G.pos.length).fill(-1), keep = [];
  for (const t of tris) for (const i of t) if (remap[i] < 0) { remap[i] = keep.length; keep.push(i); }
  const n = keep.length;
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), jn = isUint8 ? new Uint8Array(n * 4) : new Uint16Array(n * 4), wt = new Float32Array(n * 4);
  keep.forEach((src, i) => {
    const p = G.pos[src];
    pos[3 * i] = p[0] / 100; pos[3 * i + 1] = p[1] / 100; pos[3 * i + 2] = p[2] / 100;
    uv[2 * i] = G.uv[src][0]; uv[2 * i + 1] = G.uv[src][1];
    jn.set(G.j[src], 4 * i); wt.set(G.w[src], 4 * i);
  });
  const idx = indexArray(tris.flat().map((i) => remap[i]), n);
  const nrm = normals ? new Float32Array(keep.flatMap((src) => normals[src])) : vertexNormals(pos, idx);
  const buf = root.listBuffers()[0];
  const acc = (arr, type) => doc.createAccessor().setArray(arr).setType(type).setBuffer(buf);
  const p = doc.createPrimitive().setMaterial(material).setIndices(acc(idx, "SCALAR"))
    .setAttribute("POSITION", acc(pos, "VEC3")).setAttribute("NORMAL", acc(nrm, "VEC3"))
    .setAttribute("JOINTS_0", acc(jn, "VEC4")).setAttribute("WEIGHTS_0", acc(wt, "VEC4"));
  if (material.getBaseColorTexture()) p.setAttribute("TEXCOORD_0", acc(uv, "VEC2"));
  mesh.addPrimitive(p);
  return p;
}
const tex = (name, buf, mime = "image/jpeg") => doc.createTexture(name).setImage(new Uint8Array(buf)).setMimeType(mime);
// The skin matches the body's material: its metal/roughness map reads 0.5 metal (the app caps it at 0.25) and 0.64
// roughness on the skin, and its KHR_materials_specular colour texture reads 133/255 (sRGB) with an ior of 1.45.
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const SKIN_SPECULAR = srgbToLinear(133 / 255);
const faceMat = doc.createMaterial("Face").setBaseColorTexture(tex("Face_Diffuse", faceTex)).setRoughnessFactor(0.64).setMetallicFactor(0.25).setDoubleSided(true)
  .setExtension("KHR_materials_ior", doc.createExtension(KHRMaterialsIOR).createIOR().setIOR(1.45))
  .setExtension("KHR_materials_specular", doc.createExtension(KHRMaterialsSpecular).createSpecular().setSpecularFactor(1).setSpecularColorFactor([SKIN_SPECULAR, SKIN_SPECULAR, SKIN_SPECULAR]));
const hairMat = doc.createMaterial("Hair").setBaseColorTexture(tex("Hair_Diffuse", hairTex)).setRoughnessFactor(0.38).setMetallicFactor(0).setDoubleSided(true);
const fabricMat = doc.createMaterial("Headband").setBaseColorTexture(tex("Headband_Diffuse", fabricTex)).setRoughnessFactor(0.85).setMetallicFactor(0).setDoubleSided(true);
const goldMat = doc.createMaterial("Gold").setBaseColorFactor([1.0, 0.76, 0.33, 1]).setRoughnessFactor(0.25).setMetallicFactor(1);

addPrim({ pos: F.pos, uv: F.uv, j: F.j, w: F.w, idx: fIdx }, faceMat, F.nrm);
addPrim(EAR, faceMat);
addPrim(H, hairMat);
addPrim(B, fabricMat);
addPrim(GOLDM, goldMat);

// the body keeps everything else, compacted
{
  const keepTris = [];
  for (let t = 0; t < nT; t++) if (!dead[t] && !faceTri[t]) keepTris.push(IDX[3 * t], IDX[3 * t + 1], IDX[3 * t + 2]);
  const remap = new Int32Array(nV).fill(-1);
  let m = 0;
  for (const i of keepTris) if (remap[i] < 0) remap[i] = m++;
  for (const sem of prim.listSemantics()) {
    const a = prim.getAttribute(sem), arr = a.getArray(), size = a.getElementSize();
    const out = new arr.constructor(m * size);
    for (let i = 0; i < nV; i++) if (remap[i] >= 0) for (let k = 0; k < size; k++) out[remap[i] * size + k] = arr[i * size + k];
    a.setArray(out);
  }
  prim.getIndices().setArray(indexArray(keepTris.map((i) => remap[i]), m));
}
// the model's own animations are never played (the app loads its clips from public/models/*.json)
for (const anim of root.listAnimations()) {
  const accessors = new Set(anim.listSamplers().flatMap((smp) => [smp.getInput(), smp.getOutput()]));
  for (const ch of anim.listChannels()) ch.dispose();
  for (const smp of anim.listSamplers()) smp.dispose();
  anim.dispose();
  for (const acc of accessors) if (acc && acc.listParents().every((p) => p.propertyType === "Root")) acc.dispose();
}
await io.write(dst, doc);
console.log("face", F.pos.length, "hair", H.pos.length, "band", B.pos.length, "ears", EAR.pos.length, "studs", GOLDM.pos.length);
