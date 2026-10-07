/* Shared scene state written by the scroll triggers and read by the 3D scene each frame. */
import { TRACK_LENGTH } from "./trackPath";

export const FINISH_INDEX = 20; // the finish-line slide: she crosses the line one lap after the story
export const SLIDE_COUNT = 21; // slides after the story; the last one (references) sits just past the finish line
export const STORY_END_D = 56; // metres covered during the pinned story
export const REFERENCES_D = TRACK_LENGTH + 22; // the references sign, a short jog on from the finish line (on the infield side, clear of the story views)
export const markerD = (i: number) =>
  i >= SLIDE_COUNT ? REFERENCES_D : i >= FINISH_INDEX ? TRACK_LENGTH : STORY_END_D + (i * (TRACK_LENGTH - STORY_END_D)) / FINISH_INDEX;
/* slide i (1-based) has its sign at markerD(i); the story runs from 0 to markerD(0) */

export type SceneState = {
  mode: "story" | "trip";
  storyP: number; // 0..1 within the pinned story
  trip: number; // 1-based slide index while in a trip section
  q: number; // 0..1 within that trip section
};

const state: SceneState = { mode: "story", storyP: 0, trip: 1, q: 0 };
export const scene = {
  get: () => state,
  setStory(p: number) {
    state.mode = "story";
    state.storyP = p;
  },
  setTrip(i: number, q: number) {
    state.mode = "trip";
    state.trip = i;
    state.q = q;
  },
};

/* live runner transform, written by the Runner every frame for effects that follow her */
export const runnerPose = { x: 0, z: 0, heading: 0, d: 0, speed: 0 };
