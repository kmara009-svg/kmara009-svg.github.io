/* Billboard signs beside the track, one per slide, placed at that slide's marker. */
import { LANE1_R, OUTER_R, markerPoint } from "./trackPath";
import { FINISH_INDEX, SLIDE_COUNT, markerD } from "./scene";
import { aerobic, closing, dayOne, decisions, energy, evidence, glance, hormones, injuryReport, monitoring, needs, normalVsReds, phases, prevention, returnToSport, risk, session, signs, skeleton, startNow } from "./content";

export type SignInfo = { index: number; eyebrow: string; title: string };
/* which side of the track sign i stands on: +1 her right (outside), -1 her left (infield) */
export const signSide = (i: number) => (i >= SLIDE_COUNT ? -1 : 1);
export const SIGNS: SignInfo[] = [glance, energy, skeleton, hormones, normalVsReds, signs, dayOne, injuryReport, startNow, risk, prevention, needs, monitoring, decisions, phases, session, aerobic, returnToSport, evidence].map((s, i) => ({
  index: i + 1,
  eyebrow: s.eyebrow,
  title: s.title,
}));
SIGNS.push({ index: FINISH_INDEX, eyebrow: "Finish", title: closing.lines.join(" ") });
SIGNS.push({ index: SLIDE_COUNT, eyebrow: "APA 7th", title: "REFERENCES" });

/* lateral offset of a sign from the lane-1 line: 3.6 m outside the track on the runner's right */
export const SIGN_LAT = OUTER_R - LANE1_R + 3.6;

export type SignPose = { x: number; z: number; nx: number; nz: number; yaw: number };
/* world placement of sign i, facing the track and back towards where she arrives from */
export function signPose(i: number): SignPose {
  const p = markerPoint(markerD(i));
  const side = signSide(i);
  const rx = -p.fz * side, rz = p.fx * side; // from the track towards the sign
  const x = p.x + rx * SIGN_LAT, z = p.z + rz * SIGN_LAT;
  let nx = -rx * 0.85 - p.fx * 0.53, nz = -rz * 0.85 - p.fz * 0.53;
  const l = Math.hypot(nx, nz);
  nx /= l;
  nz /= l;
  return { x, z, nx, nz, yaw: Math.atan2(nx, nz) };
}
