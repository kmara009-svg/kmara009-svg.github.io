/* Shared scroll-progress store for the signature scroll story (0..1).
   Read from refs each frame; no React re-renders. */

type Listener = (p: number) => void;
const listeners = new Set<Listener>();
let progress = 0;

export const story = {
  get: () => progress,
  set(p: number) {
    progress = p;
    listeners.forEach((l) => l(p));
  },
  subscribe(l: Listener) {
    listeners.add(l);
    l(progress);
    return () => {
      listeners.delete(l);
    };
  },
};

/* Beats inside the story. Keyboard navigation stops at each of these. */
export const BEATS = [
  { id: "hero", p: 0 },
  { id: "xray", p: 0.3 },
  { id: "micro-dense", p: 0.47 },
  { id: "micro-porous", p: 0.6 },
  { id: "redensify", p: 0.82 },
  { id: "finish", p: 1 },
] as const;

export const STORY_VH = 8; // story section height in viewport heights

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const range = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const srange = (p: number, a: number, b: number) => smooth(range(p, a, b));
/* a soft bump centred at c with half-width w */
export const bump = (p: number, c: number, w: number) => {
  const d = Math.abs(p - c) / w;
  return d >= 1 ? 0 : smooth(1 - d);
};

/* Derived values the 3D scene and overlays both use */
export function storyState(p: number) {
  const xray = srange(p, 0.13, 0.27);
  const labels = srange(p, 0.24, 0.3) * (1 - srange(p, 0.32, 0.37));
  const dive = srange(p, 0.31, 0.43);
  const flash = bump(p, 0.43, 0.04) + bump(p, 0.865, 0.04);
  const micro = p >= 0.43 && p < 0.865;
  const porosity = srange(p, 0.47, 0.6) * (1 - srange(p, 0.63, 0.82));
  const finish = p >= 0.865;
  const sprint = srange(p, 0.865, 0.95);
  const finishLine = srange(p, 0.9, 0.985);
  return { xray, labels, dive, flash, micro, porosity, finish, sprint, finishLine };
}
