/* The presenter's recorded speech for each stop, shown in the top-right corner while the page rests
   on that stop (components/SpeechOverlay). Keys are stop ids: the opening story's beats are
   "story-<beat id>" (lib/story BEATS: hero, xray, micro-dense, micro-porous, redensify, return) and
   each slide's is its section id. A stop with no entry shows no video. When the next stop has the
   same file, the video carries on from where it paused during the move instead of starting again.

   The files in public/speeches are the presenter's recordings, made lighter for the web at their
   request: the picture is 720p H.264 (the box shows it about 550 px wide, so it looks the same as
   the 1080p originals at a quarter of the data), the sound is the original's, copied, except
   Speech 1, recorded about 15 dB quieter than the rest, whose sound is raised to match (+15.5 dB
   through a limiter). The untouched originals are in the repository's "speeches" release. */
const speech = (n: number) => `/speeches/Speech.${n}.mp4`;

/* slides 1 to 20 in order (the references, slide 21, have no speech) */
const SLIDES = ["glance", "energy", "skeleton", "hormones", "normal-vs-reds", "signs", "day-one", "injury-report", "start-now", "risk", "prevention", "needs", "monitoring", "decisions", "phases", "session", "aerobic", "return", "evidence", "closing"];

export const SPEECHES: Partial<Record<string, string>> = {
  // the opening: four speeches over the six stops before slide 1
  "story-hero": speech(1),
  "story-xray": speech(2),
  "story-micro-dense": speech(3),
  "story-micro-porous": speech(3),
  "story-redensify": speech(4),
  "story-return": speech(4),
  // then Speech 5 onwards on slides 1 to 20
  ...Object.fromEntries(SLIDES.map((id, i) => [id, speech(i + 5)])),
};

export const speechFor = (stop: string | null) => (stop ? SPEECHES[stop] ?? null : null);
export const speechFiles = () => [...new Set(Object.values(SPEECHES).filter((s): s is string => !!s))];
