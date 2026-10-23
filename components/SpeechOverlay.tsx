"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { speechFiles, speechFor } from "@/lib/speeches";

/* The presenter's recorded speech for the stop the page is resting on, in the top-right corner. It
   comes up and plays once a move has come to rest on a stop that has one, and stops and fades the
   moment the page moves on, or when it finishes. Each file has its own element: a speech that runs
   on into the next stop resumes where it paused (or stays down if it has already finished), and the
   files around the stop the page is heading for are already loading, so a speech shows from its
   first frame rather than as an empty box.

   The speech of the stop the page opens on waits for R (or a click on it outside presentation mode),
   so a recording can be started first; R also restarts the current stop's speech from the top. */
const FILES = speechFiles();
const RETRY_MS = [0, 2000, 6000];
const STALE_MS = 20 * 60 * 1000; // the release's download links last 30 minutes, and the browser keeps using one once it has it

export default function SpeechOverlay({ stop, near, presenting }: { stop: string | null; near: (string | null)[]; presenting: boolean }) {
  const els = useRef<Record<string, HTMLVideoElement | null>>({});
  const stopRef = useRef(stop);
  stopRef.current = stop;
  const fresh = useRef(true); // the page has only just opened
  const last = useRef<string | null>(null); // the file last brought up: coming back to it resumes rather than restarts
  const [shown, setShown] = useState<string | null>(null);
  const shownRef = useRef<string | null>(null);
  const [live, setLive] = useState<string | null>(null); // the file that has started playing, so has a frame to show
  const [over, setOver] = useState<string | null>(null); // the file that has played to its end
  const [held, setHeld] = useState(false); // waiting for R or a click (the opening stop, or sound held back by the browser)
  const [failed, setFailed] = useState<Record<string, boolean>>({}); // could not be loaded: never shown as an empty box
  const failedRef = useRef<Record<string, boolean>>({});
  const [epoch, setEpoch] = useState<Record<string, number>>({}); // bumped to fetch a file afresh
  const started = useRef<Record<string, number>>({}); // when each element last started loading
  const tries = useRef<Record<string, number>>({});
  const pending = useRef<Record<string, boolean>>({});
  const resumeAt = useRef<Record<string, number>>({});
  const onMeta = useRef<Record<string, () => void>>({});

  const show = useCallback((src: string | null) => {
    shownRef.current = src;
    setShown(src);
  }, []);
  const setFail = useCallback((src: string, on: boolean) => {
    failedRef.current = { ...failedRef.current, [src]: on };
    setFailed(failedRef.current);
  }, []);

  // only ever the speech that is on screen, so nothing can start one hidden
  const play = useCallback((src: string | null) => {
    if (!src || shownRef.current !== src) return;
    els.current[src]
      ?.play()
      .then(() => setHeld(false))
      .catch((e: DOMException) => setHeld(e.name === "NotAllowedError"));
  }, []);

  /* fetch a file afresh (a new link from the release), then pick up where it was */
  const reload = useCallback(
    (src: string) => {
      const v = els.current[src];
      if (!v) return;
      if (resumeAt.current[src] === undefined) resumeAt.current[src] = v.currentTime;
      if (onMeta.current[src]) v.removeEventListener("loadedmetadata", onMeta.current[src]);
      onMeta.current[src] = () => {
        v.currentTime = resumeAt.current[src] ?? 0;
        play(src);
      };
      v.addEventListener("loadedmetadata", onMeta.current[src], { once: true });
      setEpoch((m) => ({ ...m, [src]: Date.now() }));
    },
    [play]
  );
  // a load that failed (an expired link, a network drop): try again after a pause, a few times at most
  const recover = useCallback(
    (src: string) => {
      if (pending.current[src]) return;
      const n = tries.current[src] ?? 0;
      if (n >= RETRY_MS.length) {
        setFail(src, true);
        return;
      }
      tries.current[src] = n + 1;
      pending.current[src] = true;
      window.setTimeout(() => {
        pending.current[src] = false;
        reload(src);
      }, RETRY_MS[n]);
    },
    [reload, setFail]
  );
  const stale = (src: string) => Date.now() - (started.current[src] ?? Date.now()) > STALE_MS;

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
      if (fresh.current) {
        fresh.current = false;
        setHeld(true);
        return;
      }
      if (failedRef.current[src] || v.error || stale(src)) {
        // it could not be loaded before, or its link has run out: fetch it afresh now its stop is up
        setFail(src, false);
        tries.current[src] = 0;
        reload(src);
        return;
      }
      play(src);
    }, 150);
    return () => window.clearTimeout(t);
  }, [stop, play, show, reload, setFail]);

  // files about to be needed whose links have run out are fetched afresh while still out of sight
  const nearKey = near.join("|");
  useEffect(() => {
    for (const id of nearKey.split("|")) {
      const f = speechFor(id || null);
      const v = f ? els.current[f] : null;
      if (f && v && v.paused && f !== shownRef.current && stale(f)) reload(f);
    }
  }, [nearKey, reload]);

  // R starts the current stop's speech (or restarts it from the top)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "r" && e.key !== "R") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const src = speechFor(stopRef.current);
      const v = src ? els.current[src] : null;
      if (!src || !v) return;
      v.currentTime = 0;
      last.current = src;
      setOver(null);
      show(src);
      play(src);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play, show]);

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
              src={epoch[f] ? `${f}?r=${epoch[f]}` : f}
              playsInline
              preload={warm.has(f) ? "auto" : "none"}
              onLoadStart={() => {
                started.current[f] = Date.now();
              }}
              onPlaying={() => {
                tries.current[f] = 0;
                delete resumeAt.current[f];
                setLive(f);
                setOver((o) => (o === f ? null : o));
              }}
              onEnded={() => setOver(f)}
              onEmptied={() => setLive((l) => (l === f ? null : l))}
              onError={() => recover(f)}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ opacity: shown === f && !failed[f] && over !== f && (live === f || (held && !presenting)) ? 1 : 0, transition: "opacity 0.25s ease", borderRadius: 18, border: "3px solid rgba(255,255,255,0.9)", boxShadow: "0 16px 48px rgba(0,0,0,0.45)", background: "#111" }}
            />
          ))}
          {held && shown && !failed[shown] && !presenting ? (
            <button type="button" onClick={() => play(shownRef.current)} className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/45 font-bold text-white" style={{ fontSize: 30, borderRadius: 18 }}>
              ▶ Press R or click to play
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
