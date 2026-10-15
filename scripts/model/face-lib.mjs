// geometry, raster and paint helpers for rebuild-face.mjs (all lengths in cm)
export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const mix = (a, b, t) => a + (b - a) * t;

export function slerp(a, b, t) {
  const d = clamp(v3.dot(a, b), -1, 1), w = Math.acos(d);
  if (w < 1e-5) return v3.norm(v3.lerp(a, b, t));
  const s = Math.sin(w);
  return v3.add(v3.mul(a, Math.sin((1 - t) * w) / s), v3.mul(b, Math.sin(t * w) / s));
}

// union-find
export function uf(n) {
  const p = new Int32Array(n).map((_, i) => i);
  const find = (a) => { while (p[a] !== a) { p[a] = p[p[a]]; a = p[a]; } return a; };
  return { find, union: (a, b) => { a = find(a); b = find(b); if (a !== b) p[a] = b; } };
}

// welded vertex id per vertex (same position)
export function weldIds(pos) {
  const n = pos.length / 3, w = new Int32Array(n), key = new Map();
  for (let i = 0; i < n; i++) {
    const k = `${pos[3 * i].toFixed(5)},${pos[3 * i + 1].toFixed(5)},${pos[3 * i + 2].toFixed(5)}`;
    if (!key.has(k)) key.set(k, i);
    w[i] = key.get(k);
  }
  return w;
}

// ordered boundary loops (in welded ids) of a triangle list [[a,b,c],...] (welded ids)
export function boundaryLoops(tris) {
  const ec = new Map();
  for (const t of tris) for (let e = 0; e < 3; e++) {
    const a = t[e], b = t[(e + 1) % 3], k = a < b ? `${a}_${b}` : `${b}_${a}`;
    const r = ec.get(k);
    if (r) r.c++; else ec.set(k, { c: 1, a, b });
  }
  const next = new Map();
  for (const { c, a, b } of ec.values()) if (c === 1) next.set(a, b); // directed along the triangle winding
  const seen = new Set(), loops = [];
  for (const s of next.keys()) {
    if (seen.has(s)) continue;
    const loop = [];
    let cur = s;
    while (cur !== undefined && !seen.has(cur)) { seen.add(cur); loop.push(cur); cur = next.get(cur); }
    loops.push(loop);
  }
  return loops;
}

// ray / triangle (Moller-Trumbore); returns t or -1
export function rayTri(o, d, a, b, c) {
  const e1 = v3.sub(b, a), e2 = v3.sub(c, a), p = v3.cross(d, e2), det = v3.dot(e1, p);
  if (Math.abs(det) < 1e-12) return -1;
  const inv = 1 / det, s = v3.sub(o, a), u = v3.dot(s, p) * inv;
  if (u < 0 || u > 1) return -1;
  const q = v3.cross(s, e1), v = v3.dot(d, q) * inv;
  if (v < 0 || u + v > 1) return -1;
  const t = v3.dot(e2, q) * inv;
  return t > 0 ? t : -1;
}

// closest point on triangle (Ericson)
export function closestOnTri(p, a, b, c) {
  const ab = v3.sub(b, a), ac = v3.sub(c, a), ap = v3.sub(p, a);
  const d1 = v3.dot(ab, ap), d2 = v3.dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return a;
  const bp = v3.sub(p, b), d3 = v3.dot(ab, bp), d4 = v3.dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) return v3.add(a, v3.mul(ab, d1 / (d1 - d3)));
  const cp = v3.sub(p, c), d5 = v3.dot(ab, cp), d6 = v3.dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) return v3.add(a, v3.mul(ac, d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return v3.add(b, v3.mul(v3.sub(c, b), (d4 - d3) / (d4 - d3 + (d5 - d6))));
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return v3.add(a, v3.add(v3.mul(ab, v), v3.mul(ac, w)));
}

// smooth vertex normals for an indexed mesh (positions flat array), area weighted; vertices at the same position
// (uv seams, poles) share one normal so seams do not crease
export function vertexNormals(P, idx) {
  const n = P.length / 3, key = new Map(), weld = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${P[3 * i].toFixed(6)},${P[3 * i + 1].toFixed(6)},${P[3 * i + 2].toFixed(6)}`;
    if (!key.has(k)) key.set(k, i);
    weld[i] = key.get(k);
  }
  const N = new Float32Array(P.length);
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    const A = [P[3 * a], P[3 * a + 1], P[3 * a + 2]], B = [P[3 * b], P[3 * b + 1], P[3 * b + 2]], C = [P[3 * c], P[3 * c + 1], P[3 * c + 2]];
    const nn = v3.cross(v3.sub(B, A), v3.sub(C, A));
    for (const v of [a, b, c]) { const w = weld[v]; N[3 * w] += nn[0]; N[3 * w + 1] += nn[1]; N[3 * w + 2] += nn[2]; }
  }
  for (let i = 0; i < n; i++) {
    const w = weld[i], l = Math.hypot(N[3 * w], N[3 * w + 1], N[3 * w + 2]);
    if (i !== w) continue;
    if (l > 0) { N[3 * i] /= l; N[3 * i + 1] /= l; N[3 * i + 2] /= l; } else N[3 * i + 1] = 1;
  }
  for (let i = 0; i < n; i++) { const w = weld[i]; if (w !== i) { N[3 * i] = N[3 * w]; N[3 * i + 1] = N[3 * w + 1]; N[3 * i + 2] = N[3 * w + 2]; } }
  return N;
}

// uniform Catmull-Rom resample of a closed polyline to n points, spaced by arc length along the input
// (the hair edge input is 48 points 0.6-2.2 cm apart; the curve stays within about 1 mm of the polyline)
export function resampleClosed(pts, n) {
  const m = pts.length, seg = [];
  let total = 0;
  for (let i = 0; i < m; i++) { const l = v3.len(v3.sub(pts[(i + 1) % m], pts[i])); seg.push(l); total += l; }
  const out = [];
  for (let k = 0; k < n; k++) {
    let s = (k / n) * total, i = 0;
    while (s > seg[i] && i < m - 1) { s -= seg[i]; i++; }
    const t = seg[i] > 0 ? s / seg[i] : 0;
    const p0 = pts[(i - 1 + m) % m], p1 = pts[i], p2 = pts[(i + 1) % m], p3 = pts[(i + 2) % m];
    const t2 = t * t, t3 = t2 * t;
    out.push([0, 1, 2].map((k2) => 0.5 * (2 * p1[k2] + (-p0[k2] + p2[k2]) * t + (2 * p0[k2] - 5 * p1[k2] + 4 * p2[k2] - p3[k2]) * t2 + (-p0[k2] + 3 * p1[k2] - 3 * p2[k2] + p3[k2]) * t3)));
  }
  return out;
}

// rasterise triangles in texture space: uv in pixels, calls fn(px, py, l0, l1, l2, triIndex) for covered texel centres
export function raster(W, H, uvpx, idx, fn) {
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const ax = uvpx[2 * a], ay = uvpx[2 * a + 1], bx = uvpx[2 * b], by = uvpx[2 * b + 1], cx = uvpx[2 * c], cy = uvpx[2 * c + 1];
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-12) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 1)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx) + 1));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy) - 1)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy) + 1));
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const x = px + 0.5, y = py + 0.5;
      const l0 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / den;
      const l1 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / den;
      const l2 = 1 - l0 - l1;
      if (l0 < -1e-4 || l1 < -1e-4 || l2 < -1e-4) continue;
      fn(px, py, l0, l1, l2, t / 3);
    }
  }
}

// grow covered texels into uncovered ones (avoids dark seams when mip-mapping)
export function dilate(img, cov, W, H, passes) {
  for (let p = 0; p < passes; p++) {
    const add = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (cov[i]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx;
        if (cov[j]) { r += img[3 * j]; g += img[3 * j + 1]; b += img[3 * j + 2]; n++; }
      }
      if (n) add.push([i, r / n, g / n, b / n]);
    }
    for (const [i, r, g, b] of add) { img[3 * i] = r; img[3 * i + 1] = g; img[3 * i + 2] = b; cov[i] = 1; }
  }
}

// distance from p to segment ab in 2D, and the segment parameter
export function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
  const t = l2 > 0 ? clamp(((px - ax) * vx + (py - ay) * vy) / l2, 0, 1) : 0;
  return [Math.hypot(px - ax - vx * t, py - ay - vy * t), t];
}

// distance to a polyline [[x,y],...] -> [distance, param along 0..1 by arc length]
export function polyDist(px, py, pl, cum) {
  let best = 1e9, bp = 0;
  for (let i = 0; i < pl.length - 1; i++) {
    const [d, t] = segDist(px, py, pl[i][0], pl[i][1], pl[i + 1][0], pl[i + 1][1]);
    if (d < best) { best = d; bp = (cum[i] + (cum[i + 1] - cum[i]) * t) / cum[cum.length - 1]; }
  }
  return [best, bp];
}
export function cumLen(pl) {
  const c = [0];
  for (let i = 1; i < pl.length; i++) c.push(c[i - 1] + Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]));
  return c;
}
export function bezier2(p0, p1, p2, n) {
  const out = [];
  for (let i = 0; i <= n; i++) { const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; out.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]]); }
  return out;
}
export function bezier3(p0, p1, p2, p3, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3;
    out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
  return out;
}

// deterministic hash noise
export function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
export function noise1(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return mix(hash(i), hash(i + 1), u); }
// the same noise, repeating every `period` (an integer), so a texture built from noise1p(u * period) tiles in u
export function noise1p(x, period) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), m = (k) => ((k % period) + period) % period;
  return mix(hash(m(i)), hash(m(i + 1)), u);
}
