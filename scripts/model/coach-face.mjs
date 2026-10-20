// The coach's face, painted in body space like hers (face-paint.mjs: cm, front view, x to his left, y up) on the
// same face mask: smaller smiling eyes with laughter lines, heavy brows, a broad open smile showing teeth, and a
// short dark beard and moustache over the jaw, chin and upper lip, joined to the hair by sideburns.
import { clamp, smooth, mix, polyDist, cumLen, bezier3, hash } from "./face-lib.mjs";

export const COACH_SKIN = [194, 145, 116]; // light-medium, warm
const BEARD = [40, 30, 26];
const AA = 0.035;

const over = (c, col, a) => { if (a <= 0) return; a = Math.min(1, a); c[0] += (col[0] - c[0]) * a; c[1] += (col[1] - c[1]) * a; c[2] += (col[2] - c[2]) * a; };
const fill = (d, soft = AA) => smooth(soft, -soft, d); // d < 0 inside
// value noise on the face (cm, 3D, so it keeps its grain where the face turns away), for hair
const vnoise = (x, y, z, s) => {
  const X = x / s, Y = y / s, Z = z / s, i = Math.floor(X), j = Math.floor(Y), k = Math.floor(Z);
  const u = smooth(0, 1, X - i), v = smooth(0, 1, Y - j), w = smooth(0, 1, Z - k);
  const h = (a, b, c) => hash(a * 157.31 + b * 311.7 + c * 74.97);
  const layer = (c) => mix(mix(h(i, j, c), h(i + 1, j, c), u), mix(h(i, j + 1, c), h(i + 1, j + 1, c), u), v);
  return mix(layer(k), layer(k + 1), w);
};

/* ---------- brows: straight and heavy, a slight arch, a few hairs' grain ---------- */
const BROW = bezier3([1.2, 147.75], [3.0, 148.4], [5.2, 148.55], [7.3, 147.85], 40);
const BROW_CUM = cumLen(BROW);
function brow(c, ax, y) {
  if (ax < 0.6 || ax > 8 || y < 146.8 || y > 149.6) return;
  const [d, s] = polyDist(ax, y, BROW, BROW_CUM);
  const half = mix(0.4, 0.17, Math.pow(s, 1.8)) * (s < 0.1 ? 0.75 + 2.5 * s : 1);
  const grain = 0.82 + 0.18 * vnoise(ax * 3 + y, y * 9, 0, 0.35);
  over(c, [34, 24, 20], 0.92 * grain * fill(d - half, 0.09) * smooth(0, 0.1, s));
}

/* ---------- eyes: smaller than hers, narrowed by the smile ---------- */
const EC = [4.7, 145.2];
const WI = 1.42, WO = 1.58, HU = 0.66, HL = 0.32;
const qOf = (X) => (X < 0 ? X / WI : X / WO);
const lidU = (X) => { const q = qOf(X); return Math.abs(q) >= 1 ? -1e3 : HU * Math.pow(1 - q * q, 0.55) + 0.05 * q; };
// the smile lifts the lower lid into an upward curve
const lidL = (X) => { const q = qOf(X); return Math.abs(q) >= 1 ? 1e3 : -HL * Math.pow(1 - q * q, 0.9) + 0.06 + 0.04 * q; };
const CRINKLES = [-0.42, 0, 0.42].map((a) => {
  const x0 = WO + 0.35, pts = bezier3([x0, 0.1 + a * 0.5], [x0 + 0.35, 0.12 + a * 0.75], [x0 + 0.7, 0.1 + a * 1.0], [x0 + 1.0, 0.05 + a * 1.25], 12);
  return { pts, cum: cumLen(pts) };
});
function eye(c, x, y) {
  const ax = Math.abs(x);
  const X = ax - EC[0], Y = y - EC[1];
  if (X < -2.4 || X > 3.4 || Y < -1.6 || Y > 1.8) return;
  const up = lidU(X), lo = lidL(X);
  // socket shade above the lid, lid crease, the cheek's bulge under the smile
  if (Math.abs(qOf(X)) < 1.15) {
    const qq = Math.min(1, Math.abs(qOf(X)));
    over(c, [150, 98, 76], 0.25 * smooth(0.9, 0.2, Math.abs(Y - (up + 0.45))) * (1 - qq * qq));
    over(c, [96, 58, 44], 0.4 * smooth(0.1, 0, Math.abs(Y - (Math.max(up, 0) + 0.32))) * smooth(-1.2, -0.6, X) * smooth(1.7, 1.0, X));
    over(c, [120, 74, 56], 0.3 * smooth(0.12, 0, Math.abs(Y - (Math.min(lo, 0) - 0.3))) * smooth(-1.0, -0.4, X) * smooth(1.4, 0.8, X));
  }
  for (const k of CRINKLES) {
    const [d, s] = polyDist(X, Y, k.pts, k.cum);
    over(c, [112, 70, 54], 0.5 * (1 - s) * fill(d - 0.03, 0.03));
  }
  const inside = Math.min(up - Y, Y - lo);
  if (inside > -AA) {
    const a = fill(-inside);
    const lidShade = 1 - 0.35 * smooth(0.35, 0, up - Y);
    over(c, [228, 220, 210].map((v) => v * lidShade), a);
    const IX = -0.05, IY = 0.08, R = 0.52;
    const dx = X - IX, dy = Y - IY, r = Math.hypot(dx, dy);
    if (r < R + AA) {
      const t = clamp((IY - Y) / R * 0.5 + 0.5, 0, 1);
      let col = [mix(26, 82, t), mix(15, 48, t), mix(9, 26, t)];
      col = col.map((v, k) => mix(v, [16, 9, 6][k], smooth(0.7, 0.98, r / R)) * lidShade);
      over(c, col, a * fill(r - R));
      over(c, [8, 6, 6], a * fill(r - 0.23));
      const hx = X - (IX + 0.17 * (x < 0 ? 1 : -1)), hy = Y - (IY + 0.17);
      over(c, [255, 255, 255], 0.95 * a * fill(Math.hypot(hx, hy) - 0.11));
    }
  }
  // upper lid line, heavier out to the corner; a faint lower one
  if (up > -10) {
    const q = qOf(X);
    const th = 0.09 + 0.07 * smooth(-0.5, 1, q);
    over(c, [36, 22, 18], fill(Math.max(up - 0.03 - Y, Y - (up + th)), 0.03) * smooth(-1.0, -0.9, q) * smooth(1.08, 0.98, q));
  }
  if (lo < 10) {
    const q = qOf(X);
    over(c, [92, 54, 42], 0.6 * fill(Math.abs(Y - (lo - 0.03)) - 0.04, 0.03) * smooth(-0.8, -0.5, q) * smooth(1.0, 0.85, q));
  }
}

/* ---------- the smile ---------- */
const MW = 2.35, MY = 139.98; // corner half-width; the corners sit up at MY + 0.16
const qm = (x) => Math.abs(x) / MW;
const openTop = (x) => MY + 0.07 + 0.11 * qm(x) ** 2; // the upper lip's lower edge
const openBot = (x) => { const q = qm(x); return q >= 1 ? MY + 0.18 : MY + 0.18 - 0.8 * Math.pow(1 - q * q, 0.75); };
const lipTop = (x) => openTop(x) + 0.3 * Math.pow(Math.max(0, 1 - qm(x) ** 2), 0.5);
const lipBot = (x) => { const q = qm(x) / 0.94; return q >= 1 ? 1e3 : openBot(x) - 0.42 * Math.pow(1 - q * q, 0.6); };
function mouth(c, x, y) {
  if (Math.abs(x) > MW + 0.6 || y < 138.2 || y > 141) return;
  const q = qm(x);
  // lips
  over(c, [150, 88, 76], 0.9 * fill(Math.max(openTop(x) - y, y - lipTop(x)), 0.06) * smooth(1.05, 0.9, q));
  over(c, [166, 102, 88], 0.9 * fill(Math.max(y - openBot(x), lipBot(x) - y), 0.06));
  over(c, [196, 136, 118], 0.15 * Math.exp(-((x / 1.0) ** 2 + ((y - (openBot(x) - 0.22)) / 0.13) ** 2)));
  // the opening: upper teeth over a dark mouth
  const inOpen = fill(Math.max(y - openTop(x), openBot(x) - y), 0.03) * smooth(1.0, 0.95, q);
  if (inOpen > 0) {
    over(c, [58, 26, 26], inOpen);
    const toothBot = openTop(x) - 0.4 * Math.pow(Math.max(0, 1 - q * q), 0.35);
    const tooth = fill(toothBot - y, 0.035);
    // separations between teeth (a gap on the centre line), darker towards the corners
    const w = Math.abs(x) < 0.45 ? 0.45 : Math.abs(x) < 0.85 ? 0.4 : 0.36;
    const off = Math.abs(x) < 0.45 ? Math.abs(x) : Math.abs(x) < 0.85 ? Math.abs(x) - 0.45 : (Math.abs(x) - 0.85) % 0.36;
    const gap = Math.abs(x) < 0.02 || off < 0.025 || w - off < 0.025 ? 0.28 : 0;
    const shade = 1 - 0.45 * smooth(0.35, 0.95, q) - gap;
    over(c, [238, 232, 220].map((v) => v * shade), inOpen * tooth);
  }
  // corners tucked in
  for (const s of [-1, 1]) {
    const dx = (x - s * (MW + 0.02)) / 0.16, dy = (y - (MY + 0.17)) / 0.12;
    over(c, [70, 38, 32], 0.6 * Math.exp(-(dx * dx + dy * dy)));
  }
}

/* ---------- nose ---------- */
function nose(c, x, y) {
  for (const s of [-1, 1]) {
    const dx = (x - s * 0.66) / 0.3, dy = (y - 142.32) / 0.15;
    over(c, [70, 40, 30], 0.55 * Math.exp(-(dx * dx + dy * dy) * 1.4));
    // the side of the bridge
    const bx = (x - s * 1.05) / 0.35, by = (y - 144.3) / 1.4;
    over(c, [150, 96, 74], 0.18 * Math.exp(-(bx * bx + by * by)));
  }
}

/* ---------- beard ---------- */
// the cheek line (|x|, y): a sideburn down in front of the ear, sweeping in to beside the mouth corner
const CHEEK = bezier3([9.4, 147.6], [8.6, 142.6], [6.2, 140.9], [3.0, 141.5], 40);
// how far (cm) under the cheek line a point is (negative above it)
const cheekDepth = (x, y) => {
  const ax = Math.abs(x);
  if (ax <= CHEEK[CHEEK.length - 1][0]) return CHEEK[CHEEK.length - 1][1] - y;
  for (let i = 1; i < CHEEK.length; i++) {
    const [x0, y0] = CHEEK[i - 1], [x1, y1] = CHEEK[i];
    if (ax <= x0 && ax >= x1) return y0 + ((y1 - y0) * (ax - x0)) / (x1 - x0) - y;
  }
  return CHEEK[0][1] - y;
};
// the moustache: under the nose (parted at the philtrum) down over the top of the upper lip, out to the corners
const moustache = (x, y) => {
  const ax = Math.abs(x);
  const top = 141.82 + 0.16 * (ax / 2.6) ** 2 - 0.1 * Math.exp(-((x / 0.35) ** 2));
  const bot = openTop(x) + 0.14 * Math.max(0, 1 - qm(x) ** 2);
  return Math.min(top - y, y - bot, (3.3 - ax) * 1.5);
};
function beard(c, x, y, z, seam) {
  const ax = Math.abs(x);
  if (y > 148.5) return;
  let d = cheekDepth(x, y);
  // the lips and the opening stay clear; the beard resumes 0.15 cm under the lower lip
  if (ax < MW + 0.25) d = Math.min(d, -Math.min(lipTop(x) + 0.05 - y, y - (lipBot(x) - 0.15)));
  const m = moustache(x, y);
  // a neat neckline: thinning out towards the neck seam
  const dens = Math.max(smooth(-0.15, 0.55, d), smooth(-0.1, 0.25, m)) * smooth(0.25, 1.4, seam);
  if (dens <= 0) return;
  const g = vnoise(x, y, z, 0.09), g2 = vnoise(x + 31, y, z, 0.035);
  const hair = clamp(0.6 + 0.3 * g + 0.4 * (g2 - 0.5), 0, 1);
  // shorter, sparser at the cheek line
  const a = dens * hair * mix(0.55, 0.88, smooth(0.2, 1.2, Math.max(d, m)));
  over(c, BEARD.map((v) => v * (0.85 + 0.35 * g2)), a);
}

function cheeks(c, x, y) {
  const dx = (Math.abs(x) - 5.3) / 2.0, dy = (y - 142.6) / 1.4;
  over(c, [206, 128, 104], 0.18 * Math.exp(-(dx * dx + dy * dy) * 1.5));
}

// p: surface point (cm); neck: the neck's colour where the face meets it; seam: distance (cm) to that seam
export function paintCoachFace(p, neck, seam) {
  const [x, y, z] = p;
  const c = [...COACH_SKIN];
  over(c, neck, 1 - smooth(0.1, 1.4, seam));
  cheeks(c, x, y);
  nose(c, x, y);
  brow(c, Math.abs(x), y);
  eye(c, x, y);
  mouth(c, x, y);
  beard(c, x, y, z, seam);
  return c;
}

/* ---------- ear decal (in the ear's own unit disc: u across, v up, both -1..1) ---------- */
export function paintCoachEar(u, v) {
  const c = [...COACH_SKIN];
  const r = Math.hypot(u / 0.62, (v + 0.05) / 0.72);
  over(c, [128, 80, 60], 0.7 * smooth(1.0, 0.75, r));
  over(c, [214, 160, 130], 0.35 * smooth(0.12, 0, Math.abs(Math.hypot(u, v) - 0.93)));
  return c;
}
