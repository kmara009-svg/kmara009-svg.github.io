/* The presenter's recorded speech for each stop, shown in the top-right corner while the page rests
   on that stop (components/SpeechOverlay). Keys are stop ids: the opening story's beats are
   "story-<beat id>" (lib/story BEATS: hero, xray, micro-dense, micro-porous, redensify, return) and
   each slide's is its section id (glance, energy, ... closing, references). Files live in
   public/speeches. A stop with no entry shows no video. When the next stop has the same file, the
   video carries on from where it paused during the move instead of starting again. */
export const SPEECHES: Partial<Record<string, string>> = {};

export const speechFor = (stop: string | null) => (stop ? SPEECHES[stop] ?? null : null);
export const speechFiles = () => [...new Set(Object.values(SPEECHES).filter((s): s is string => !!s))];
