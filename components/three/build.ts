/* Small helpers for building the venue out of merged, vertex-coloured geometry: most of the
   stadium and the park draw in a handful of calls instead of one per part. */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type P2 = [number, number]; // a point on the ground: [x, z]

/* deterministic random numbers, so the venue is the same on every load */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

const col = new THREE.Color();
/* a geometry painted one colour (vertex colours, linear, may exceed 1 for glowing parts), ready to merge */
export function paint(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, gain = 1) {
  const n = g.index ? g.toNonIndexed() : g;
  if (n !== g) g.dispose();
  for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal") n.deleteAttribute(k);
  if (!n.attributes.normal) n.computeVertexNormals();
  col.set(color).multiplyScalar(gain);
  const count = n.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = col.r;
    arr[i * 3 + 1] = col.g;
    arr[i * 3 + 2] = col.b;
  }
  n.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  n.clearGroups();
  return n;
}

export function merge(parts: THREE.BufferGeometry[]) {
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error("merge: incompatible geometries");
  parts.forEach((p) => p.dispose());
  g.computeBoundingSphere();
  return g;
}

/* collects painted parts and merges them */
export class Builder {
  parts: THREE.BufferGeometry[] = [];
  add(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, gain = 1) {
    this.parts.push(paint(g, color, gain));
    return this;
  }
  build() {
    return merge(this.parts);
  }
}

const euler = new THREE.Euler();
const mat = new THREE.Matrix4();
/* a box centred at (x, y, z), turned ry about the vertical (then rx, rz) */
export function box(w: number, h: number, d: number, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx || ry || rz) g.applyMatrix4(mat.makeRotationFromEuler(euler.set(rx, ry, rz, "YXZ")));
  g.translate(x, y, z);
  return g;
}

const up = new THREE.Vector3(0, 1, 0);
const q = new THREE.Quaternion();
const dir = new THREE.Vector3();
/* a square-section beam from a to b */
export function beam(a: THREE.Vector3Like, b: THREE.Vector3Like, t: number, radial = 0) {
  dir.set(b.x - a.x, b.y - a.y, b.z - a.z);
  const len = dir.length();
  const g = radial ? new THREE.CylinderGeometry(t, t, len, radial, 1, true) : new THREE.BoxGeometry(t, len, t);
  g.applyQuaternion(q.setFromUnitVectors(up, dir.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/* a flat strip of the given width along a polyline on the ground, facing up */
export function ribbon(pts: P2[], width: number, y: number, closed = false) {
  const pos: number[] = [];
  const idx: number[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    const [x, z] = pts[i];
    pos.push(x - tz * width / 2, y, z + tx * width / 2, x + tz * width / 2, y, z - tx * width / 2);
  }
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = ((i + 1) % n) * 2;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const nrm = new Float32Array(pos.length);
  for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

/* a flat polygon on the ground (with optional holes), facing up; uvs are metres */
export function flat(outline: P2[], y: number, holes: P2[][] = []) {
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
  const g = new THREE.ShapeGeometry(shape, 1);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/* a closed smooth loop through control points, resampled evenly */
export function loop(ctrl: P2[], n: number): P2[] {
  const c = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, "centripetal");
  return c.getSpacedPoints(n).slice(0, n).map((p) => [p.x, p.z]);
}
/* an open smooth path through control points, resampled evenly */
export function path(ctrl: P2[], n: number): P2[] {
  const c = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal");
  return c.getSpacedPoints(n).map((p) => [p.x, p.z]);
}
/* the loop pushed out (d > 0) or in (d < 0) by d metres */
export function offset(pts: P2[], d: number): P2[] {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % n];
    area += x0 * z1 - x1 * z0;
  }
  const s = area > 0 ? 1 : -1; // area > 0: anticlockwise in (x, z), so outward is to the right of the tangent
  return pts.map(([x, z], i) => {
    const [ax, az] = pts[(i - 1 + n) % n], [bx, bz] = pts[(i + 1) % n];
    let tx = bx - ax, tz = bz - az;
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    return [x + s * tz * d, z - s * tx * d];
  });
}
export function inside([x, z]: P2, poly: P2[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
/* distance from a point to a polyline */
export function distTo([x, z]: P2, pts: P2[], closed = false) {
  let best = Infinity;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

/* triangles turned to face away from a centre point, so hand-made solids need no winding care */
export function solid(tris: THREE.Vector3[][], centre: THREE.Vector3) {
  const pos: number[] = [];
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3();
  for (const [a, b, c] of tris) {
    n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
    m.copy(a).add(b).add(c).divideScalar(3).sub(centre);
    const t = n.dot(m) < 0 ? [a, c, b] : [a, b, c];
    for (const p of t) pos.push(p.x, p.y, p.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
/* a canvas texture drawn by fn */
export function canvasTexture(w: number, h: number, fn: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  fn(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/* per-pixel noise over whatever is drawn, weighted per channel */
export function grain(g: CanvasRenderingContext2D, amount: number, w = [1, 1, 1]) {
  const { width, height } = g.canvas;
  const img = g.getImageData(0, 0, width, height);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    img.data[i] += n * w[0];
    img.data[i + 1] += n * w[1];
    img.data[i + 2] += n * w[2];
  }
  g.putImageData(img, 0, 0);
}
