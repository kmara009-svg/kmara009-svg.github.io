"use client";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { INNER_R, LANES, LANE_W, OUTER_R, lapLength, pointAt } from "@/lib/trackPath";
import { runnerPose } from "@/lib/scene";
import { Builder, beam, box, canvasTexture, grain, ribbon, rng, solid, type P2 } from "./build";

/* Lakeside Stadium, Albert Park: a blue eight-lane track round a football pitch; the main stand on
   the home straight under its big trussed roof, with the sports centre behind; the long low white
   far stand under a lit canopy; the red-brick heritage grandstand on the west bend; four
   floodlight masts with lamp frames; a big screen at the west end. The stands, roofs, masts and
   buildings are merged vertex-coloured geometry, so the whole venue draws in a few calls. */

const BLUE = "#2b5fad";
const APRON_W = 7;
const STAND_FRONT = OUTER_R + 7.5;

/* ------------------------------------------------------------------ textures */
function trackTexture() {
  return canvasTexture(256, 1024, (g) => {
    g.fillStyle = BLUE;
    g.fillRect(0, 0, 256, 1024);
    grain(g, 20, [0.55, 0.7, 1]);
    g.fillStyle = "rgba(255,255,255,0.92)";
    for (let k = 0; k <= LANES; k++) {
      const y = Math.round((k / LANES) * 1024);
      g.fillRect(0, Math.min(1019, Math.max(0, y - 2)), 256, 5);
    }
    g.fillRect(0, 0, 256, 10); // inner kerb
  });
}
/* the same surface without lines, for the apron and the D's */
function blueTexture() {
  return canvasTexture(256, 256, (g) => {
    g.fillStyle = "#285aa3";
    g.fillRect(0, 0, 256, 256);
    grain(g, 18, [0.55, 0.7, 1]);
  });
}
/* two mown stripes per tile across the pitch */
function pitchTexture() {
  return canvasTexture(512, 512, (g) => {
    g.fillStyle = "#4d8b2f";
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = "rgba(0,0,0,0.075)";
    g.fillRect(0, 0, 256, 512);
    grain(g, 28, [0.6, 1, 0.4]);
  });
}
function chequerTexture() {
  const t = canvasTexture(256, 32, (g) => {
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 === 0 ? "#f7f7f4" : "#1e1e1e";
        g.fillRect(i * 16, j * 16, 16, 16);
      }
  });
  t.repeat.set(5, 1);
  return t;
}
function boardTexture(text: string, w = 1024, h = 128, font = "900 84px Inter, Arial, sans-serif") {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = "#1e1e1e";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#c6f432";
    g.font = font;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 4);
  });
}
function finishBoardTexture() {
  return canvasTexture(1024, 128, (g) => {
    for (let i = 0; i < 32; i++)
      for (let j = 0; j < 4; j++) {
        g.fillStyle = (i + j) % 2 === 0 ? "#f7f7f4" : "#1e1e1e";
        g.fillRect(i * 32, j * 32, 32, 32);
      }
    g.fillStyle = "#1e1e1e";
    g.fillRect(256, 0, 512, 128);
    g.fillStyle = "#c6f432";
    g.font = "900 96px Inter, Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("FINISH", 512, 68);
  });
}

/* ------------------------------------------------------------------ ground surfaces */
/* a band round the oval from radius r0 outwards, uv u along the lap (every 4 m), v across */
function ringGeometry(r0: number, width: number, y: number, samples: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const L = lapLength(r0);
  for (let i = 0; i <= samples; i++) {
    const d = (i / samples) * L;
    const p = pointAt(d, r0);
    const nx = -p.fz, nz = p.fx; // outward (right-hand) normal
    pos.push(p.x, y, p.z, p.x + nx * width, y, p.z + nz * width);
    uv.push(d / 4, 0, d / 4, width / 4);
    if (i < samples) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function trackGeometry() {
  const g = ringGeometry(INNER_R, LANES * LANE_W, 0, 720);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, i % 2); // the texture spans the lanes once
  return g;
}
function infieldGeometry(samples = 240) {
  const shape = new THREE.Shape();
  const L = lapLength(INNER_R - 0.05);
  for (let i = 0; i < samples; i++) {
    const p = pointAt((i / samples) * L, INNER_R - 0.05);
    if (i === 0) shape.moveTo(p.x, -p.z);
    else shape.lineTo(p.x, -p.z);
  }
  shape.closePath();
  const g = new THREE.ShapeGeometry(shape, 1);
  g.rotateX(-Math.PI / 2);
  const uvs = g.attributes.uv as THREE.BufferAttribute;
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < uvs.count; i++) uvs.setXY(i, pos.getX(i) / 8, pos.getZ(i) / 8);
  return g;
}

/* ------------------------------------------------------------------ stands and crowd */
type Stand = { x0: number; x1: number; z0: number; rows: number; dir: 1 | -1; rowDepth: number; rise: number };
const MAIN: Stand = { x0: -58, x1: 58, z0: STAND_FRONT, rows: 24, dir: 1, rowDepth: 0.85, rise: 0.5 }; // home straight
const FAR: Stand = { x0: -55, x1: 55, z0: -STAND_FRONT, rows: 12, dir: -1, rowDepth: 0.85, rise: 0.45 }; // back straight
const STANDS = [MAIN, FAR];

const C = {
  seatMain: "#394a66",
  seatFar: "#e3e6ea",
  concrete: "#a9aaa8",
  steel: "#2f3338",
  roof: "#b9bec6",
  white: "#eceef0",
  glass: "#2c3a4b",
  brick: "#8a3b29",
  roofRed: "#9b2f23",
  cream: "#e8ddc6",
  timber: "#6f5238",
  pole: "#c3c7cc",
};
const LAMP = "#fff3df";

function tiers(b: Builder, s: Stand, seat: string) {
  const len = s.x1 - s.x0, cx = (s.x0 + s.x1) / 2;
  for (let r = 0; r < s.rows; r++) b.add(box(len, (r + 1) * s.rise, s.rowDepth, cx, ((r + 1) * s.rise) / 2, s.z0 + s.dir * (r + 0.5) * s.rowDepth), seat);
  // end walls stepping up with the rows
  for (const x of [s.x0 - 0.3, s.x1 + 0.3])
    for (let r = 0; r < s.rows; r++) b.add(box(0.6, (r + 1) * s.rise + 0.9, s.rowDepth, x, ((r + 1) * s.rise + 0.9) / 2, s.z0 + s.dir * (r + 0.5) * s.rowDepth), C.concrete);
  b.add(box(len + 1.2, 1.1, 0.2, cx, 0.55, s.z0 - s.dir * 0.1), C.white); // front wall
}

/* the main stand's sports centre, its roof (deck, fascia and a row of deep steel trusses on top) */
const BZ0 = MAIN.z0 + MAIN.rows * MAIN.rowDepth;
const BZ1 = BZ0 + 22;
const BW = 128;
const BH = 21;
const RY = 25;
const RZ0 = MAIN.z0 + 4.5;
const RZ1 = BZ1 + 2;
function mainStand(b: Builder, glow: Builder, r: () => number) {
  tiers(b, MAIN, C.seatMain);
  // the building: glass core wrapped in white floor slabs
  b.add(box(BW, BH, BZ1 - BZ0, 0, BH / 2, (BZ0 + BZ1) / 2), C.glass);
  for (let f = 0; f <= 5; f++) b.add(box(BW + 0.8, 0.7, BZ1 - BZ0 + 0.8, 0, 0.35 + f * 4.1, (BZ0 + BZ1) / 2), C.white);
  // lit offices on the car park side, corporate boxes over the back row
  for (let f = 0; f < 5; f++)
    for (let x = -BW / 2 + 2; x < BW / 2 - 6; x += 6.2) if (r() < 0.4) glow.add(box(6, 3.0, 0.1, x + 3, 0.7 + f * 4.1 + 1.7, BZ1 + 0.06), "#ffd7a3", 0.25 + r() * 0.3);
  for (let x = -56; x < 56; x += 7) glow.add(box(6.4, 3.4, 0.1, x + 3.5, 15.2, BZ0 - 0.06), r() < 0.7 ? "#ffd9ad" : "#a9bcd6", 0.22 + r() * 0.3); // corporate boxes
  // roof deck and fascia
  b.add(box(BW + 4, 0.5, RZ1 - RZ0, 0, RY, (RZ0 + RZ1) / 2), C.roof);
  b.add(box(BW + 4.4, 1.5, 0.4, 0, RY - 0.25, RZ0), C.white);
  // columns from the building up to the deck
  for (let x = -BW / 2 + 2; x <= BW / 2 - 2; x += (BW - 4) / 9) b.add(box(0.7, RY - BH, 0.7, x, (RY + BH) / 2, BZ0 + 0.6), C.steel);
  // trusses across the roof: deepest over the building front, tapering to the front edge and the back
  const top = (z: number) => (z < BZ0 ? RY + 1 + (4.6 * (z - RZ0)) / (BZ0 - RZ0) : RY + 5.6 - (2.8 * (z - BZ0)) / (RZ1 - BZ0));
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  for (let k = 0; k <= 10; k++) {
    const x = -BW / 2 - 1 + (k * (BW + 2)) / 10;
    const n = 10;
    for (let i = 0; i < n; i++) {
      const z0 = RZ0 + ((RZ1 - RZ0) * i) / n, z1 = RZ0 + ((RZ1 - RZ0) * (i + 1)) / n;
      b.add(beam(v(x, top(z0), z0), v(x, top(z1), z1), 0.45), C.steel); // top chord
      b.add(beam(v(x, RY + 0.25, i % 2 ? z1 : z0), v(x, top(i % 2 ? z0 : z1), i % 2 ? z0 : z1), 0.3), C.steel); // diagonal
      b.add(beam(v(x, RY + 0.25, z1), v(x, top(z1), z1), 0.25), C.steel); // vertical
    }
  }
  for (const z of [RZ0 + 0.2, BZ0, RZ1 - 0.2]) b.add(box(BW + 4, 0.5, 0.5, 0, top(z), z), C.steel); // girders along the stand
  // strip lights under the deck
  for (const z of [RZ0 + 2.5, RZ0 + 9]) glow.add(box(BW, 0.12, 0.5, 0, RY - 0.32, z), LAMP, 2.2);
}

function farStand(b: Builder, glow: Builder) {
  tiers(b, FAR, C.seatFar);
  const len = FAR.x1 - FAR.x0;
  const back = FAR.z0 - FAR.rows * FAR.rowDepth;
  const top = (FAR.rows + 1) * FAR.rise;
  b.add(box(len + 1.2, top + 1.6, 0.5, 0, (top + 1.6) / 2, back - 0.25), "#59606a");
  // the thin white canopy on slim posts, with a light strip under its front edge
  const cy = 10.4, cz0 = back - 0.6, cz1 = FAR.z0 - 1.4;
  b.add(box(len + 2, 0.35, cz1 - cz0, 0, cy, (cz0 + cz1) / 2), C.white);
  b.add(box(len + 2.2, 0.8, 0.16, 0, cy - 0.1, cz1), C.white);
  for (let x = -len / 2; x <= len / 2 + 0.01; x += len / 10) {
    b.add(box(0.3, cy, 0.3, x, cy / 2, back - 0.6), C.white);
    b.add(beam(new THREE.Vector3(x, cy - 3.5, back - 0.6), new THREE.Vector3(x, cy - 0.2, back + 3.5), 0.18), C.white);
  }
  glow.add(box(len, 0.1, 0.45, 0, cy - 0.25, cz1 - 0.6), LAMP, 3);
  glow.add(box(len + 1.6, 0.02, cz1 - cz0 - 0.6, 0, cy - 0.19, (cz0 + cz1) / 2), "#c9ccd6", 0.42); // its underside, lit by the strip
}

/* a hipped roof over a w x d rectangle from eaves height y0, rising at 45 degrees to the ridge */
function hipRoof(w: number, d: number, y0: number) {
  const a = w / 2, h = d / 2, r = a - h, y1 = y0 + h * 0.62;
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const A = V(-a, y0, -h), B = V(a, y0, -h), Cc = V(a, y0, h), D = V(-a, y0, h), R1 = V(-r, y1, 0), R2 = V(r, y1, 0);
  return solid(
    [[A, B, R2], [A, R2, R1], [Cc, D, R1], [Cc, R1, R2], [D, A, R1], [B, Cc, R2], [A, D, Cc], [A, Cc, B]],
    V(0, y0 + 0.5, 0)
  );
}

/* the 1926 grandstand: brick base and walls, timber benches, cream posts and valance, red hipped roof.
   Built facing -z with the front centre at the origin, then set on the west bend facing the track. */
const HERITAGE = (() => {
  const c = { x: -42.2, z: 0 }; // west bend centre
  const f = new THREE.Vector2(0.72, -0.69).normalize(); // facing the infield
  const R = 70;
  // its size, and its ten rows of benches: each row rise above the last, row r centred at z0 + (r + 0.5) * depth
  const size = { L: 42, D: 13, base: 2.4, eave: 11.4 };
  const benches = { rows: 10, rise: 0.5, depth: 0.95, z0: 0.9, len: size.L - 1.2 };
  return { x: c.x - f.x * R, z: c.z - f.y * R, yaw: Math.atan2(-f.x, -f.y), ...size, benches };
})();
function heritage(b: Builder) {
  const { L, D, base, eave, benches: bn } = HERITAGE;
  const parts = new Builder();
  parts.add(box(L, base, D, 0, base / 2, D / 2), C.brick);
  for (let r = 0; r < bn.rows; r++) parts.add(box(bn.len, (r + 1) * bn.rise, 0.9, 0, base + ((r + 1) * bn.rise) / 2, bn.z0 + (r + 0.5) * bn.depth), C.timber);
  parts.add(box(L, eave, 0.6, 0, eave / 2, D - 0.3), C.brick);
  for (const s of [-1, 1]) parts.add(box(0.6, eave - 1.5, D, s * (L / 2 - 0.3), (eave - 1.5) / 2, D / 2), C.brick);
  for (let k = -4; k <= 4; k++) parts.add(box(2.2, 1.7, 0.1, k * 4.5, 0.85, -0.06), "#2a201b"); // doorways under the seats
  for (let k = 0; k <= 8; k++) parts.add(new THREE.CylinderGeometry(0.14, 0.14, eave - base, 8).translate(-L / 2 + 1 + (k * (L - 2)) / 8, (eave + base) / 2, 0.5), C.cream);
  parts.add(box(L + 1.2, 0.8, 0.15, 0, eave - 0.2, -0.5), C.cream);
  parts.add(box(L - 1, 0.5, 0.12, 0, base + 0.25, 0.3), C.cream); // front rail
  parts.add(hipRoof(L + 1.2, D + 1.2, eave).translate(0, 0, D / 2), C.roofRed);
  const g = parts.build();
  g.rotateY(HERITAGE.yaw);
  g.translate(HERITAGE.x, 0, HERITAGE.z);
  b.parts.push(g);
}

/* four masts with lamp frames tilted down at the middle of the field */
const FLOODS: P2[] = [[-108, -74], [108, -74], [110, 76], [-124, 14]];
function floodlights(b: Builder, glow: Builder) {
  const m = new THREE.Matrix4(), ry = new THREE.Matrix4(), rx = new THREE.Matrix4();
  for (const [x, z] of FLOODS) {
    b.add(new THREE.CylinderGeometry(0.42, 0.95, 50, 10).translate(x, 25, z), C.pole);
    m.makeTranslation(x, 51.5, z).multiply(ry.makeRotationY(Math.atan2(-x, -z))).multiply(rx.makeRotationX(0.42));
    const frame = new Builder();
    frame.add(box(10.6, 6.8, 0.45, 0, 0, 0), C.steel);
    for (let i = 0; i <= 4; i++) frame.add(box(0.25, 6.8, 0.6, -5.3 + i * 2.65, 0, 0.1), "#4a4f56");
    const fg = frame.build().applyMatrix4(m);
    b.parts.push(fg);
    const lamps = new Builder();
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) lamps.add(box(1.25, 1.05, 0.25, -4.3 + i * 1.72, -2.4 + j * 1.6, 0.35), LAMP, 7);
    glow.parts.push(lamps.build().applyMatrix4(m));
  }
}

/* the big screen at the west end, on two legs, facing down the track */
const SCREEN = { x: -121, y: 15, z: -20, w: 22, h: 6.5 };
function screenFrame(b: Builder) {
  const { x, y, z, w, h } = SCREEN;
  b.add(box(1, h + 1.2, w + 1.2, x - 0.6, y, z), C.steel);
  for (const s of [-1, 1]) b.add(box(0.9, y - h / 2, 0.9, x - 0.8, (y - h / 2) / 2, z + s * w * 0.3), C.steel);
}

/* football goals, the hammer cage's posts, the fence round the bends */
const CAGE = { x: -62, z: 6, r: 3.6, h: 7 };
function fittings(b: Builder) {
  for (const s of [-1, 1]) {
    const x = s * 52.5;
    for (const zz of [-3.66, 3.66]) b.add(new THREE.CylinderGeometry(0.06, 0.06, 2.44, 8).translate(x, 1.22, zz), C.white);
    b.add(box(0.12, 0.12, 7.44, x, 2.44, 0), C.white);
    for (const zz of [-3.66, 3.66]) b.add(beam(new THREE.Vector3(x, 2.44, zz), new THREE.Vector3(x + s * 1.8, 0, zz), 0.05, 6), C.white);
    b.add(box(0.05, 0.05, 7.32, x + s * 1.8, 0.02, 0), C.white);
  }
  for (let k = 0; k < 8; k++) {
    const a = Math.PI * 0.2 + (k / 7) * Math.PI * 1.6; // open towards the field (+x)
    b.add(new THREE.CylinderGeometry(0.07, 0.07, CAGE.h, 6).translate(CAGE.x + Math.cos(a) * CAGE.r, CAGE.h / 2, CAGE.z + Math.sin(a) * CAGE.r), "#c9ccd0");
  }
  // low fence round both bends, on the edge of the concourse
  const R = 60;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 48; i++) {
      const a0 = -Math.PI / 2 + (i / 48) * Math.PI, a1 = -Math.PI / 2 + ((i + 1) / 48) * Math.PI;
      const cx = s * 42.195;
      const p0 = new THREE.Vector3(cx + s * R * Math.cos(a0), 0.55, R * Math.sin(a0)), p1 = new THREE.Vector3(cx + s * R * Math.cos(a1), 0.55, R * Math.sin(a1));
      const seg = box(p0.distanceTo(p1) + 0.05, 1.1, 0.06, (p0.x + p1.x) / 2, 0.55, (p0.z + p1.z) / 2, Math.atan2(-(p1.z - p0.z), p1.x - p0.x));
      b.add(seg, "#3a4048");
    }
  }
}

/* white lines of a 105 x 68 m pitch, flat on the grass */
function pitchLines() {
  const b = new Builder();
  const W = 0.12, y = 0.004;
  const line = (pts: P2[], closed = false) => b.add(ribbon(pts, W, y, closed), "#f1f2ee");
  const arc = (cx: number, cz: number, r: number, a0: number, a1: number, n = 40): P2[] =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / n;
      return [cx + r * Math.cos(a), cz + r * Math.sin(a)];
    });
  const X = 52.5, Z = 34;
  line([[-X, -Z], [X, -Z]]);
  line([[-X, Z], [X, Z]]);
  line([[-X, -Z - W / 2], [-X, Z + W / 2]]);
  line([[X, -Z - W / 2], [X, Z + W / 2]]);
  line([[0, -Z], [0, Z]]);
  line(arc(0, 0, 9.15, 0, Math.PI * 2, 64).slice(0, 64), true);
  line(arc(0, 0, 0.15, 0, Math.PI * 2, 12).slice(0, 12), true);
  for (const s of [-1, 1]) {
    const gx = s * X;
    line([[gx, -20.16], [gx - s * 16.5, -20.16], [gx - s * 16.5, 20.16], [gx, 20.16]]);
    line([[gx, -9.16], [gx - s * 5.5, -9.16], [gx - s * 5.5, 9.16], [gx, 9.16]]);
    const a = Math.acos(5.5 / 9.15);
    line(s < 0 ? arc(gx - s * 11, 0, 9.15, -a, a, 24) : arc(gx - s * 11, 0, 9.15, Math.PI - a, Math.PI + a, 24));
    line(arc(gx - s * 11, 0, 0.15, 0, Math.PI * 2, 10).slice(0, 10), true);
  }
  return b.build();
}

/* ------------------------------------------------------------------ crowd */
const SHIRTS = ["#c6f432", "#f7f7f4", "#1e1e1e", "#2d6cdf", "#d7263d", "#f2b705", "#8ec5ff", "#6b3fa0", "#f28c28", "#2a9d8f", "#e9e4d8", "#444a52"];
const SKINS = ["#f1c9a5", "#e0ac7e", "#c68642", "#8d5524", "#5c3a21", "#3b2314", "#ffdbac", "#a0673c"];

function useCrowd() {
  return useMemo(() => {
    const seats: { x: number; y: number; z: number; shirt: THREE.Color; skin: THREE.Color }[] = [];
    let rnd = 12345;
    const r = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const sit = (x: number, y: number, z: number) =>
      seats.push({ x, y, z, shirt: new THREE.Color(SHIRTS[Math.floor(r() * SHIRTS.length)]), skin: new THREE.Color(SKINS[Math.floor(r() * SKINS.length)]) });
    for (const s of STANDS) {
      for (let row = 0; row < s.rows; row++) {
        for (let x = s.x0 + 0.3; x < s.x1; x += 0.56) {
          if (r() < 0.14) continue; // empty seat
          sit(x + (r() - 0.5) * 0.08, (row + 1) * s.rise + 0.62, s.z0 + s.dir * ((row + 0.5) * s.rowDepth + 0.15));
        }
      }
    }
    // the heritage grandstand's benches, laid out in its own frame (facing -z, front centre at the
    // origin) and turned onto the west bend with it
    const H = HERITAGE, bn = H.benches, cos = Math.cos(H.yaw), sin = Math.sin(H.yaw);
    for (let row = 0; row < bn.rows; row++) {
      for (let lx = -bn.len / 2 + 0.3; lx < bn.len / 2 - 0.2; lx += 0.56) {
        if (r() < 0.12) continue;
        const x = lx + (r() - 0.5) * 0.08, z = bn.z0 + (row + 0.5) * bn.depth + 0.15;
        sit(H.x + x * cos + z * sin, H.base + (row + 1) * bn.rise + 0.62, H.z - x * sin + z * cos);
      }
    }
    return seats;
  }, []);
}

function Crowd() {
  const seats = useCrowd();
  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const [bodyMat, headMat] = useMemo(
    () =>
      [0, 1].map(() => {
        const m = new THREE.MeshLambertMaterial({ color: "#ffffff" });
        m.onBeforeCompile = (shader) => {
          shader.uniforms.uTime = uniforms.uTime;
          shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;").replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
            #ifdef USE_INSTANCING
              float seed = instanceMatrix[3][0] * 1.7 + instanceMatrix[3][2] * 0.9;
              transformed.y += 0.035 * sin(uTime * 2.3 + seed) * step(0.35, fract(seed * 0.37));
            #endif`
          );
        };
        m.customProgramCacheKey = () => "crowd-bob";
        return m;
      }),
    [uniforms]
  );

  useEffect(() => {
    const dummy = new THREE.Object3D();
    seats.forEach((s, i) => {
      dummy.position.set(s.x, s.y, s.z);
      dummy.updateMatrix();
      bodies.current!.setMatrixAt(i, dummy.matrix);
      bodies.current!.setColorAt(i, s.shirt);
      dummy.position.set(s.x, s.y + 0.42, s.z);
      dummy.updateMatrix();
      heads.current!.setMatrixAt(i, dummy.matrix);
      heads.current!.setColorAt(i, s.skin);
    });
    for (const m of [bodies.current!, heads.current!]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [seats]);
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, seats.length]} material={bodyMat} frustumCulled={false}>
        <capsuleGeometry args={[0.2, 0.34, 2, 6]} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, seats.length]} material={headMat} frustumCulled={false}>
        <sphereGeometry args={[0.12, 6, 5]} />
      </instancedMesh>
    </group>
  );
}

/* a high, cool key light standing in for the floodlights, with a shadow camera that follows the runner */
export function Sun() {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    if (!light.current) return;
    target.position.set(runnerPose.x, 0, runnerPose.z);
    target.updateMatrixWorld();
    light.current.position.set(runnerPose.x + 45, 90, runnerPose.z - 60);
  });
  return (
    <>
      <directionalLight
        ref={light}
        target={target}
        intensity={2.5}
        color="#f6f3ff"
        castShadow
        shadow-mapSize={[1536, 1536]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-near={10}
        shadow-camera-far={260}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <primitive object={target} />
      <hemisphereLight args={["#a9a3dc", "#4d5638", 0.6]} />
    </>
  );
}

export default function Stadium() {
  const surfaces = useMemo(() => {
    const blue = blueTexture();
    const apronTex = blue.clone();
    apronTex.repeat.set(1, 1);
    const pitch = pitchTexture();
    pitch.repeat.set(10, 68 / 10.5);
    return {
      track: trackGeometry(),
      apron: ringGeometry(OUTER_R, APRON_W, -0.005, 360),
      concourse: ringGeometry(OUTER_R + APRON_W, 7, -0.02, 240),
      infield: infieldGeometry(),
      trackTex: trackTexture(),
      blue,
      apronTex,
      pitch,
      lines: pitchLines(),
    };
  }, []);
  const { structure, glow } = useMemo(() => {
    const r = rng(99);
    const b = new Builder(), g = new Builder();
    mainStand(b, g, r);
    farStand(b, g);
    heritage(b);
    floodlights(b, g);
    screenFrame(b);
    fittings(b);
    return { structure: b.build(), glow: g.build() };
  }, []);
  const structMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.08 }), []);
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true }), []);
  const lineMat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), []);
  const chequer = useMemo(chequerTexture, []);
  const finishTex = useMemo(finishBoardTexture, []);
  const screenTex = useMemo(() => boardTexture("REFUEL · REBUILD · RETURN", 1024, 256, "900 96px Inter, Arial, sans-serif"), []);
  const finish = pointAt(0, INNER_R + (LANES * LANE_W) / 2);

  return (
    <group>
      <Sun />
      {/* track, apron, infield (blue D's, grass pitch, lines), concourse */}
      <mesh geometry={surfaces.track} receiveShadow>
        <meshStandardMaterial map={surfaces.trackTex} roughness={0.95} />
      </mesh>
      <mesh geometry={surfaces.apron} receiveShadow>
        <meshStandardMaterial map={surfaces.apronTex} roughness={0.95} />
      </mesh>
      <mesh geometry={surfaces.concourse} receiveShadow>
        <meshStandardMaterial color="#8f8f8b" roughness={1} />
      </mesh>
      <mesh geometry={surfaces.infield} position={[0, -0.012, 0]} receiveShadow>
        <meshStandardMaterial map={surfaces.blue} roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.004, 0]} receiveShadow>
        <planeGeometry args={[105, 68]} />
        <meshStandardMaterial map={surfaces.pitch} roughness={1} />
      </mesh>
      <mesh geometry={surfaces.lines} material={lineMat} receiveShadow />
      {/* start / finish line across the lanes, with a half gantry on the outside */}
      <group position={[finish.x, 0, finish.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
          <planeGeometry args={[0.6, LANES * LANE_W]} />
          <meshBasicMaterial map={chequer} />
        </mesh>
        {[-(LANES * LANE_W) / 2 - 0.6, (LANES * LANE_W) / 2 + 0.6].map((z, i) => (
          <mesh key={i} position={[0, 1.5, z]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 3, 10]} />
            <meshStandardMaterial color="#f7f7f4" />
          </mesh>
        ))}
        <mesh position={[0, 3.1, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow>
          <boxGeometry args={[LANES * LANE_W + 1.4, 0.6, 0.08]} />
          <meshStandardMaterial map={finishTex} emissive="#ffffff" emissiveMap={finishTex} emissiveIntensity={0.35} />
        </mesh>
      </group>
      {/* stands, roofs, buildings, masts and fittings in one draw; lamps and lit glass in another */}
      <mesh geometry={structure} material={structMat} castShadow receiveShadow />
      <mesh geometry={glow} material={glowMat} />
      <Crowd />
      {/* hammer cage net */}
      <mesh position={[CAGE.x, CAGE.h / 2, CAGE.z]} rotation={[0, Math.PI * 0.5 + Math.PI * 0.2, 0]}>
        <cylinderGeometry args={[CAGE.r, CAGE.r, CAGE.h, 24, 1, true, 0, Math.PI * 1.6]} />
        <meshBasicMaterial color="#1b1d21" transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* big screen */}
      <mesh position={[SCREEN.x, SCREEN.y, SCREEN.z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[SCREEN.w, SCREEN.h]} />
        <meshBasicMaterial map={screenTex} />
      </mesh>
    </group>
  );
}
