/* Where she runs between slides: she stays in lane 1 and halts just before each sign's marker
   while the camera zooms into the sign. The finish-line slide stops her on the line, and for
   the last (references) sign she veers off the track to stand beside it, where the coach waits
   with her medal, turning to face him as she comes to a halt. */
import { TRACK_LENGTH, pointAt } from "./trackPath";
import { FINISH_INDEX, SLIDE_COUNT, STORY_END_D, TRIP_RUN, markerD, tripQ } from "./scene";
import { SIGN_LAT, signPose, signSide } from "./signs";
import { clamp01, range, smooth, srange } from "./story";

export const STOP_BACK = 3.0; // she halts this far before the sign's marker, along the track
// at the references sign she halts beside it instead, a little past its left-hand post and 2.7 m
// out from its face, so the camera can close in on the sign without her (or the coach) in front of it
const REFS_BACK = 3.9;
const REFS_LAT = SIGN_LAT - 0.75;
const LEAVE_M = 10; // metres over which she merges back onto lane 1
const ARRIVE_M = 16; // metres over which she veers out to the sign

/* her distance along lane 1 at story progress sp: she runs, holds still while the X-ray is on, runs on */
export function storyD(sp: number) {
  const f = sp < 0.23 ? (sp / 0.23) * 0.38 : sp < 0.42 ? 0.38 : 0.38 + ((sp - 0.42) / 0.58) * 0.62;
  return 34 + (STORY_END_D - 34) * f;
}

/* how far through trip i's run she is at trip progress q (0..1, eased); the last trip veers off
   the track to the references sign, a longer path, so it gets more of the scroll */
export function tripU(i: number, q: number) {
  const [r0, r1] = i >= SLIDE_COUNT ? [0.03, 0.78] : TRIP_RUN;
  return smooth(range(tripQ(i, q), r0, r1));
}

export type Stop = { d: number; lat: number };
/* where she stands for slide i (0 = the end of the story) */
export function stopFor(i: number): Stop {
  if (i <= 0) return { d: STORY_END_D, lat: 0 };
  if (i === FINISH_INDEX) return { d: TRACK_LENGTH, lat: 0 };
  if (i >= SLIDE_COUNT) return { d: markerD(i) - REFS_BACK, lat: REFS_LAT * signSide(i) };
  return { d: markerD(i) - STOP_BACK, lat: 0 };
}

/* world position at distance d along lane 1, offset lat metres to her right */
export function trackPos(d: number, lat: number) {
  const p = pointAt(d);
  return { x: p.x - p.fz * lat, z: p.z + p.fx * lat };
}

/* the coach waits for her a short step from where she halts at the references sign, towards the
   sign, facing her (the two of them level with each other, side by side to a camera in front) */
export const COACH_GAP = 0.5;
export const COACH_SPOT = (() => {
  const s = stopFor(SLIDE_COUNT);
  const her = trackPos(s.d, s.lat);
  const sp = signPose(SLIDE_COUNT);
  let ax = sp.nz, az = -sp.nx; // along the sign's face
  if ((sp.x - her.x) * ax + (sp.z - her.z) * az < 0) {
    ax = -ax;
    az = -az;
  }
  const x = her.x + ax * COACH_GAP, z = her.z + az * COACH_GAP;
  return { x, z, heading: Math.atan2(her.x - x, her.z - z), her };
})();

export const lerpAngle = (a: number, b: number, t: number) => {
  let dh = b - a;
  dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  return a + dh * t;
};

export type TripPose = { d: number; x: number; z: number; heading: number };
/* her pose u (0..1) of the way through trip i */
export function tripPose(i: number, u: number): TripPose {
  const a = stopFor(i - 1);
  const b = stopFor(i);
  const L = b.d - a.d;
  const at = (uu: number) => {
    const d = a.d + L * uu;
    const leave = 1 - smooth(clamp01((d - a.d) / LEAVE_M));
    const arrive = smooth(clamp01((d - (b.d - ARRIVE_M)) / ARRIVE_M));
    return trackPos(d, a.lat * leave + b.lat * arrive);
  };
  const p = at(u);
  const e = 0.25 / L;
  const p1 = at(Math.max(0, u - e));
  const p2 = at(Math.min(1, u + e));
  let heading = Math.atan2(p2.x - p1.x, p2.z - p1.z);
  if (b.lat !== 0) {
    // turn to face the coach as she halts
    heading = lerpAngle(heading, Math.atan2(COACH_SPOT.x - p.x, COACH_SPOT.z - p.z), srange(u, 0.88, 1));
  }
  return { d: a.d + L * u, x: p.x, z: p.z, heading };
}
