/* The slides as a layer over the 3D scene. Each slide lives on its billboard: how much of it
   shows ("presence") is a pure function of the scroll state, and while it is coming or going it
   is drawn glued to the billboard's face, so arriving it grows out of the sign into the full
   1920x1080 stage and leaving it shrinks back onto the sign as the camera pulls away.
   The 3D scene calls apply() every frame with a projector (after the camera has moved, so the
   slide and the sign never drift apart); without WebGL a ticker applies plain fades instead. */
import gsap from "gsap";
import { FINISH_INDEX, scene, type SceneState } from "./scene";

/* scroll windows, in trip progress q (0 = leaving the previous slide's stop, 1 = at this slide) */
export const ARRIVE_Q: [number, number] = [0.86, 0.985]; // fades in while the camera zooms onto the sign
export const FINISH_ARRIVE_Q: [number, number] = [0.9, 0.985]; // the finish-line slide has no sign
export const LEAVE_Q = 0.06; // fades out while the camera backs off the sign

export type Quad = [number, number][]; // window px: top-left, top-right, bottom-right, bottom-left
type Entry = { index: number; wrap: HTMLElement; stage: HTMLElement; mode: "parked" | "glued" | "flat"; css: Map<string, string> };

const entries = new Map<number, Entry>();
const smooth = (t: number) => t * t * (3 - 2 * t);
const sstep = (a: number, b: number, x: number) => smooth(Math.min(1, Math.max(0, (x - a) / (b - a))));

/* how much of slide i shows for scroll state st (0..1) */
export function presence(i: number, st: SceneState) {
  if (st.mode !== "trip") return 0;
  if (st.trip === i) {
    const [a, b] = i === FINISH_INDEX ? FINISH_ARRIVE_Q : ARRIVE_Q;
    return sstep(a, b, st.q);
  }
  if (st.trip === i + 1) return 1 - sstep(0, LEAVE_Q, st.q);
  return 0;
}

/* CSS matrix3d taking stage px (0..1920, 0..1080) onto a quad in window px (Heckbert's square-to-quad) */
function homography(q: Quad) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = Math.abs(den) < 1e-9 ? 0 : (dx3 * dy2 - dx2 * dy3) / den;
  const h = Math.abs(den) < 1e-9 ? 0 : (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
  const sx = 1 / 1920, sy = 1 / 1080;
  // column-major 4x4; z passes through untouched
  return `matrix3d(${a * sx},${d * sx},0,${g * sx},${b * sy},${e * sy},0,${h * sy},0,0,1,0,${c},${f},0,1)`;
}

/* where the stage sits on screen when shown flat (the .stage rule: centred, scaled to fit the
   visible viewport); measured on resize only, so a frame never forces a layout */
let flatRect: Quad | null = null;
function stageRect(): Quad {
  if (!flatRect) {
    const w = document.documentElement.clientWidth, h = document.documentElement.clientHeight;
    const s = Math.min(w / 1920, h / 1080);
    const x0 = (w - 1920 * s) / 2, y0 = (h - 1080 * s) / 2, x1 = x0 + 1920 * s, y1 = y0 + 1080 * s;
    flatRect = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  }
  return flatRect;
}
if (typeof window !== "undefined") window.addEventListener("resize", () => (flatRect = null));

/* style writes only when a value changes (most frames change nothing) */
function css(e: Entry, el: HTMLElement, prop: string, value: string) {
  const key = (el === e.wrap ? "w:" : "s:") + prop;
  if (e.css.get(key) === value) return;
  e.css.set(key, value);
  (el.style as unknown as Record<string, string>)[prop] = value;
}

function park(e: Entry) {
  if (e.mode === "parked") return;
  e.mode = "parked";
  css(e, e.wrap, "visibility", "hidden");
  css(e, e.wrap, "opacity", "0");
  css(e, e.wrap, "transform", "translateY(150vh)"); // off screen, so in-view entrance animations replay next time
  css(e, e.wrap, "pointerEvents", "none");
  css(e, e.wrap, "willChange", "auto");
  flatten(e);
}
function flatten(e: Entry) {
  for (const p of ["left", "top", "transform", "transformOrigin"]) css(e, e.stage, p, "");
}

let lastGlue = -1e9;
/* per frame: projector(i) gives sign i's face on screen, or null when the slide has no sign
   (the finish line) or the sign is behind the camera */
export function apply(projector?: (i: number) => Quad | null) {
  if (projector) lastGlue = performance.now();
  const st = scene.get();
  const flat = stageRect();
  for (const e of entries.values()) {
    const p = presence(e.index, st);
    if (p <= 0.001) {
      park(e);
      continue;
    }
    css(e, e.wrap, "visibility", "visible");
    css(e, e.wrap, "opacity", p >= 1 ? "1" : p.toFixed(4));
    const quad = projector ? projector(e.index) : null;
    // glued while the sign's face and the flat stage differ by more than a fraction of a pixel
    const off = quad ? Math.max(...quad.map(([x, y], k) => Math.hypot(x - flat[k][0], y - flat[k][1]))) : 0;
    if (quad && off > 0.6) {
      e.mode = "glued";
      css(e, e.wrap, "pointerEvents", "none");
      css(e, e.wrap, "transform", "none");
      css(e, e.wrap, "willChange", "opacity");
      css(e, e.stage, "left", "0px");
      css(e, e.stage, "top", "0px");
      css(e, e.stage, "transformOrigin", "0 0");
      css(e, e.stage, "transform", homography(quad));
    } else {
      if (e.mode === "glued") flatten(e);
      e.mode = "flat";
      css(e, e.wrap, "pointerEvents", p > 0.6 ? "auto" : "none");
      // no sign to land on (or no WebGL): a short rise and fade
      css(e, e.wrap, "transform", quad || p >= 1 ? "none" : `translateY(${((1 - p) * 36).toFixed(2)}px) scale(${(0.97 + 0.03 * p).toFixed(4)})`);
      css(e, e.wrap, "willChange", p >= 1 ? "auto" : "opacity, transform");
    }
  }
}

let ticking = false;
export function register(index: number, wrap: HTMLElement, stage: HTMLElement) {
  const e: Entry = { index, wrap, stage, mode: "flat", css: new Map() };
  entries.set(index, e);
  park(e);
  // without a 3D scene driving apply() (no WebGL), keep the slides fading on their own
  if (!ticking) {
    ticking = true;
    gsap.ticker.add(() => {
      if (performance.now() - lastGlue > 250) apply();
    });
  }
  return () => {
    entries.delete(index);
  };
}
