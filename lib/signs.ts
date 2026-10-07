/* Billboard signs beside the track, one per slide, placed at that slide's marker. */
import { LANE1_R, OUTER_R, markerPoint } from "./trackPath";
import { SLIDE_COUNT, markerD } from "./scene";
import { aerobic, closing, dayOne, decisions, energy, evidence, glance, hormones, injuryReport, monitoring, needs, normalVsReds, phases, prevention, references, returnToSport, risk, session, signs, skeleton, startNow } from "./content";

export type SignInfo = { index: number; eyebrow: string; title: string };
export const SIGNS: SignInfo[] = [
  glance, energy, skeleton, hormones, normalVsReds, signs, dayOne, injuryReport, startNow, risk, prevention, needs, monitoring, decisions, phases, session, aerobic, returnToSport, evidence,
  ...references,
].map((s, i) => ({ index: i + 1, eyebrow: s.eyebrow, title: s.title }));
SIGNS.push({ index: SLIDE_COUNT, eyebrow: "Finish", title: closing.lines.join(" ") });

export type SignPose = { x: number; z: number; nx: number; nz: number; yaw: number };
/* world placement of sign i: 3.6 m outside the track on the runner's right, facing inward and back towards her */
export function signPose(i: number): SignPose {
  const p = markerPoint(markerD(i));
  const rx = -p.fz, rz = p.fx; // runner's right
  const off = OUTER_R - LANE1_R + 3.6;
  const x = p.x + rx * off, z = p.z + rz * off;
  let nx = -rx * 0.85 - p.fx * 0.53, nz = -rz * 0.85 - p.fz * 0.53;
  const l = Math.hypot(nx, nz);
  nx /= l;
  nz /= l;
  return { x, z, nx, nz, yaw: Math.atan2(nx, nz) };
}
