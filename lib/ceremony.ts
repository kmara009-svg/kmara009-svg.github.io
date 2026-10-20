/* The medal ceremony at the references sign, as a pure function of the scroll state like everything
   else (so stepping back takes the medal off her again). The coach waits beside the sign holding
   her medal; once she has halted in front of him he lifts it over her head and lowers it onto her
   shoulders, lets go, and the two of them turn to the camera before it closes in on the sign. */
import { CEREMONY, SLIDE_COUNT, type SceneState } from "./scene";
import { COACH_SPOT } from "./runnerPath";
import { signPose } from "./signs";
import { range } from "./story";

/* how far through the ceremony the scroll is: 0 before it (and on every other slide), 1 after */
export const ceremonyK = (st: SceneState) => (st.mode === "trip" && st.trip >= SLIDE_COUNT ? range(st.q, CEREMONY[0], CEREMONY[1]) : 0);

/* its beats, in ceremony progress */
export const MEDAL = {
  raise: [0.08, 0.3] as [number, number], // from his hands at his waist up over her head
  lower: [0.3, 0.52] as [number, number], // down over her head onto her shoulders
  settle: [0.5, 0.6] as [number, number], // he lets go; it hangs on her
  drop: [0.56, 0.76] as [number, number], // his arms back to his sides
  turn: [0.58, 0.78] as [number, number], // both turn to the camera
};
/* then the camera leaves them for the sign (in the references trip's q: over the end of the hold
   and into the zoom), so they are out of shot before the slide comes up over the sign */
export const LEAVE: [number, number] = [0.79, 0.87];

/* the camera on the two of them, head to toe: from in front of the sign, a little round towards
   her side so his face is in view */
const sp = signPose(SLIDE_COUNT);
const her = COACH_SPOT.her;
const mx = (COACH_SPOT.x + her.x) / 2, mz = (COACH_SPOT.z + her.z) / 2;
const ux = her.x - COACH_SPOT.x, uz = her.z - COACH_SPOT.z, ul = Math.hypot(ux, uz);
export const CEREMONY_VIEW = {
  pos: { x: mx + sp.nx * 4.2 + (ux / ul) * 1.3, y: 1.45, z: mz + sp.nz * 4.2 + (uz / ul) * 1.3 },
  tgt: { x: mx, y: 1.02, z: mz },
};
/* a floodlight on them from the camera's side (the evening light comes from behind the sign) */
export const CEREMONY_LIGHT = {
  pos: { x: mx + sp.nx * 6 + (ux / ul) * 2.5, y: 6, z: mz + sp.nz * 6 + (uz / ul) * 2.5 },
  tgt: { x: mx, y: 1.1, z: mz },
};
/* the headings the two of them turn to: she faces the camera, he half turns to it */
export const HER_TURN = Math.atan2(CEREMONY_VIEW.pos.x - her.x, CEREMONY_VIEW.pos.z - her.z);
export const COACH_TURN = Math.atan2(CEREMONY_VIEW.pos.x - COACH_SPOT.x, CEREMONY_VIEW.pos.z - COACH_SPOT.z);
