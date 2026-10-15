// Give the runner a new face and hair: big painted eyes, brows, blush and lips on a face texture of its own, sleek
// pulled-back hair with a bun, a patterned headband with a bow, ears and gold studs.
//   npm i --no-save @gltf-transform/core @gltf-transform/extensions sharp
//   git show 167a41b:public/models/runner.glb > /tmp/runner-legs.glb   (the model with the rebuilt legs, original head)
//   node scripts/model/rebuild-face.mjs /tmp/runner-legs.glb public/models/runner.glb
// 1. Delete the old hair (the island holding the highest vertex: a cap plus puffs) and the slit eyelids and eyeballs.
// 2. Move the face (the front mask, lips and nose tip) to a primitive of its own: welded, eye sockets refilled with
//    a smooth biharmonic patch domed like a lid over an eyeball, and given cylindrical uvs onto a new texture.
// 3. Paint that texture in body space (face-paint.mjs), blending into the old colours at the neck seam.
// 4. Grow a hair shell from the head's open edge (the hairline is pulled down onto the forehead and the nape) to a
//    pole at the back of the crown, shrink-wrapped over the skull, with a bun over the pole.
// 5. Lay a headband where a tilted plane crosses the hair, tie a bow on it, and add ears with gold studs.
// Everything new is skinned to the head (the nape edge borrows the neck's weights).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import sharp from "sharp";
import { v3, uf, weldIds, boundaryLoops, vertexNormals, raster, dilate, smooth, clamp, mix, rayTri, closestOnTri, slerp, resampleClosed, noise1 } from "./face-lib.mjs";
import { paintFace, paintEar } from "./face-paint.mjs";

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
const fIdx = [], fOld = [];
for (let t = 0; t < nT; t++) {
  if (!faceTri[t] || dead[t]) continue;
  const tri = [];
  for (let k = 0; k < 3; k++) {
    const i = IDX[3 * t + k], w = W[i];
    if (!fv.has(w)) fv.set(w, addV(P(i), [NRM[3 * i], NRM[3 * i + 1], NRM[3 * i + 2]], [...JNT.slice(4 * i, 4 * i + 4)], [...WGT.slice(4 * i, 4 * i + 4)], i));
    tri.push(fv.get(w));
  }
  fIdx.push(tri);
  fOld.push([0, 1, 2].map((k) => [UV[2 * IDX[3 * t + k]], UV[2 * IDX[3 * t + k] + 1]]));
}
// eye holes: spider-web fill
const EYE_C = [4.95, 145.4], ZONE = [3.45, 2.45];
const zoneD = (p) => Math.cbrt(Math.abs((Math.abs(p[0]) - EYE_C[0]) / ZONE[0]) ** 3 + Math.abs((p[1] - EYE_C[1]) / ZONE[1]) ** 3);
const origTris = fIdx.map((tri) => tri.map((i) => [...F.pos[i]]));
for (const l of boundaryLoops(fIdx)) {
  const c = l.reduce((a, i) => v3.add(a, F.pos[i]), [0, 0, 0]).map((x) => x / l.length);
  if (!(l.length < 120 && Math.abs(c[0]) > 2 && Math.abs(c[0]) < 8 && c[1] > 143 && c[1] < 147.5)) continue;
  const RINGS = 5, rings = [l];
  for (let k = 1; k < RINGS; k++) rings.push(l.map((i) => { const b = F.pos[i], s = 1 - k / RINGS; return addV([c[0] + (b[0] - c[0]) * s, c[1] + (b[1] - c[1]) * s, c[2]], [0, 0, 1], F.j[i], F.w[i], -1); }));
  const centre = addV([...c], [0, 0, 1], F.j[l[0]], F.w[l[0]], -1);
  for (let k = 0; k < RINGS; k++) for (let i = 0; i < l.length; i++) {
    const a = rings[k][i], b = rings[k][(i + 1) % l.length];
    if (k === RINGS - 1) { fIdx.push([b, a, centre]); fOld.push(null); continue; }
    const a2 = rings[k + 1][i], b2 = rings[k + 1][(i + 1) % l.length];
    fIdx.push([b, a, a2], [b, a2, b2]); fOld.push(null, null);
  }
}
// biharmonic patch over each eye zone, the face outside it as the boundary, plus a gentle dome
{
  const BUMP = 0.42, GH = 0.12, GX = Math.ceil((ZONE[0] + 0.6) / GH), GY = Math.ceil((ZONE[1] + 0.6) / GH);
  const surfZ = (x, y) => { let best = -1e9; for (const [a, b, c] of origTris) { const t = rayTri([x, y, 50], [0, 0, -1], a, b, c); if (t > 0) best = Math.max(best, 50 - t); } return best; };
  for (const side of [-1, 1]) {
    const nx = 2 * GX + 1, ny = 2 * GY + 1, z = new Float64Array(nx * ny), known = new Uint8Array(nx * ny);
    const gx = (i) => side * (EYE_C[0] + (i - GX) * GH), gy = (j) => EYE_C[1] + (j - GY) * GH;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (zoneD([gx(i), gy(j)]) >= 1) { z[k] = surfZ(gx(i), gy(j)); known[k] = z[k] > -1e8 ? 1 : 0; }
    }
    let mean = 0, nk = 0;
    for (let k = 0; k < z.length; k++) if (known[k]) { mean += z[k]; nk++; }
    for (let k = 0; k < z.length; k++) if (!known[k]) z[k] = mean / nk;
    const at = (i, j) => z[clamp(j, 0, ny - 1) * nx + clamp(i, 0, nx - 1)];
    for (let it = 0; it < 2000; it++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (!known[k]) z[k] += 1.85 * ((at(i - 1, j) + at(i + 1, j) + at(i, j - 1) + at(i, j + 1)) / 4 - z[k]);
    }
    for (let it = 0; it < 12000; it++) {
      let delta = 0;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        if (known[k]) continue;
        const n4 = at(i - 1, j) + at(i + 1, j) + at(i, j - 1) + at(i, j + 1);
        const d4 = at(i - 1, j - 1) + at(i + 1, j - 1) + at(i - 1, j + 1) + at(i + 1, j + 1);
        const f4 = at(i - 2, j) + at(i + 2, j) + at(i, j - 2) + at(i, j + 2);
        const dz = 1.7 * ((8 * n4 - 2 * d4 - f4) / 20 - z[k]);
        z[k] += dz;
        delta = Math.max(delta, Math.abs(dz));
      }
      if (delta < 1e-6) break;
    }
    const sample = (x, y) => {
      const fi = (Math.abs(x) - EYE_C[0]) / GH + GX, fj = (y - EYE_C[1]) / GH + GY;
      const i0 = clamp(Math.floor(fi), 0, nx - 2), j0 = clamp(Math.floor(fj), 0, ny - 2), u = fi - i0, v = fj - j0;
      return at(i0, j0) * (1 - u) * (1 - v) + at(i0 + 1, j0) * u * (1 - v) + at(i0, j0 + 1) * (1 - u) * v + at(i0 + 1, j0 + 1) * u * v;
    };
    const height = (x, y) => { const d = zoneD([x, y]); return sample(x, y) + (d < 1 ? BUMP * Math.pow(1 - d * d, 2) : 0); };
    F.pos.forEach((p, i) => {
      if (Math.sign(p[0]) !== side || zoneD(p) >= 1) return;
      p[2] = height(p[0], p[1]);
      const e = 0.05, dx = (height(p[0] + e, p[1]) - height(p[0] - e, p[1])) / (2 * e), dy = (height(p[0], p[1] + e) - height(p[0], p[1] - e)) / (2 * e);
      F.nrm[i] = v3.norm([-dx, -dy, 1]);
    });
  }
}
for (let t = 0; t < fIdx.length; t++) {
  if (fOld[t]) continue;
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
  // fuller, rounder cheeks
  const N0 = vertexNormals(new Float32Array(F.pos.flat()), fIdx.flat());
  F.pos.forEach((p, i) => {
    if (border.has(i) || zoneD(p) < 1) return;
    const h = 0.34 * Math.exp(-(((Math.abs(p[0]) - 5.3) / 2.0) ** 2) - (((p[1] - 141.3) / 1.8) ** 2));
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

/* ======================= 3. the face texture ======================= */
const FT = 1024;
const EAR_BOX = [12, 6, 190, 190]; // a free corner of the face texture for the ears: x, y, w, h (px)
const faceTex = await (async () => {
  const { data: D, info } = await sharp(Buffer.from(body.getBaseColorTexture().getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const DW = info.width;
  const samp = (u, v) => {
    const x = u * DW - 0.5, y = v * DW - 0.5, x0 = clamp(Math.floor(x), 0, DW - 2), y0 = clamp(Math.floor(y), 0, DW - 2), fx = x - x0, fy = y - y0;
    return [0, 1, 2].map((k) => D[3 * (y0 * DW + x0) + k] * (1 - fx) * (1 - fy) + D[3 * (y0 * DW + x0 + 1) + k] * fx * (1 - fy) + D[3 * ((y0 + 1) * DW + x0) + k] * (1 - fx) * fy + D[3 * ((y0 + 1) * DW + x0 + 1) + k] * fx * fy);
  };
  const seam = boundaryLoops(fIdx).sort((a, b) => b.length - a.length)[0].map((i) => F.pos[i]).filter((p) => p[1] < 141.5);
  const seamDist = (p) => { let d = 1e9; for (const q of seam) d = Math.min(d, v3.len(v3.sub(p, q))); return d; };
  const img = new Float32Array(FT * FT * 3), cov = new Uint8Array(FT * FT);
  const uvpx = new Float32Array(F.uv.flatMap((u) => [u[0] * FT, u[1] * FT]));
  raster(FT, FT, uvpx, fIdx.flat(), (px, py, l0, l1, l2, t) => {
    const tri = fIdx[t], o = fOld[t], i = py * FT + px;
    const p = [0, 1, 2].map((k) => F.pos[tri[0]][k] * l0 + F.pos[tri[1]][k] * l1 + F.pos[tri[2]][k] * l2);
    const baked = o ? samp(o[0][0] * l0 + o[1][0] * l1 + o[2][0] * l2, o[0][1] * l0 + o[1][1] * l1 + o[2][1] * l2) : null;
    img.set(paintFace(p, baked, seamDist(p)), 3 * i);
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
  for (let i = 0; i < FT * FT; i++) if (!cov[i]) img.set([97, 61, 38], 3 * i);
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
    const v = (y + 0.5) / HHT, row = Math.min(rows - 1, Math.round(v * (rows - 2)) + 1);
    const partHalf = 0.09 / rowCirc[row];
    for (let x = 0; x < HW; x++) {
      const u = (x + 0.5) / HW;
      // strands: a few octaves of streaks across u, each wandering slowly along v
      let s = 0;
      for (const [f, a] of [[180, 0.5], [97, 0.3], [41, 0.2]]) s += a * noise1(u * f + 3.1 * noise1(v * 6 + f));
      const g = 0.55 + 0.9 * s;
      let c = [27 * g, 20 * g, 17 * g];
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
const BAND_P = [0, 157.3, 3.4], BAND_N = v3.norm([0, 13.7, -17.9]);
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
const bandMid = [], bandFrame = [];
{
  let around = 0, prevMid = null;
  const cols = [];
  for (let i = 0; i < NC; i++) {
    const s0 = colCross(i, 0);
    const [mid, n] = colPoint(i, s0);
    const half = mix(1.35, 2.4, smooth(141, 155, mid[1]));
    const sa = colCross(i, -half * 1.0), sb = colCross(i, half * 1.0);
    cols.push({ sa, sb, mid, n });
  }
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
      pushV(B, v3.add(p, v3.mul(n, off)), [around / 7.5, f], headOnly());
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
  const knot = v3.add(M0, v3.mul(N, 0.75));
  const base = () => B.pos.length;
  // loops
  for (const side of [-1, 1]) {
    const tilt = 0.5, dirT = v3.norm(v3.add(v3.mul(T, side * Math.cos(tilt)), v3.mul(N, Math.sin(tilt))));
    const up = v3.norm(v3.sub(N, v3.mul(dirT, v3.dot(N, dirT))));
    // each loop is a flattened tube of fabric swept round a teardrop, pinched where it meets the knot
    const L = 3.8, Hh = 1.7, NS = 44, NW = 14, b0 = base();
    const path = (th) => { const sn = Math.sin(th); return v3.add(knot, v3.add(v3.mul(dirT, (L / 2) * (1 - Math.cos(th))), v3.mul(up, Hh * (sn > 0 ? sn : 0.45 * sn)))); };
    for (let a = 0; a <= NS; a++) {
      const th = (a / NS) * 2 * Math.PI;
      const c = path(th), tg = v3.norm(v3.sub(path(th + 0.01), path(th - 0.01)));
      const inPlane = v3.norm(v3.cross(Bx, tg)); // across the tube, in the loop's plane
      const pinch = 0.28 + 0.72 * Math.pow(Math.sin(th / 2), 1.1);
      const wa = 1.45 * pinch, wb = 0.32 + 0.12 * pinch;
      for (let k = 0; k <= NW; k++) {
        const ph = (k / NW) * 2 * Math.PI;
        const p = v3.add(c, v3.add(v3.mul(Bx, wa * Math.cos(ph)), v3.mul(inPlane, wb * Math.sin(ph))));
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
const EAR = { pos: [], uv: [], j: [], w: [], idx: [] };
const GOLDM = { pos: [], uv: [], j: [], w: [], idx: [] };
for (const s of [-1, 1]) {
  const yc = 144.9, zc = -1.85;
  const xs = castOut(H.idx.map((t) => t.map((i) => H.pos[i])), [0, yc, zc], [s, 0, 0]);
  const Ec = [s * (xs - 0.2), yc, zc];
  const n = v3.norm([s, 0, 0.42]);
  const up = v3.norm([0, Math.cos(0.17), -Math.sin(0.17)]);
  const wv = v3.norm(v3.cross(up, n)); // across the ear
  const HE = 2.45, WE = 1.4, NT = 36, NR2 = 10;
  const shape = (rho, th, front) => {
    const back = Math.cos(th) * v3.dot(wv, [0, 0, -1]) > 0 ? 1 : 0; // the back edge sticks out more
    const out = front ? (0.25 + 0.55 * smooth(0.45, 0.85, rho) - 0.8 * smooth(0.9, 1.0, rho)) * (0.75 + 0.5 * back * Math.abs(Math.cos(th))) : -0.9 * (1 - rho * rho);
    const rr = rho * (1 + 0.08 * Math.sin(th) * (Math.sin(th) < 0 ? 1 : 0)); // fuller lobe
    return v3.add(Ec, v3.add(v3.mul(up, HE * rr * Math.sin(th)), v3.add(v3.mul(wv, WE * rr * Math.cos(th)), v3.mul(n, out))));
  };
  const [bx, by, bw, bh] = EAR_BOX;
  for (const front of [true, false]) {
    const b0 = EAR.pos.length;
    for (let a = 0; a <= NT; a++) for (let r = 0; r <= NR2; r++) {
      const th = (a / NT) * 2 * Math.PI, rho = r / NR2;
      const uu = 0.5 + 0.5 * rho * Math.cos(th) * s, vv = 0.5 - 0.5 * rho * Math.sin(th);
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
  const lobe = v3.add(shape(0.72, -Math.PI / 2 - 0.25 * s * 0, true), v3.mul(n, 0.12));
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
function addPrim(G, material, normals) {
  const n = G.pos.length;
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), jn = isUint8 ? new Uint8Array(n * 4) : new Uint16Array(n * 4), wt = new Float32Array(n * 4);
  G.pos.forEach((p, i) => { pos[3 * i] = p[0] / 100; pos[3 * i + 1] = p[1] / 100; pos[3 * i + 2] = p[2] / 100; });
  G.uv.forEach((u, i) => { uv[2 * i] = u[0]; uv[2 * i + 1] = u[1]; });
  G.j.forEach((j, i) => jn.set(j, 4 * i));
  G.w.forEach((w, i) => wt.set(w, 4 * i));
  const idx = new Uint32Array(G.idx.flat());
  const nrm = normals ? new Float32Array(normals.flat()) : vertexNormals(pos, idx);
  const buf = root.listBuffers()[0];
  const acc = (arr, type) => doc.createAccessor().setArray(arr).setType(type).setBuffer(buf);
  const p = doc.createPrimitive().setMaterial(material).setIndices(acc(idx, "SCALAR"))
    .setAttribute("POSITION", acc(pos, "VEC3")).setAttribute("NORMAL", acc(nrm, "VEC3")).setAttribute("TEXCOORD_0", acc(uv, "VEC2"))
    .setAttribute("JOINTS_0", acc(jn, "VEC4")).setAttribute("WEIGHTS_0", acc(wt, "VEC4"));
  mesh.addPrimitive(p);
  return p;
}
const tex = (name, buf, mime = "image/jpeg") => doc.createTexture(name).setImage(new Uint8Array(buf)).setMimeType(mime);
// the skin matches the body: its metal/roughness map reads 0.5 metal (the app caps it at 0.25) and 0.64 roughness on the skin
const faceMat = doc.createMaterial("Face").setBaseColorTexture(tex("Face_Diffuse", faceTex)).setRoughnessFactor(0.64).setMetallicFactor(0.25).setDoubleSided(true);
const hairMat = doc.createMaterial("Hair").setBaseColorTexture(tex("Hair_Diffuse", hairTex)).setRoughnessFactor(0.52).setMetallicFactor(0).setDoubleSided(true);
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
  prim.getIndices().setArray(new Uint32Array(keepTris.map((i) => remap[i])));
}
await io.write(dst, doc);
console.log("face", F.pos.length, "hair", H.pos.length, "band", B.pos.length, "ears", EAR.pos.length, "studs", GOLDM.pos.length);
