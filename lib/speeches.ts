/* The presenter's recorded speech for each stop, shown in the top-right corner while the page rests
   on that stop (components/SpeechOverlay). Keys are stop ids: the opening story's beats are
   "story-<beat id>" (lib/story BEATS: hero, xray, micro-dense, micro-porous, redensify, return) and
   each slide's is its section id. A stop with no entry shows no video. When the next stop has the
   same file, the video carries on from where it paused during the move instead of starting again.

   The files are the presenter's own recordings, played straight from the repository's "speeches"
   release (together they are over GitHub Pages' 1 GB site limit), unedited except Speech 1: it was
   recorded about 15 dB quieter than the rest, so the site serves its own copy from
   public/speeches with only the sound raised to match (+15.5 dB through a limiter, -13.4 LUFS; the
   video stream is the original's, copied). */
const RELEASE = "https://github.com/kmara009-svg/kmara009-svg.github.io/releases/download/speeches/";
const speech = (n: number) => (n === 1 ? "/speeches/Speech.1.mp4" : `${RELEASE}Speech.${n}.mp4`);

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
