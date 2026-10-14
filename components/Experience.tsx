"use client";
import { useEffect, useMemo, useState } from "react";
import ProgressTrack from "./ProgressTrack";
import MediaLayer from "./MediaLayer";
import StoryLayer from "./story/StoryLayer";
import { IntroSections } from "./sections/Intro";
import { CareSections } from "./sections/Care";
import { ProgramSections } from "./sections/Program";
import { ClosingSections } from "./sections/Closing";
import { deck, stopLabel } from "@/lib/deck";

/* The presentation shell: a fixed 1920x1080 stage scaled to the window, real footage underneath,
   the story overlays and the slides on top. Navigation is stop-based: → / ↓ / space / Enter /
   PageDown or a wheel notch or swipe moves one stop forward (a press while footage plays skips
   to its end), ← / ↑ / PageUp / Backspace moves back, Home / End jump. P toggles presentation
   mode (fullscreen, no cursor, no chrome). ?stop=N opens on stop N; ?qa=1 shows the webcam zone. */
export default function Experience() {
  const [presenting, setPresenting] = useState(false);
  const [current, setCurrent] = useState(0);
  const [moveS, setMoveS] = useState(0);

  /* ---------- 1920x1080 stage scaling ---------- */
  useEffect(() => {
    const fit = () => {
      const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      document.documentElement.style.setProperty("--stage-scale", String(s));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  /* ---------- deck state for the chrome ---------- */
  useEffect(() => {
    const off = deck.subscribe((m) => {
      setCurrent(m.to);
      setMoveS(m.total);
    });
    const params = new URLSearchParams(window.location.search);
    if (params.get("qa") === "1") document.documentElement.classList.add("qa");
    const start = Number(params.get("stop"));
    if (start > 0) deck.go(start, { instant: true });
    (window as unknown as { __deck: typeof deck }).__deck = deck;
    return () => {
      off();
    };
  }, []);

  /* ---------- input: keys, wheel, swipe ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case " ":
        case "Enter":
          e.preventDefault();
          if (!e.repeat) deck.next();
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
        case "Backspace":
          e.preventDefault();
          if (!e.repeat) deck.prev();
          break;
        case "Home":
          e.preventDefault();
          deck.go(0, { instant: true });
          break;
        case "End":
          e.preventDefault();
          deck.go(deck.count - 1, { instant: true });
          break;
        case "p":
        case "P":
          setPresenting((v) => !v);
          break;
        case "Escape":
          setPresenting(false);
          break;
      }
    };
    let acc = 0;
    let lock = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = performance.now();
      if (now < lock) return;
      acc += e.deltaY;
      if (Math.abs(acc) < 60) return;
      if (acc > 0) deck.next();
      else deck.prev();
      acc = 0;
      lock = now + 700;
    };
    let touchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchY === null) return;
      const dy = touchY - (e.changedTouches[0]?.clientY ?? touchY);
      touchY = null;
      if (Math.abs(dy) < 50) return;
      if (dy > 0) deck.next();
      else deck.prev();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  /* ---------- presentation mode ---------- */
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("presenting", presenting);
    if (presenting) {
      html.requestFullscreen?.().catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [presenting]);
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /* footage, story and every slide are built once; navigation never re-renders them */
  const world = useMemo(
    () => (
      <>
        <MediaLayer />
        <StoryLayer />
        <IntroSections />
        <CareSections />
        <ProgramSections />
        <ClosingSections />
      </>
    ),
    []
  );

  return (
    <main className="deck">
      {world}

      {/* chrome: hidden in presentation mode. Nothing is ever placed top-right. */}
      <div className="chrome fixed left-6 top-5 z-40 flex items-center gap-4 text-paper mix-blend-difference" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.08em" }}>
        <span className="uppercase">Refuel · Rebuild · Return</span>
        <span className="opacity-60">/</span>
        <span className="uppercase opacity-80">{stopLabel(current)}</span>
      </div>
      <div className="chrome fixed bottom-10 right-6 z-40 flex items-center gap-3 text-paper mix-blend-difference" style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.06em" }}>
        <kbd className="rounded border border-current px-2 py-0.5">←</kbd>
        <kbd className="rounded border border-current px-2 py-0.5">→</kbd>
        <kbd className="rounded border border-current px-2 py-0.5">space</kbd>
        <span>navigate</span>
        <span className="opacity-50">·</span>
        <button type="button" onClick={() => setPresenting(true)} className="pointer-events-auto uppercase underline-offset-4 hover:underline">
          <kbd className="mr-2 rounded border border-current px-2 py-0.5">P</kbd>presentation mode
        </button>
      </div>

      <ProgressTrack progress={deck.count > 1 ? current / (deck.count - 1) : 0} current={current} total={deck.count} seconds={moveS} />
    </main>
  );
}
