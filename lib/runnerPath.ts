/* Where she runs between slides: she stays in lane 1 and halts just before each sign's marker
   while the camera zooms into the sign. The finish-line slide stops her on the line, and for
   the last (references) sign she veers off the track to stand in front of it, turning to face
   it as she comes to a halt. */
import { TRACK_LENGTH, pointAt } from "./trackPath";
import { FINISH_INDEX, SLIDE_COUNT, STORY_END_D, markerD } from "./scene";
import { SIGN_LAT, signPose, signSide } from "./signs";
import { clamp01, smooth, srange } from "./story";

export const STOP_BACK = 3.0; // she halts this far before the sign's marker, along the track
export const STOP_LAT = SIGN_LAT - 1.7; // and 1.7 m in front of the sign face
const LEAVE_M = 10; // metres over which she merges back onto lane 1
const ARRIVE_M = 16; // metres over which she veers out to the sign

export type Stop = { d: number; lat: number };
/* where she stands for slide i (0 = the end of the story) */
export function stopFor(i: number): Stop {
  if (i <= 0) return { d: STORY_END_D, lat: 0 };
  if (i === FINISH_INDEX) return { d: TRACK_LENGTH, lat: 0 };
  return { d: markerD(i) - STOP_BACK, lat: i >= SLIDE_COUNT ? STOP_LAT * signSide(i) : 0 };
}

/* world position at distance d along lane 1, offset lat metres to her right */
export function trackPos(d: number, lat: number) {
  const p = pointAt(d);
  return { x: p.x - p.fz * lat, z: p.z + p.fx * lat };
}

const lerpAngle = (a: number, b: number, t: number) => {
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
    // turn to face the sign as she halts
    const sp = signPose(i);
    heading = lerpAngle(heading, Math.atan2(sp.x - p.x, sp.z - p.z), srange(u, 0.88, 1));
  }
  return { d: a.d + L * u, x: p.x, z: p.z, heading };
}
