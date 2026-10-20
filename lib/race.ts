/* The race: four rivals in lanes 2 to 5 run the lap with her. Where each one is, is a pure function
   of the scroll state, as hers is: a gap (metres along lane 1, + ahead of her) per slide stop,
   eased across each run in step with her, so they stand when she stands and step back with the
   deck. Early on the field is ahead of her; through the recovery slides she reels them in, and on
   the finish-line slide she crosses first. After she has crossed, the rivals finish in real time
   (see finishRun), so they come in behind her while the closing slide is up.

   The camera rides behind her right shoulder, between lanes 2 and 3, so the gaps keep lanes 2 and
   3 either level with her or ahead (from 2 m behind) or well behind the camera (more than 11 m);
   a rival moves from one to the other only while the camera is on a sign. Lanes 4 and 5 are
   clear of the chase camera but under its swing back from a sign, so their gaps at the stops
   keep out of that path. */
import { INNER_R, LANE1_R, LANE_W, STRAIGHT, TRACK_LENGTH, headingOf, lapLength, pointAt } from "./trackPath";
import { FINISH_INDEX, type SceneState } from "./scene";
import { storyD, stopFor, tripU } from "./runnerPath";
import { range } from "./story";

export type RivalPlan = {
  lane: number;
  story: number; // gap in the opening aerial (all ahead of her: she starts at the back)
  gaps: number[]; // gap at each stop 0..FINISH_INDEX-1 (0 = the end of the story)
  jumps?: Record<number, number>; // a different gap leaving that stop (moved while the camera is on the sign)
  finish: { gap: number; rest: number; speed: number }; // behind her as she crosses; where she pulls up past the line; her run-in speed (m/s)
};

export const RIVALS: RivalPlan[] = [
  {
    lane: 2, // leads for most of the race; she draws level at slide 17 and passes her
    story: 5,
    gaps: [3, 4, 5, 6.5, 7.5, 8, 9.5, 11, 12, 12, 11, 9.5, 8, 6.5, 5, 3.5, 2, 0.5, -1, -1],
    jumps: { 19: -12.5 },
    finish: { gap: -12.5, rest: 16, speed: 6.9 },
  },
  {
    lane: 3, // the early leader, passed at slide 16, then fading
    story: 10,
    gaps: [7, 8.5, 10, 11.5, 12.5, 13.5, 14.5, 15, 15, 14, 12.5, 10.5, 8.5, 6, 3.5, 1.5, -0.5, -2, -13, -13.5],
    jumps: { 17: -12.5, 19: -14.5 },
    finish: { gap: -14.5, rest: 11, speed: 7.2 },
  },
  {
    lane: 4, // her closest rival: ahead until slide 14, then at her shoulder to the final straight
    story: 2.5,
    gaps: [1.5, 2.5, 3.5, 4.5, 5.5, 6, 7, 8, 8.5, 8, 7, 5.5, 4, 2, 0.5, -0.5, -1, 0.3, -0.8, -1],
    finish: { gap: -3, rest: 8, speed: 6.8 },
  },
  {
    lane: 5, // level at the start, pulls away while she is injured, dropped at slide 16
    story: 7,
    gaps: [0.3, 0, 0.5, 1, 1.5, 2.5, 4, 5.5, 6.5, 7, 6.5, 5.5, 4, 2.5, 1, 0, -4.5, -6, -7, -6],
    finish: { gap: -6.5, rest: 13, speed: 7.0 },
  },
];

const LINE = TRACK_LENGTH; // the finish line, one lap on from the start of the story
const HIDE_Q = 0.92; // in a trip past this the camera is on the sign: a rival may move unseen
const FINISH_RUN: [number, number] = [0.05, 0.7]; // the finish trip's run window (her TRIP_RUN)
export const FINISH_CROSS_Q = FINISH_RUN[1]; // she is on the line from here
/* the scroll state from which she has crossed the line: from here the rivals finish in real time */
export const hasFinished = (st: SceneState) => st.mode === "trip" && (st.trip > FINISH_INDEX || (st.trip === FINISH_INDEX && st.q >= FINISH_CROSS_Q));
export const FINISH_SETTLE = 5.5; // seconds by which every rival has pulled up (the longest run-in, lane 2's, takes 5.4)

export type RivalTarget = { d: number; finished: boolean; treadmill: boolean };
/* rival r's distance along lane 1 for scroll state st (before any run-in after the finish) */
export function rivalTarget(r: number, st: SceneState): RivalTarget {
  const plan = RIVALS[r];
  if (st.mode === "story") {
    const sp = st.storyP;
    // ahead of her in the aerial and pulling away; while she holds still for the X-ray they run on
    // out of shot; under the bone section (no track in view) they take their places for slide 1
    if (sp >= 0.865) return { d: storyD(sp) + plan.gaps[0], finished: false, treadmill: false };
    const g = plan.story + 2.5 * Math.min(1, sp / 0.23) + 30 * range(sp, 0.23, 0.43);
    return { d: storyD(sp) + g, finished: false, treadmill: true };
  }
  const i = st.trip;
  const out = (k: number) => plan.jumps?.[k] ?? plan.gaps[k];
  if (i < FINISH_INDEX) {
    const a = stopFor(i - 1), b = stopFor(i);
    const u = tripU(i, st.q);
    const g = st.q >= HIDE_Q ? out(i) : out(i - 1) + (plan.gaps[i] - out(i - 1)) * u;
    return { d: a.d + (b.d - a.d) * u + g, finished: false, treadmill: false };
  }
  // the finish: from the last stop each rival runs at an even pace (in scroll) to her place behind
  // the line as she crosses it, so they don't ease off into the line as she does; then real time
  const start = stopFor(FINISH_INDEX - 1).d + out(FINISH_INDEX - 1);
  const end = LINE + plan.finish.gap;
  if (i === FINISH_INDEX && st.q < FINISH_RUN[1]) return { d: start + (end - start) * range(st.q, FINISH_RUN[0], FINISH_RUN[1]), finished: false, treadmill: false };
  return { d: end, finished: true, treadmill: false };
}

/* metres run since she crossed the line, t seconds after: on at speed through the line, then
   pulling up to a stop at rest metres past it */
export function finishRun(r: number, t: number) {
  const { gap, rest, speed: v } = RIVALS[r].finish;
  const total = rest - gap;
  const brake = Math.min(total, 9);
  const a = (v * v) / (2 * brake);
  const t1 = (total - brake) / v;
  if (t <= t1) return v * t;
  const tb = Math.min(t - t1, v / a);
  return total - brake + v * tb - 0.5 * a * tb * tb;
}

/* the centre of lane `lane` level with lane-1 distance d: the same point on the straights, the
   same angle round the bends (so a gap means the same thing in every lane) */
export function laneSpot(d: number, lane: number) {
  const r = INNER_R + (lane - 0.5) * LANE_W;
  const L1 = lapLength(LANE1_R);
  let s = ((d % L1) + L1) % L1;
  const b1 = Math.PI * LANE1_R, br = Math.PI * r;
  let dd: number;
  if (s < STRAIGHT) dd = s;
  else if ((s -= STRAIGHT) < b1) dd = STRAIGHT + (s / LANE1_R) * r;
  else if ((s -= b1) < STRAIGHT) dd = STRAIGHT + br + s;
  else dd = 2 * STRAIGHT + br + ((s - STRAIGHT) / LANE1_R) * r;
  const p = pointAt(dd, r);
  return { x: p.x, z: p.z, heading: headingOf(p) };
}

