/* The presentation as a list of stops, and the single store that moves between them.
   Every key press, wheel notch or swipe moves exactly one stop. Moving forward plays the
   destination's arrival clip (real footage) from its first frame, and the destination's
   slide or story overlay is revealed as the clip ends. Moving back, or jumping, cuts
   straight to the destination's resting frame. Layers subscribe to the events below and
   run their own short, timed animations, so nothing is tied to scroll position. */
import { CLIPS } from "./media";

export const FINISH_INDEX = 20; // the finish-line slide
export const SLIDE_COUNT = 21; // slides after the story; the last one is the references

export type Beat = "hero" | "xray-hip" | "xray-limb" | "bone-normal" | "bone-loss" | "rebuild";
export type Stop = {
  id: string;
  label: string;
  beat?: Beat;
  slide?: number; // 1-based slide index
  clip?: string; // arrival clip id (lib/media.ts), played when this stop is reached going forward
};

const STORY: Stop[] = [
  { id: "hero", label: "Refuel. Rebuild. Return.", beat: "hero" },
  { id: "xray-hip", label: "Where the skeleton pays", beat: "xray-hip", clip: "run-hero" },
  { id: "xray-limb", label: "Where the skeleton pays", beat: "xray-limb" },
  { id: "bone-normal", label: "Inside the femur", beat: "bone-normal" },
  { id: "bone-loss", label: "Inside the femur", beat: "bone-loss" },
  { id: "rebuild", label: "Refuel. Rebuild. Return.", beat: "rebuild" },
];

/* arrival clip for each slide (1-based); consecutive slides use different footage */
const SLIDE_CLIPS: Record<number, string> = {
  1: "back-to-colour",
  2: "t-a", 3: "t-b", 4: "t-c", 5: "t-d", 6: "t-e",
  7: "t-f", 8: "t-a", 9: "t-b", 10: "t-c", 11: "t-d",
  12: "t-e", 13: "t-f", 14: "t-a", 15: "t-b", 16: "t-c", 17: "t-d", 18: "t-e", 19: "t-f",
  20: "finish",
  21: "cooldown",
};

/* slide labels are registered by the slides themselves (components/sections) */
const slideLabels: Record<number, string> = {};
export const registerSlideLabel = (index: number, label: string) => {
  slideLabels[index] = label;
};

export const STOPS: Stop[] = [
  ...STORY,
  ...Array.from({ length: SLIDE_COUNT }, (_, i) => ({ id: `slide-${i + 1}`, label: "", slide: i + 1, clip: SLIDE_CLIPS[i + 1] })),
];
export const stopLabel = (i: number) => {
  const s = STOPS[i];
  return s ? (s.slide ? slideLabels[s.slide] ?? "" : s.label) : "";
};
export const stopOfSlide = (slide: number) => STORY.length + slide - 1;
export const stopOfBeat = (beat: Beat) => STORY.findIndex((s) => s.beat === beat);

/* ---------- timing (seconds) ---------- */
export const LEAVE_S = 0.28; // outgoing slide / overlay fades out
export const REVEAL_S = 0.45; // incoming slide / overlay fades in
const STEP_S = 0.9; // a forward move with no footage (story beat to story beat)
const CUT_S = 0.4; // a backward move or jump

export type Move = {
  from: number;
  to: number;
  instant: boolean; // backward / jump: no footage, quick cross-fade
  clip?: string; // footage played for this move
  revealAt: number; // when the destination starts to appear
  total: number; // when the move is complete
  startedAt: number; // performance.now() at start
};

type Listener = (m: Move) => void;
type RevealListener = (index: number, instant: boolean) => void;

const state = { index: 0, move: null as Move | null };
const onMove = new Set<Listener>();
const onReveal = new Set<RevealListener>();
const onSettle = new Set<(index: number) => void>();
let revealTimer: number | undefined;
let settleTimer: number | undefined;
let pendingReveal: number | null = null; // stop index whose reveal has not fired yet

/* end the current move now; `skipped` = the presenter cut it short, so reveal quickly */
function settle(skipped = false) {
  window.clearTimeout(revealTimer);
  window.clearTimeout(settleTimer);
  if (pendingReveal !== null) {
    const to = pendingReveal;
    pendingReveal = null;
    onReveal.forEach((f) => f(to, skipped || !!state.move?.instant));
  }
  state.move = null;
  onSettle.forEach((f) => f(state.index));
}

export const deck = {
  get index() {
    return state.index;
  },
  get move() {
    return state.move;
  },
  count: STOPS.length,
  /* subscribe: called at the start of every move (layers start their leave / footage) */
  subscribe(f: Listener) {
    onMove.add(f);
    return () => onMove.delete(f);
  },
  /* called when a stop's content should appear (slides, story overlays) */
  onReveal(f: RevealListener) {
    onReveal.add(f);
    return () => onReveal.delete(f);
  },
  onSettle(f: (index: number) => void) {
    onSettle.add(f);
    return () => onSettle.delete(f);
  },
  go(target: number, opts: { instant?: boolean } = {}) {
    const to = Math.max(0, Math.min(STOPS.length - 1, target));
    if (state.move) settle(true);
    const from = state.index;
    if (to === from) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const forwardOne = to === from + 1;
    const instant = !!opts.instant || !forwardOne || !!reduce;
    const clipId = !instant ? STOPS[to].clip : undefined;
    const clip = clipId ? CLIPS[clipId] : undefined;
    let revealAt: number, total: number;
    if (instant) {
      revealAt = 0.12;
      total = CUT_S;
    } else if (clip) {
      total = clip.duration;
      revealAt = Math.max(LEAVE_S, clip.duration - REVEAL_S);
    } else {
      revealAt = 0.25;
      total = STEP_S;
    }
    const move: Move = { from, to, instant, clip: clip ? clipId : undefined, revealAt, total, startedAt: performance.now() };
    state.index = to;
    state.move = move;
    onMove.forEach((f) => f(move));
    pendingReveal = to;
    revealTimer = window.setTimeout(() => {
      if (pendingReveal === null) return;
      pendingReveal = null;
      onReveal.forEach((f) => f(to, instant));
    }, revealAt * 1000);
    settleTimer = window.setTimeout(() => settle(false), total * 1000);
  },
  /* a press while footage is playing skips to the end of it (the slide appears now);
     it never skips a slide */
  next() {
    if (state.move && !state.move.instant) return settle(true);
    deck.go(state.index + 1);
  },
  prev() {
    deck.go(state.index - 1);
  },
};
