"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { speechFiles, speechFor } from "@/lib/speeches";

/* The presenter's recorded speech for the stop the page is resting on, in the top-right corner. It
   comes up and plays once a move has come to rest on a stop that has one, and stops and fades the
   moment the page moves on. Each file has its own element: a speech that runs on into the next stop
   resumes where it paused, and the next stop's file is already loading. Browsers hold back sound
   until the viewer has clicked or pressed a key, so the first one may wait for that. */
const FILES = speechFiles();

export default function SpeechOverlay({ stop, ahead }: { stop: string | null; ahead: string | null }) {
  const els = useRef<Record<string, HTMLVideoElement | null>>({});
  const last = useRef<string | null>(null); // the file last brought up: coming back to it resumes rather than restarts
  const [shown, setShown] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  const play = useCallback((src: string) => {
    els.current[src]
      ?.play()
      .then(() => setBlocked(false))
      .catch((e: DOMException) => setBlocked(e.name === "NotAllowedError"));
  }, []);

  useEffect(() => {
    const src = speechFor(stop);
    for (const [f, v] of Object.entries(els.current)) if (f !== src) v?.pause();
    if (!src) {
      setShown(null);
      return;
    }
    // wait a beat, so scrolling by hand past a stop doesn't flash its video up
    const t = window.setTimeout(() => {
      const v = els.current[src];
      if (!v) return;
      if (last.current !== src) v.currentTime = 0;
      last.current = src;
      setShown(src);
      play(src);
    }, 150);
    return () => window.clearTimeout(t);
  }, [stop, play]);

  // sound held back: start on the first click or key press
  useEffect(() => {
    if (!blocked || !shown) return;
    const retry = () => play(shown);
    window.addEventListener("pointerdown", retry, true);
    window.addEventListener("keydown", retry, true);
    return () => {
      window.removeEventListener("pointerdown", retry, true);
      window.removeEventListener("keydown", retry, true);
    };
  }, [blocked, shown, play]);

  if (!FILES.length) return null;
  const next = speechFor(ahead);
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
              preload={f === shown || f === next ? "auto" : "metadata"}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ opacity: shown === f ? 1 : 0, transition: "opacity 0.25s ease", borderRadius: 18, border: "3px solid rgba(255,255,255,0.9)", boxShadow: "0 16px 48px rgba(0,0,0,0.45)", background: "#111" }}
            />
          ))}
          {blocked && shown ? (
            <button type="button" onClick={() => play(shown)} className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/45 font-bold text-white" style={{ fontSize: 30, borderRadius: 18 }}>
              ▶ Click to play
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
