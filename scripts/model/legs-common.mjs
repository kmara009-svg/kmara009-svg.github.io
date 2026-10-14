// Shared helpers for scripts/model/rebuild-legs.mjs (see that file for usage).
// shared helpers for the leg rebuild
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
export const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
export const Y_LO = 0.1135, Y_HI = 0.759; // deleted band: bare ankle above the shoe collar ring (0.114) up to the mid-thigh shorts ring (0.744-0.757)
import { PNG } from "pngjs";
let BASE = null;
export function analyse(doc) {
  const root = doc.getRoot();
  const prim = root.listMeshes()[0].listPrimitives()[0];
  const A = (s) => prim.getAttribute(s).getArray();
  const pos = A("POSITION"), J = A("JOINTS_0"), W = A("WEIGHTS_0");
  const idx = prim.getIndices().getArray();
  const joints = root.listSkins()[0].listJoints();
  const ji = (n) => joints.findIndex((j) => j.getName() === `mixamorig:${n}`);
  const wOf = (i, j) => { let s = 0; for (let q = 0; q < 4; q++) if (J[4*i+q] === j) s += W[4*i+q]; return s; };
  const legW = (i, side) => wOf(i, ji(`${side}UpLeg`)) + wOf(i, ji(`${side}Leg`));
  const uv = A("TEXCOORD_0");
  const mat = root.listMaterials()[0];
  if (!BASE) BASE = PNG.sync.read(Buffer.from(mat.getBaseColorTexture().getImage()));
  const texel = (u, v) => { const x = Math.min(BASE.width - 1, Math.max(0, Math.floor(u * BASE.width))), y = Math.min(BASE.height - 1, Math.max(0, Math.floor(v * BASE.height))); const o = 4 * (y * BASE.width + x); return [BASE.data[o], BASE.data[o+1], BASE.data[o+2]]; };
  const skinLike = ([r, g, b]) => r > 60 && r < 220 && r > g * 1.12 && g > b * 1.05 && r - b > 35;
  const inBand = (i) => {
    const x = pos[3*i], y = pos[3*i+1];
    return Math.abs(x) >= 0.004 && y >= Y_LO && y <= Y_HI;
  };
  const keep = [], drop = [];
  for (let t = 0; t < idx.length; t += 3) {
    const tri = [idx[t], idx[t+1], idx[t+2]];
    let del = tri.every(inBand);
    if (del) {
      const side = pos[3*tri[0]] > 0 ? "Left" : "Right";
      const lw = Math.min(...tri.map((i) => legW(i, side)));
      const u = (uv[2*tri[0]] + uv[2*tri[1]] + uv[2*tri[2]]) / 3, v = (uv[2*tri[0]+1] + uv[2*tri[1]+1] + uv[2*tri[2]+1]) / 3;
      const cy = (pos[3*tri[0]+1] + pos[3*tri[1]+1] + pos[3*tri[2]+1]) / 3;
      // the leg proper (strongly leg-weighted), or bare-ankle skin just above the shoe collar
      del = lw >= 0.4 || (cy < 0.2 && lw >= 0.15 && skinLike(texel(u, v)));
    }
    (del ? drop : keep).push(tri);
  }
  return { root, prim, pos, J, W, idx, joints, ji, keep, drop };
}
/* boundary edges of the kept triangles (by position, so split UV seams do not count) */
export function boundary(pos, tris) {
  const key = (i) => `${pos[3*i].toFixed(5)},${pos[3*i+1].toFixed(5)},${pos[3*i+2].toFixed(5)}`;
  const count = new Map();
  for (const t of tris) for (let k = 0; k < 3; k++) {
    const a = t[k], b = t[(k+1)%3];
    const ka = key(a), kb = key(b);
    const e = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    const c = count.get(e) ?? { n: 0, a, b }; c.n++; count.set(e, c);
  }
  return [...count.values()].filter((c) => c.n === 1);
}
