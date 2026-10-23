"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { speechFiles, speechFor } from "@/lib/speeches";

/* The presenter's recorded speech for the stop the page is resting on, in the top-right corner. It
   comes up and plays once a move has come to rest on a stop that has one, and stops and fades the
   moment the page moves on. Each file has its own element: a speech that runs on into the next stop
   resumes where it paused (or stays down if it has already finished), and the files either side of
   the current stop are already loading, so a speech shows from its first frame rather than as an
   empty box. Browsers hold back sound until the viewer has clicked or pressed a key, so the first
   one may wait for that. */
const FILES = speechFiles();
const RETRY_MS = [1000, 3000, 9000];

export default function SpeechOverlay({ stop, near }: { stop: string | null; near: (string | null)[] }) {
  const els = useRef<Record<string, HTMLVideoElement | null>>({});
  const last = useRef<string | null>(null); // the file last brought up: coming back to it resumes rather than restarts
  const [shown, setShown] = useState<string | null>(null);
  const shownRef = useRef<string | null>(null);
  const [live, setLive] = useState<string | null>(null); // the file that has started playing, so has a frame to show
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState<Record<string, boolean>>({}); // could not be loaded: never shown as an empty box
  const failedRef = useRef<Record<string, boolean>>({});
  const tries = useRef<Record<string, number>>({});
  const resumeAt = useRef<Record<string, number>>({});
  const retryTimer = useRef<Record<string, number>>({});
  const onMeta = useRef<Record<string, () => void>>({});

  const show = useCallback((src: string | null) => {
    shownRef.current = src;
    setShown(src);
  }, []);
  const setFail = useCallback((src: string, on: boolean) => {
    failedRef.current = { ...failedRef.current, [src]: on };
    setFailed(failedRef.current);
  }, []);

  // only ever the speech that is on screen, so a late click or key press can't start one hidden
  const play = useCallback((src: string | null) => {
    if (!src || shownRef.current !== src) return;
    els.current[src]
      ?.play()
      .then(() => setBlocked(false))
      .catch((e: DOMException) => setBlocked(e.name === "NotAllowedError"));
  }, []);

  /* the release serves each file from a link that expires after a while, and a network drop can cut a
     load short: fetch it afresh after a pause and pick up where it was, a few times at most */
  const recover = useCallback(
    (src: string, now = false) => {
      const v = els.current[src];
      if (!v) return;
      const n = tries.current[src] ?? 0;
      if (n >= RETRY_MS.length) {
        setFail(src, true);
        return;
      }
      tries.current[src] = n + 1;
      if (resumeAt.current[src] === undefined) resumeAt.current[src] = v.currentTime;
      window.clearTimeout(retryTimer.current[src]);
      retryTimer.current[src] = window.setTimeout(() => {
        if (onMeta.current[src]) v.removeEventListener("loadedmetadata", onMeta.current[src]);
        onMeta.current[src] = () => {
          v.currentTime = resumeAt.current[src] ?? 0;
          play(src);
        };
        v.addEventListener("loadedmetadata", onMeta.current[src], { once: true });
        v.load();
      }, now ? 0 : RETRY_MS[n]);
    },
    [play, setFail]
  );
  const loaded = useCallback((src: string) => {
    tries.current[src] = 0;
    delete resumeAt.current[src];
    setLive(src);
  }, []);

  useEffect(() => {
    const src = speechFor(stop);
    for (const [f, v] of Object.entries(els.current)) if (f !== src) v?.pause();
    if (shownRef.current !== src) show(null);
    if (!src) return;
    // wait a beat, so scrolling by hand past a stop doesn't flash its video up
    const t = window.setTimeout(() => {
      const v = els.current[src];
      if (!v) return;
      if (last.current === src && v.ended) {
        show(null); // a speech that already finished on the stop before stays down
        return;
      }
      if (last.current !== src) v.currentTime = 0;
      last.current = src;
      show(src);
      if (failedRef.current[src] || v.error) {
        // it could not be loaded before: try once more now that its stop has come up
        setFail(src, false);
        tries.current[src] = RETRY_MS.length - 1;
        recover(src, true);
        return;
      }
      play(src);
    }, 150);
    return () => window.clearTimeout(t);
  }, [stop, play, show, recover, setFail]);

  // sound held back: start on the first click or key press
  useEffect(() => {
    if (!blocked || !shown) return;
    const retry = () => play(shownRef.current);
    window.addEventListener("pointerdown", retry, true);
    window.addEventListener("keydown", retry, true);
    return () => {
      window.removeEventListener("pointerdown", retry, true);
      window.removeEventListener("keydown", retry, true);
    };
  }, [blocked, shown, play]);

  if (!FILES.length) return null;
  const warm = new Set([shown, ...near.map(speechFor)]);
  // inside the slides' 600 x 400 webcam zone (top right of the 1920 x 1080 stage), scaled with the stage
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div className="absolute" style={{ left: "50%", top: "50%", width: 1920, height: 1080, transform: "translate(-50%, -50%) scale(var(--stage-scale))" }}>
        <div className="absolute" style={{ right: 24, top: 24, width: 552, height: 311 }}>
          {FILES.map((f) => (
            <video
              key={f}
              ref={(el) => {
                els.current[f] = el;
              }}
              src={f}
              playsInline
              preload={warm.has(f) ? "auto" : "none"}
              onPlaying={() => loaded(f)}
              onError={() => recover(f)}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ opacity: shown === f && !failed[f] && (live === f || blocked) ? 1 : 0, transition: "opacity 0.25s ease", borderRadius: 18, border: "3px solid rgba(255,255,255,0.9)", boxShadow: "0 16px 48px rgba(0,0,0,0.45)", background: "#111" }}
            />
          ))}
          {blocked && shown && !failed[shown] ? (
            <button type="button" onClick={() => play(shownRef.current)} className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/45 font-bold text-white" style={{ fontSize: 30, borderRadius: 18 }}>
              ▶ Click to play
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
