// The face, painted in body space (cm, front view: x to her left, y up). Each texel of the face texture knows the
// surface point it shows, so the features are drawn as shapes on the face itself, whatever the uv layout.
import { clamp, smooth, mix, polyDist, cumLen, bezier3, bezier2 } from "./face-lib.mjs";

export const SKIN = [97, 61, 38]; // the body's skin tone (legs, arms, torso)
const AA = 0.035; // edge softness, about one texel

const over = (c, col, a) => { if (a <= 0) return; a = Math.min(1, a); c[0] += (col[0] - c[0]) * a; c[1] += (col[1] - c[1]) * a; c[2] += (col[2] - c[2]) * a; };
const fill = (d, soft = AA) => smooth(soft, -soft, d); // d < 0 inside

/* ---------- brows ---------- */
const BROW = bezier3([1.45, 148.0], [2.9, 149.05], [4.9, 149.5], [7.35, 148.5], 40);
const BROW_CUM = cumLen(BROW);
function brow(c, ax, y) {
  if (ax < 0.9 || ax > 7.9 || y < 147.4 || y > 150.2) return;
  const [d, s] = polyDist(ax, y, BROW, BROW_CUM);
  const half = mix(0.39, 0.1, Math.pow(s, 1.6)) * (s < 0.08 ? 0.82 + 2.2 * s : 1);
  const a = fill(d - half, 0.05) * smooth(0, 0.12, s);
  over(c, [26, 16, 13], 0.96 * a);
}

/* ---------- eyes ---------- */
const EC = [4.85, 145.3], TILT = 0.07; // centre (|x|, y), outer corner lifted
const WI = 1.95, WO = 2.1, HU = 1.16, HL = 0.98; // the upper lid sits over the top of the iris
const lidU = (X) => { const q = X < 0 ? X / WI : X / WO; return Math.abs(q) >= 1 ? -1e3 : HU * Math.pow(1 - q * q, 0.6) - 0.05 * q; };
const lidL = (X) => { const q = X < 0 ? X / WI : X / WO; return Math.abs(q) >= 1 ? 1e3 : -HL * Math.pow(1 - q * q, 0.8) + 0.05 * q; };
const LASHES = [0.12, 0.34, 0.54, 0.72, 0.88, 1.0].map((q, k) => {
  const X = q * WO * 0.97, y0 = lidU(Math.min(X, WO * 0.96)) + 0.12;
  const len = 0.42 + 0.22 * q;
  const p0 = [X, y0], p1 = [X + 0.12 + 0.25 * q, y0 + len * 0.75], p2 = [X + 0.25 + 0.5 * q, y0 + len * (0.95 - 0.25 * q)];
  const pl = bezier2(p0, p1, p2, 10);
  return { pl, cum: cumLen(pl), w: 0.075 - 0.01 * k };
});
// the wing leaves the lash line just inside the outer corner (on the lid, not in the white) and flicks up and out
const WING = (() => { const x0 = WO - 0.35, pl = bezier2([x0, lidU(x0) + 0.08], [WO + 0.15, 0.36], [WO + 0.62, 0.62], 12); return { pl, cum: cumLen(pl) }; })();
function eye(c, x, y) {
  const ax = Math.abs(x);
  let X = ax - EC[0], Y = y - EC[1];
  if (X < -2.8 || X > 3.3 || Y < -1.6 || Y > 2.6) return;
  Y -= TILT * X;
  const up = lidU(X), lo = lidL(X);
  // lid crease
  if (up > 0) {
    const crease = Y - (up + 0.48 + 0.05 * Math.max(0, X));
    over(c, [62, 37, 24], 0.32 * smooth(0.14, 0, Math.abs(crease)) * smooth(-2.1, -1.2, X) * smooth(2.4, 1.6, X));
  }
  // eye white
  const inside = Math.min(up - Y, Y - lo);
  if (inside > -AA) {
    const a = fill(-inside);
    const w = [240, 235, 229];
    const lidShade = 1 - 0.3 * smooth(0.55, 0, up - Y);
    const cornerShade = 1 - 0.18 * smooth(-1.2, -1.9, X) - 0.15 * smooth(1.3, 2.05, X);
    over(c, w.map((v) => v * lidShade * cornerShade), a);
    // iris: the screen-left offset of the highlights is the same for both eyes (one light)
    const IX = -0.1, IY = 0.1, R = 1.12;
    const dx = X - IX, dy = Y - IY, r = Math.hypot(dx, dy);
    if (r < R + AA) {
      const t = clamp((IY - Y) / R * 0.5 + 0.5, 0, 1); // 0 top, 1 bottom
      // dark brown, lighter towards the bottom
      let col = [mix(30, 96, Math.pow(t, 1.4)), mix(16, 56, Math.pow(t, 1.4)), mix(9, 28, Math.pow(t, 1.4))];
      const ring = smooth(0.72, 0.98, r / R);
      col = col.map((v, k) => mix(v, [18, 10, 6][k], ring));
      // fine radial fibres
      const ang = Math.atan2(dy, dx);
      const fib = 0.92 + 0.08 * Math.sin(ang * 23 + 1.3) * Math.sin(ang * 7.0);
      col = col.map((v) => v * fib * lidShade);
      over(c, col, a * fill(r - R));
      over(c, [8, 6, 6], a * fill(r - 0.46));
      // the highlights sit towards screen-left on both eyes (one light): outward on her right eye, inward on her left
      const hx = (X - (IX + 0.36 * (x < 0 ? 1 : -1))), hy = Y - (IY + 0.36);
      over(c, [255, 255, 255], 0.97 * a * fill(Math.hypot(hx, hy) - 0.27));
      const h2x = X - (IX - 0.34 * (x < 0 ? 1 : -1)), h2y = Y - (IY - 0.38);
      over(c, [255, 255, 255], 0.85 * a * fill(Math.hypot(h2x, h2y) - 0.11));
    }
  }
  // upper lash line, thicker towards the outer corner, ending in a small wing
  if (up > -10) {
    const q = X < 0 ? X / WI : X / WO;
    const th = 0.12 + 0.17 * smooth(-0.6, 1, q);
    const d = Math.max(up - 0.04 - Y, Y - (up + th));
    over(c, [16, 10, 8], fill(d, 0.03) * smooth(-1.0, -0.93, q));
  }
  {
    const [d, s] = polyDist(X, Y, WING.pl, WING.cum);
    over(c, [16, 10, 8], fill(d - mix(0.13, 0.015, s), 0.03));
  }
  for (const L of LASHES) {
    const [d, s] = polyDist(X, Y, L.pl, L.cum);
    over(c, [16, 10, 8], fill(d - mix(L.w, 0.012, s), 0.025));
  }
  // lower lash line
  if (lo < 10) {
    const q = X < 0 ? X / WI : X / WO;
    const d = Math.abs(Y - (lo - 0.03)) - 0.035 - 0.02 * smooth(0, 1, q);
    over(c, [52, 30, 22], 0.75 * fill(d, 0.03) * smooth(-0.75, -0.4, q) * smooth(1.02, 0.9, q));
  }
}

/* ---------- lips ---------- */
const YM = 139.86, WM = 2.5;
const upperTop = (x) => {
  const ax = Math.abs(x), q = ax / WM;
  if (q >= 1) return YM;
  return YM + 0.92 * Math.pow(1 - q * q, 0.5) - 0.13 * Math.exp(-((x / 0.24) ** 2)) + 0.07 * Math.exp(-(((ax - 0.52) / 0.3) ** 2));
};
// past the corners there is no lower lip (returning YM there would paint a sliver between YM and the curved mouth line)
const lowerBot = (x) => { const q = Math.abs(x) / (WM * 0.94); return q >= 1 ? 1e3 : YM - 1.08 * Math.pow(1 - q * q, 0.55); };
const mouthLine = (x) => YM + 0.06 * (x / WM) ** 2;
function lips(c, x, y) {
  if (Math.abs(x) > WM + 0.4 || y < 138.7 || y > 141.2) return;
  const ml = mouthLine(x);
  const dU = Math.max(ml - y, y - upperTop(x)), dL = Math.max(y - ml, lowerBot(x) - y);
  // matte peach-brown, the upper lip a shade darker
  over(c, [126, 70, 54], 0.95 * fill(dU, 0.05));
  over(c, [164, 98, 76], 0.95 * fill(dL, 0.05));
  // soft sheen on the lower lip
  const hx = x / 1.05, hy = (y - (ml - 0.42)) / 0.22;
  over(c, [196, 134, 108], 0.12 * Math.exp(-(hx * hx + hy * hy)));
  // mouth line, a touch heavier at the corners
  const q = Math.abs(x) / WM;
  over(c, [52, 24, 21], fill(Math.abs(y - ml) - (0.035 + 0.035 * q), 0.03) * smooth(1.06, 0.98, q));
}

/* ---------- cheeks and nose ---------- */
function blush(c, x, y) {
  const dx = (Math.abs(x) - 5.0) / 1.9, dy = (y - 142.05) / 1.25;
  const g = Math.exp(-(dx * dx + dy * dy) * 1.6);
  over(c, [150, 64, 52], 0.42 * g);
}
function nose(c, x, y) {
  for (const s of [-1, 1]) {
    const dx = (x - s * 0.66) / 0.3, dy = (y - 142.32) / 0.15;
    over(c, [48, 27, 18], 0.55 * Math.exp(-(dx * dx + dy * dy) * 1.4));
  }
  const tx = x / 0.75, ty = (y - 143.1) / 0.6;
  over(c, [118, 62, 44], 0.25 * Math.exp(-(tx * tx + ty * ty)));
}

// p: surface point (cm); neck: the neck's colour at the nearest point of the face/neck seam; seam: distance (cm) to it
export function paintFace(p, neck, seam) {
  const [x, y] = p;
  const c = [...SKIN];
  over(c, neck, 1 - smooth(0.1, 1.4, seam));
  blush(c, x, y);
  nose(c, x, y);
  brow(c, Math.abs(x), y);
  eye(c, x, y);
  lips(c, x, y);
  return c;
}

/* ---------- ear decal (in the ear's own unit disc: u across, v up, both -1..1) ---------- */
export function paintEar(u, v) {
  const c = [...SKIN];
  const r = Math.hypot(u / 0.62, (v + 0.05) / 0.72);
  over(c, [62, 36, 23], 0.75 * smooth(1.0, 0.75, r)); // concha shadow
  over(c, [118, 74, 48], 0.35 * smooth(0.12, 0, Math.abs(Math.hypot(u, v) - 0.93))); // rim light
  return c;
}
