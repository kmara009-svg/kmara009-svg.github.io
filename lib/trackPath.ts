/* A standard 400 m athletics oval, in metres, centred on the origin.
   Two 84.39 m straights along X and two semicircular bends. The runner's line is the
   centre of lane 1 (radius 37.1 m on the bends). d = 0 is the start/finish line at the
   start of the home straight (x = -42.2, z = +37.1). The lap runs anticlockwise seen
   from above with north at -Z: east along the home straight, round the east bend,
   west along the back straight, round the west bend, back to the line. */
export const HALF_STRAIGHT = 42.195;
export const LANE1_R = 37.1;
export const STRAIGHT = HALF_STRAIGHT * 2;
export const LANE_W = 1.22;
export const LANES = 8;
export const INNER_R = LANE1_R - LANE_W / 2; // kerb radius
export const OUTER_R = INNER_R + LANES * LANE_W;
export const TRACK_LENGTH = 2 * STRAIGHT + 2 * Math.PI * LANE1_R; // ≈ 401.9 m

export type TrackPoint = { x: number; z: number; fx: number; fz: number };

/* position and unit forward (tangent) vector at distance d along a line of the given bend radius */
export function pointAt(d: number, radius = LANE1_R): TrackPoint {
  const L = 2 * STRAIGHT + 2 * Math.PI * radius;
  let s = ((d % L) + L) % L;
  if (s < STRAIGHT) return { x: -HALF_STRAIGHT + s, z: radius, fx: 1, fz: 0 };
  s -= STRAIGHT;
  const bend = Math.PI * radius;
  if (s < bend) {
    const a = s / radius;
    return { x: HALF_STRAIGHT + radius * Math.sin(a), z: radius * Math.cos(a), fx: Math.cos(a), fz: -Math.sin(a) };
  }
  s -= bend;
  if (s < STRAIGHT) return { x: HALF_STRAIGHT - s, z: -radius, fx: -1, fz: 0 };
  s -= STRAIGHT;
  const a = s / radius;
  return { x: -HALF_STRAIGHT - radius * Math.sin(a), z: -radius * Math.cos(a), fx: -Math.cos(a), fz: Math.sin(a) };
}

/* length of a lap on a line of the given radius */
export const lapLength = (radius: number) => 2 * STRAIGHT + 2 * Math.PI * radius;

/* rotation.y so that a model's local +Z faces forward */
export const headingOf = (p: TrackPoint) => Math.atan2(p.fx, p.fz);

/* world point from runner-relative coordinates: x to her right, y up, z ahead */
export function relative(p: TrackPoint, x: number, y: number, z: number): [number, number, number] {
  // right = forward × up = (-fz, 0, fx)
  return [p.x + p.fx * z - p.fz * x, y, p.z + p.fz * z + p.fx * x];
}

/* point on lane 1 at a marker distance (alias kept for readability in callers) */
export const markerPoint = (d: number) => pointAt(d);
