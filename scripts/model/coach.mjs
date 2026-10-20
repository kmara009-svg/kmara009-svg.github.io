// The coach who waits at the references sign with her medal: a man in a checked shirt and dark trousers, made from
// the runner, so he has her skeleton and the same mocap clips drive him.
//   npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp
//   node scripts/model/coach.mjs public/models/runner.glb public/models/coach.glb
// 1. Drop the headband, the studs and the bun (the hair's second island). Close the hole the bun covered at the back
//    of the crown and give the hair some height on top: a short man's cut.
// 2. Reshape the body: a flat chest, a straight waist and narrower hips; the sleeves and trouser legs stand off the
//    skin. The app paints the clothes (a gingham shirt, trousers, a belt, darker shoes) from the bind-pose
//    positions, so the body texture is hers, unchanged.
// 3. Lay a shirt collar round the base of the neck, open at the throat.
// 4. Paint a face texture of his own (coach-face.mjs) on her face mask's uvs.
// 5. Simplify, drop every texture but the face (the app dresses him in her materials, as it does the rivals) and
//    quantize all but the positions, which the app's shader reads as they are (metres, bind pose).
// Every length below is in metres unless it says cm (the face is painted in cm, like hers).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMeshQuantization } from "@gltf-transform/extensions";
import { prune, quantize, simplifyPrimitive, weldPrimitive } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { v3, uf, weldIds, boundaryLoops, vertexNormals, raster, dilate, smooth, clamp, mix, rayTri } from "./face-lib.mjs";
import { paintCoachFace, paintCoachEar, COACH_SKIN } from "./coach-face.mjs";
import { SKIN } from "./face-paint.mjs";

const [src, dst] = process.argv.slice(2);
if (!src || !dst) throw new Error("usage: node scripts/model/coach.mjs <runner.glb> <coach.glb>");
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const root = doc.getRoot();
const prims = root.listMeshes().flatMap((m) => m.listPrimitives().map((p) => ({ m, p, name: p.getMaterial()?.getName() ?? "" })));
const tris = (p) => p.getIndices().getCount() / 3;
const byName = (n) => prims.filter((x) => x.name === n);
const bodyPrim = byName("Ch03_Body")[0].p;
const [maskPrim, earPrim] = byName("Face").map((x) => x.p).sort((a, b) => tris(b) - tris(a));
const hairPrim = byName("Hair")[0].p;

/* small helpers over flat attribute arrays */
const attr = (p, s) => p.getAttribute(s).getArray();
const at3 = (a, i) => [a[3 * i], a[3 * i + 1], a[3 * i + 2]];
// smooth linear interpolation through knots [[x, y], ...]
const knots = (k, x) => {
  if (x <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (x <= k[i][0]) return mix(k[i - 1][1], k[i][1], smooth(k[i - 1][0], k[i][0], x));
  return k[k.length - 1][1];
};
// rebuild a primitive's vertex and index data (attributes are float or integer typed arrays, by semantic)
function setPrim(p, data, idx) {
  for (const [s, { arr, type }] of Object.entries(data)) {
    let a = p.getAttribute(s);
    if (!a) { a = doc.createAccessor().setType(type).setBuffer(root.listBuffers()[0]); p.setAttribute(s, a); }
    a.setArray(arr);
  }
  let ia = p.getIndices();
  if (!ia) { ia = doc.createAccessor().setType("SCALAR").setBuffer(root.listBuffers()[0]); p.setIndices(ia); }
  let max = 0;
  for (const i of idx) if (i > max) max = i;
  ia.setArray(max > 65535 ? new Uint32Array(idx) : new Uint16Array(idx));
}

/* ======================= 1. headband, studs, bun; the hair ======================= */
// (her parts are all primitives of one skinned mesh)
for (const x of [...byName("Headband"), ...byName("Gold")]) {
  x.m.removePrimitive(x.p);
  x.p.getMaterial()?.dispose();
  x.p.dispose();
}
{
  const p = hairPrim;
  const P = attr(p, "POSITION"), N = attr(p, "NORMAL"), UV = attr(p, "TEXCOORD_0"), J = attr(p, "JOINTS_0"), WT = attr(p, "WEIGHTS_0"), I = [...p.getIndices().getArray()];
  const W = weldIds(P), U = uf(P.length / 3);
  for (let t = 0; t < I.length; t += 3) { U.union(W[I[t]], W[I[t + 1]]); U.union(W[I[t]], W[I[t + 2]]); }
  const size = new Map();
  for (let t = 0; t < I.length; t += 3) { const r = U.find(W[I[t]]); size.set(r, (size.get(r) ?? 0) + 1); }
  const shell = [...size.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const keep = [];
  for (let t = 0; t < I.length; t += 3) if (U.find(W[I[t]]) === shell) keep.push(I[t], I[t + 1], I[t + 2]);
  // close the pole: a shallow dome over the hole the bun stood in
  const perimeter = (l) => l.reduce((s, i, k) => s + v3.len(v3.sub(at3(P, i), at3(P, l[(k + 1) % l.length]))), 0);
  const loops = boundaryLoops(Array.from({ length: keep.length / 3 }, (_, k) => [W[keep[3 * k]], W[keep[3 * k + 1]], W[keep[3 * k + 2]]])).sort((a, b) => perimeter(a) - perimeter(b));
  const pole = loops[0], hairline = loops[loops.length - 1];
  if (loops.length !== 2 || perimeter(pole) > 0.3) throw new Error(`expected a hairline and a pole: ${loops.map(perimeter)}`);
  const pos = [...P], nrm = [...N], uv = [...UV], jn = [...J], wt = [...WT];
  let c = [0, 0, 0], cn = [0, 0, 0], cu = [0, 0];
  for (const i of pole) { c = v3.add(c, at3(P, i)); cn = v3.add(cn, at3(N, i)); cu = [cu[0] + UV[2 * i], cu[1] + UV[2 * i + 1]]; }
  c = v3.mul(c, 1 / pole.length); cn = v3.norm(cn);
  const radius = pole.reduce((s, i) => s + v3.len(v3.sub(at3(P, i), c)), 0) / pole.length;
  const ring = pole.map((i) => {
    const q = v3.add(v3.lerp(c, at3(P, i), 0.5), v3.mul(cn, radius * 0.18)); // a mid ring, domed out
    return { i, q };
  });
  const add = (q, n, u, from) => {
    const k = pos.length / 3;
    pos.push(...q); nrm.push(...n); uv.push(...u);
    jn.push(J[4 * from], J[4 * from + 1], J[4 * from + 2], J[4 * from + 3]);
    wt.push(WT[4 * from], WT[4 * from + 1], WT[4 * from + 2], WT[4 * from + 3]);
    return k;
  };
  const apex = add(v3.add(c, v3.mul(cn, radius * 0.25)), cn, [cu[0] / pole.length, cu[1] / pole.length], pole[0]);
  const mids = ring.map(({ i, q }) => add(q, v3.norm(v3.lerp(at3(N, i), cn, 0.5)), [(UV[2 * i] + cu[0] / pole.length) / 2, (UV[2 * i + 1] + cu[1] / pole.length) / 2], i));
  // the loop runs along the shell's winding, so the cap's triangles take it reversed
  for (let k = 0; k < pole.length; k++) {
    const a = pole[k], b = pole[(k + 1) % pole.length], ma = mids[k], mb = mids[(k + 1) % pole.length];
    keep.push(b, a, ma, b, ma, mb, mb, ma, apex);
  }
  // height on top and at the front, none at the hairline, a little over the sides and back
  const edge = hairline.map((i) => at3(P, i));
  const n2 = vertexNormals(pos, keep);
  for (let i = 0; i < pos.length / 3; i++) {
    const q = at3(pos, i);
    let dEdge = 1e9;
    for (const e of edge) dEdge = Math.min(dEdge, v3.len(v3.sub(q, e)));
    const top = smooth(1.49, 1.56, q[1]), front = smooth(-0.04, 0.03, q[2]);
    const lift = (0.0025 + 0.0075 * top + 0.004 * top * front) * smooth(0, 0.016, dEdge);
    for (let k = 0; k < 3; k++) pos[3 * i + k] += n2[3 * i + k] * lift;
  }
  const n3 = vertexNormals(pos, keep);
  setPrim(p, {
    POSITION: { arr: new Float32Array(pos), type: "VEC3" },
    NORMAL: { arr: new Float32Array(n3), type: "VEC3" },
    TEXCOORD_0: { arr: new Float32Array(uv), type: "VEC2" },
    JOINTS_0: { arr: new (J.constructor)(jn), type: "VEC4" },
    WEIGHTS_0: { arr: new (WT.constructor)(wt), type: "VEC4" },
  }, keep);
}

/* ======================= 2. the body ======================= */
const body = (() => {
  const p = bodyPrim;
  const P = attr(p, "POSITION"), I = p.getIndices().getArray();
  const n = P.length / 3;
  // how much a vertex belongs to an arm (in the T-pose they run along x from the shoulders)
  const armness = (x, y) => smooth(0.13, 0.18, Math.abs(x)) * smooth(1.19, 1.23, y);
  // her torso's half-width by height (1 cm bins, arms left out), lightly smoothed
  const bins = new Float32Array(160);
  for (let i = 0; i < n; i++) {
    const x = P[3 * i], y = P[3 * i + 1];
    if (armness(x, y) > 0.5 || y < 0.7 || y >= 1.6) continue;
    const b = Math.floor(y * 100);
    bins[b] = Math.max(bins[b], Math.abs(x));
  }
  const hw = (y) => {
    const b = clamp(Math.floor(y * 100), 72, 140);
    let s = 0, w = 0;
    for (let k = -2; k <= 2; k++) if (bins[b + k] > 0) { s += bins[b + k] * (3 - Math.abs(k)); w += 3 - Math.abs(k); }
    return w ? s / w : 0.1;
  };
  // his half-width: shoulders as hers, a broad flat chest straight down to the belt, narrower hips
  const WIDTH = [[0.86, 0.121], [0.92, 0.118], [0.98, 0.116], [1.06, 0.115], [1.16, 0.115], [1.22, 0.112]];
  const pos = new Float32Array(P);
  for (let i = 0; i < n; i++) {
    const x = P[3 * i], y = P[3 * i + 1], z = P[3 * i + 2];
    const torso = (1 - armness(x, y)) * smooth(0.8, 0.86, y) * (1 - smooth(1.22, 1.27, y));
    if (torso <= 0) continue;
    const W = knots(WIDTH, y), H = hw(y);
    const sx = W > 0 && H > 0 ? W / H : 1;
    const nx = x * mix(1, sx, torso);
    const across = clamp(Math.abs(nx) / (W || 0.12), 0, 1);
    const round = Math.sqrt(Math.max(0, 1 - across * across));
    let nz = z;
    if (z > 0) {
      // the bust flattened onto a broad chest; the waist filled out to it
      const chest = smooth(1.03, 1.12, y) * (1 - smooth(1.26, 1.31, y));
      const cap = 0.084 * round + 0.01;
      if (nz > cap) nz = mix(nz, cap + (nz - cap) * 0.12, chest);
      const belly = smooth(0.95, 1.0, y) * (1 - smooth(1.12, 1.18, y));
      nz = Math.max(nz, mix(nz, 0.084 * round, belly));
    } else {
      const back = smooth(0.97, 1.02, y) * (1 - smooth(1.2, 1.26, y));
      nz = Math.min(nz, mix(nz, -0.05 * round, back));
    }
    pos[3 * i] = nx;
    pos[3 * i + 2] = mix(z, nz, torso);
  }
  // broader shoulders: the upper chest, the shoulders and the arms move out (the joints stay; the neck,
  // which meets the face mask, does not move)
  for (let i = 0; i < n; i++) {
    const x = pos[3 * i], y = pos[3 * i + 1];
    pos[3 * i] += Math.sign(x) * 0.014 * smooth(1.16, 1.26, y) * (1 - smooth(1.29, 1.33, y)) * smooth(0.03, 0.09, Math.abs(x));
  }
  // smooth out the creases the reshaping leaves on the torso (vertices at one position move as one)
  {
    const W = weldIds(pos), nb = new Map();
    const link = (a, b) => { if (!nb.has(a)) nb.set(a, new Set()); nb.get(a).add(b); };
    for (let t = 0; t < I.length; t += 3) for (let e = 0; e < 3; e++) { const a = W[I[t + e]], b = W[I[t + (e + 1) % 3]]; link(a, b); link(b, a); }
    const weight = (i) => (1 - armness(P[3 * i], P[3 * i + 1])) * smooth(0.9, 0.98, P[3 * i + 1]) * (1 - smooth(1.27, 1.31, P[3 * i + 1]));
    for (let it = 0; it < 6; it++) {
      const next = new Map();
      for (const [a, set] of nb) {
        const w = weight(a);
        if (w <= 0) continue;
        const avg = [0, 0, 0];
        for (const b of set) for (let k = 0; k < 3; k++) avg[k] += pos[3 * b + k] / set.size;
        next.set(a, [0, 1, 2].map((k) => mix(pos[3 * a + k], avg[k], 0.5 * w)));
      }
      for (const [a, q] of next) pos.set(q, 3 * a);
      for (let i = 0; i < n; i++) if (W[i] !== i) for (let k = 0; k < 3; k++) pos[3 * i + k] = pos[3 * W[i] + k];
    }
  }
  // her legs are islands of their own, tucked under the shorts' hem (the torso island's lower edge)
  const legs = new Uint8Array(n);
  {
    const W = weldIds(P), U = uf(n), size = new Map();
    for (let t = 0; t < I.length; t += 3) { U.union(W[I[t]], W[I[t + 1]]); U.union(W[I[t]], W[I[t + 2]]); }
    for (let i = 0; i < n; i++) { const r = U.find(W[i]); size.set(r, (size.get(r) ?? 0) + 1); }
    const torso = [...size.entries()].sort((a, b) => b[1] - a[1])[0][0];
    for (let i = 0; i < n; i++) legs[i] = U.find(W[i]) !== torso && P[3 * i + 1] > 0.2 ? 1 : 0;
  }
  // sleeves, shirt and trousers stand off the skin, along the reshaped surface's normals
  const N0 = vertexNormals(pos, I);
  for (let i = 0; i < n; i++) {
    const x = pos[3 * i], y = pos[3 * i + 1], ax = Math.abs(x);
    const arm = armness(x, y);
    const sleeve = 0.008 * (1 - smooth(0.528, 0.545, ax));
    const shirt = 0.006 * (1 - smooth(1.29, 1.33, y));
    // (none where the legs meet, where offsets along converging normals would fold the surface)
    const crotch = smooth(0.74, 0.8, y) * (1 - smooth(0.9, 0.95, y)) * (1 - smooth(0.012, 0.05, ax));
    const trousers = mix(0.017, 0.012, smooth(0.45, 0.8, y)) * smooth(0.12, 0.17, y) * (1 - crotch);
    const belt = smooth(0.955, 0.965, y) * (1 - smooth(0.995, 1.005, y)) * 0.004;
    // the shorts' hem stood 1-5 mm proud of the thigh: its edge comes in a millimetre, the trouser leg
    // widens to meet it just below its lower edge (y 0.744), and under it moves with it, keeping her tuck
    const torsoHem = -0.001 * (1 - smooth(0.755, 0.775, y)) * smooth(0.7, 0.74, y);
    const under = smooth(0.742, 0.75, y);
    const hem = legs[i] ? 0.0015 * smooth(0.68, 0.74, y) * (1 - under) + torsoHem * under : torsoHem;
    const torsoOff = y > 0.98 ? mix(trousers, shirt, smooth(0.98, 1.0, y)) : trousers + hem;
    const off = ax > 0.545 ? 0 : mix(torsoOff + belt, sleeve, arm);
    for (let k = 0; k < 3; k++) pos[3 * i + k] += N0[3 * i + k] * off;
  }
  // and wherever a leg runs on under the hem it stays at least 1 mm inside it: from each leg's axis
  // at the vertex's height, out through the vertex, to the hem
  {
    const hemTris = [];
    for (let t = 0; t < I.length; t += 3) {
      const v = [I[t], I[t + 1], I[t + 2]];
      if (v.some((k) => legs[k]) || Math.min(...v.map((k) => P[3 * k + 1])) > 0.8 || Math.max(...v.map((k) => P[3 * k + 1])) < 0.73) continue;
      hemTris.push(v.map((k) => at3(pos, k)));
    }
    let moved = 0;
    for (let i = 0; i < n; i++) {
      if (!legs[i] || P[3 * i + 1] < 0.742) continue;
      const q = at3(pos, i), side = Math.sign(q[0]);
      let ax = 0, az = 0, c = 0;
      for (let k = 0; k < n; k++) {
        if (!legs[k] || Math.sign(pos[3 * k]) !== side || Math.abs(pos[3 * k + 1] - q[1]) > 0.008) continue;
        ax += pos[3 * k]; az += pos[3 * k + 2]; c++;
      }
      ax /= c; az /= c;
      const r = Math.hypot(q[0] - ax, q[2] - az), d = [(q[0] - ax) / r, 0, (q[2] - az) / r];
      let hit = Infinity;
      for (const [a, b, cc] of hemTris) { const t = rayTri([ax, q[1], az], d, a, b, cc); if (t > 0 && t < hit) hit = t; }
      if (hit < Infinity && r > hit - 0.001) {
        pos[3 * i] = ax + d[0] * (hit - 0.001);
        pos[3 * i + 2] = az + d[2] * (hit - 0.001);
        moved++;
      }
    }
    console.log(`leg tops pulled back under the hem: ${moved}`);
  }
  const nrm = vertexNormals(pos, I);
  p.getAttribute("POSITION").setArray(pos);
  p.getAttribute("NORMAL").setArray(nrm);
  return { pos, idx: I, J: attr(p, "JOINTS_0"), WT: attr(p, "WEIGHTS_0") };
})();

/* ======================= 3. the collar ======================= */
// where the shirt meets the neck (the app's shader draws the same line): round the back and sides, dipping into an
// open V at the front. theta is the angle round the neck from the front (+z), towards his left (+x).
const NECK_Y = 1.352, NECK_V = 0.045, ZC = -0.004;
const neckline = (th) => NECK_Y - NECK_V * (1 - smooth(0.25, 0.75, Math.abs(th)));
const collar = (() => {
  const { pos: P, idx: I, J, WT } = body;
  const near = [];
  for (let t = 0; t < I.length; t += 3) {
    const tri = [at3(P, I[t]), at3(P, I[t + 1]), at3(P, I[t + 2])];
    if (Math.max(...tri.map((q) => q[1])) > 1.22 && Math.min(...tri.map((q) => q[1])) < 1.42 && Math.min(...tri.map((q) => Math.abs(q[0]))) < 0.2) near.push(tri);
  }
  // the throat under the chin is the face mask's
  const mP = attr(maskPrim, "POSITION"), mI = maskPrim.getIndices().getArray();
  for (let t = 0; t < mI.length; t += 3) near.push([at3(mP, mI[t]), at3(mP, mI[t + 1]), at3(mP, mI[t + 2])]);
  // the distance from the neck axis to the body's surface, at an angle and height
  const surface = (th, y) => {
    const o = [0, y, ZC], d = [Math.sin(th), 0, Math.cos(th)];
    let best = -1;
    for (const [a, b, c] of near) { const t = rayTri(o, d, a, b, c); if (t > 0 && (best < 0 || t < best)) best = t; }
    if (best < 0) throw new Error(`no surface at ${th.toFixed(2)} ${y.toFixed(3)}`);
    return best; // where the ray leaves the body
  };
  const at = (th, y, r) => [Math.sin(th) * r, y, ZC + Math.cos(th) * r];
  const END = 0.2, FRONT = 1.0; // the leaves start here (rad from the front); the front points lie on the chest
  const cols = [];
  const NC = 56;
  for (let k = 0; k <= NC; k++) {
    // from his right front end, round the back, to his left front end
    const s = -Math.PI + END + ((2 * Math.PI - 2 * END) * k) / NC; // -pi+END .. pi-END, 0 at the back
    const th = s > 0 ? Math.PI - s : -Math.PI - s; // angle from the front
    const a = Math.abs(th);
    const f = smooth(FRONT, END, a); // 1 at the very front end
    const yn = neckline(th);
    const yF = yn + mix(0.013, 0.003, f);
    const thO = th + Math.sign(th) * 0.38 * f; // the points swing out across the chest
    const yO = yn - 0.018 - 0.045 * f;
    // the fold's radius from the neck at the neckline: above it, at the sides, the ray would meet
    // the underside of the jaw
    const rF = surface(th, Math.min(yF, yn)) + 0.005 + 0.004 * f;
    const rO = surface(thO, yO) + 0.009;
    const F = at(th, yF, rF), O = at(thO, yO, rO);
    // a slight roll: the middle of the fall stands out from the straight line between fold and edge
    const M = v3.add(v3.lerp(F, O, 0.5), v3.mul(v3.norm([Math.sin(th) * 0.8, 0.6, Math.cos(th) * 0.8]), 0.003));
    cols.push([F, M, O]);
  }
  const pos = [], idx = [];
  for (const c of cols) for (const q of c) pos.push(...q);
  for (let k = 0; k < NC; k++) for (let r = 0; r < 2; r++) {
    const a = k * 3 + r, b = a + 1, c = a + 3, d = a + 4;
    idx.push(a, c, b, b, c, d);
  }
  const nrm = vertexNormals(pos, idx);
  // skinned like the nearest point of the body
  const jn = [], wt = [];
  for (let i = 0; i < pos.length / 3; i++) {
    const q = at3(pos, i);
    let best = 0, bd = 1e9;
    for (let v = 0; v < P.length / 3; v++) {
      if (Math.abs(P[3 * v + 1] - q[1]) > 0.05) continue;
      const d = v3.len(v3.sub(at3(P, v), q));
      if (d < bd) { bd = d; best = v; }
    }
    for (let k = 0; k < 4; k++) { jn.push(J[4 * best + k]); wt.push(WT[4 * best + k]); }
  }
  return { pos, nrm, idx, jn, wt };
})();
{
  const mat = doc.createMaterial("Collar").setRoughnessFactor(0.8).setMetallicFactor(0).setDoubleSided(true);
  const p = doc.createPrimitive().setMaterial(mat);
  const J = body.J, WT = body.WT;
  setPrim(p, {
    POSITION: { arr: new Float32Array(collar.pos), type: "VEC3" },
    NORMAL: { arr: new Float32Array(collar.nrm), type: "VEC3" },
    JOINTS_0: { arr: new (J.constructor)(collar.jn), type: "VEC4" },
    WEIGHTS_0: { arr: new (WT.constructor)(collar.wt), type: "VEC4" },
  }, collar.idx);
  byName("Ch03_Body")[0].m.addPrimitive(p);
  console.log(`collar: ${collar.idx.length / 3} triangles`);
}

/* ======================= 4. the face texture ======================= */
const FT = 1024, OUT = 512;
const EAR_BOX = [12, 6, 190, 190]; // where her ears' uvs sit in the face texture (rebuild-face.mjs)
const faceJpeg = await (async () => {
  const bodyImg = await sharp(Buffer.from(bodyPrim.getMaterial().getBaseColorTexture().getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const DW = bodyImg.info.width, D = bodyImg.data;
  const samp = (u, v) => { const x = clamp(Math.floor(u * DW), 0, DW - 1), y = clamp(Math.floor(v * DW), 0, DW - 1), o = 3 * (y * DW + x); return [D[o], D[o + 1], D[o + 2]]; };
  // the sRGB transfer exactly, as three decodes the textures and colours the shader works with
  const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const srgb = (l) => { const v = clamp(l, 0, 1); return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055); };
  const luma = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const herLuma = luma(SKIN), coachLin = COACH_SKIN.map(lin);
  // the neck along the seam, in his tone as the app's shader recolours it (by luminance against her skin tone)
  const mP = attr(maskPrim, "POSITION"), mUV = attr(maskPrim, "TEXCOORD_0"), mI = maskPrim.getIndices().getArray();
  const bUV = attr(bodyPrim, "TEXCOORD_0");
  const mW = weldIds(mP);
  const loops = boundaryLoops(Array.from({ length: mI.length / 3 }, (_, k) => [mW[mI[3 * k]], mW[mI[3 * k + 1]], mW[mI[3 * k + 2]]]));
  const seam = [];
  // the body's positions were reshaped above, but not at the neck: match on her original neck vertices
  const orig = (await io.read(src)).getRoot().listMeshes()[0].listPrimitives()[0].getAttribute("POSITION").getArray();
  for (const loop of loops) for (const i of loop) {
    const q = at3(mP, i);
    let best = -1, bd = 0.0008;
    for (let v = 0; v < orig.length / 3; v++) {
      const d = Math.abs(orig[3 * v] - q[0]) + Math.abs(orig[3 * v + 1] - q[1]) + Math.abs(orig[3 * v + 2] - q[2]);
      if (d < bd) { bd = d; best = v; }
    }
    if (best < 0) continue;
    const her = samp(bUV[2 * best], bUV[2 * best + 1]);
    const k = luma(her) / herLuma;
    seam.push({ p: v3.mul(q, 100), c: coachLin.map((l) => srgb(l * k)) });
  }
  if (seam.length < 20) throw new Error(`neck seam not found (${seam.length})`);
  const seamInfo = (p) => {
    const near = seam.map((q) => ({ d: v3.len(v3.sub(p, q.p)), c: q.c })).sort((a, b) => a.d - b.d).slice(0, 3);
    let w = 0; const c = [0, 0, 0];
    for (const q of near) { const k = 1 / (q.d * q.d + 1e-4); w += k; for (let j = 0; j < 3; j++) c[j] += q.c[j] * k; }
    return { d: near[0].d, c: c.map((x) => x / w) };
  };
  const img = new Float32Array(FT * FT * 3), cov = new Uint8Array(FT * FT);
  const uvpx = new Float32Array(Array.from(mUV, (u) => u * FT));
  raster(FT, FT, uvpx, mI, (px, py, l0, l1, l2, t) => {
    const a = mI[3 * t], b = mI[3 * t + 1], c = mI[3 * t + 2];
    const p = [0, 1, 2].map((k) => 100 * (mP[3 * a + k] * l0 + mP[3 * b + k] * l1 + mP[3 * c + k] * l2));
    const s = seamInfo(p);
    img.set(paintCoachFace(p, s.c, s.d), 3 * (py * FT + px));
    cov[py * FT + px] = 1;
  });
  const [bx, by, bw, bh] = EAR_BOX;
  for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) {
    img.set(paintCoachEar(((x + 0.5 - bx) / bw) * 2 - 1, 1 - ((y + 0.5 - by) / bh) * 2), 3 * (y * FT + x));
    cov[y * FT + x] = 1;
  }
  dilate(img, cov, FT, FT, 8);
  for (let i = 0; i < FT * FT; i++) if (!cov[i]) img.set(COACH_SKIN, 3 * i);
  const u8 = Buffer.from(img.map((v) => clamp(Math.round(v), 0, 255)));
  return sharp(u8, { raw: { width: FT, height: FT, channels: 3 } }).resize(OUT, OUT, { kernel: "lanczos3" }).jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();
})();
{
  const mat = maskPrim.getMaterial().setName("CoachFace");
  mat.getBaseColorTexture().setImage(new Uint8Array(faceJpeg)).setMimeType("image/jpeg").setName("CoachFace_Diffuse");
  if (process.env.FACE_PNG) await sharp(faceJpeg).toFile(process.env.FACE_PNG);
}

/* ======================= 5. simplify, strip, quantize ======================= */
const RATIO = new Map([[bodyPrim, 0.42], [maskPrim, 0.7], [earPrim, 0.45], [hairPrim, 0.4]]);
for (const [p, ratio] of RATIO) {
  const before = tris(p);
  weldPrimitive(p);
  simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio, error: 0.01 });
  console.log(`${p.getMaterial().getName()}: ${before} -> ${tris(p)} triangles`);
}
for (const tex of root.listTextures()) if (tex.getName() !== "CoachFace_Diffuse") tex.dispose();
await doc.transform(prune({ keepAttributes: true }), quantize({ pattern: /^(NORMAL|TEXCOORD_0|JOINTS_0|WEIGHTS_0)$/, quantizeNormal: 8 }));
// quantize() declares the extension only when positions are quantized too; the normals need it regardless
doc.createExtension(KHRMeshQuantization).setRequired(true);
await io.write(dst, doc);
