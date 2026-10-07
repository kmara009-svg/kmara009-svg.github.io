"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import dynamic from "next/dynamic";
import ScrollStory from "./ScrollStory";
import ProgressTrack from "./ProgressTrack";
import { BEATS } from "@/lib/story";
import { IntroSections } from "./sections/Intro";
import { CareSections } from "./sections/Care";
import { ProgramSections } from "./sections/Program";
import { ClosingSections } from "./sections/Closing";

gsap.registerPlugin(ScrollTrigger);

const StoryCanvas = dynamic(() => import("./three/StoryCanvas"), { ssr: false });

type Stop = { id: string; label: string; y: number };

export default function Experience() {
  const lenisRef = useRef<Lenis | null>(null);
  const stops = useRef<Stop[]>([]);
  const animating = useRef(false);
  const [presenting, setPresenting] = useState(false);
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);

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

  /* ---------- stops (story beats + every slide) ---------- */
  const computeStops = useCallback(() => {
    const vh = window.innerHeight;
    const list: Stop[] = [];
    const storyEl = document.getElementById("story");
    if (storyEl) {
      const top = storyEl.offsetTop;
      const dist = storyEl.offsetHeight - vh;
      BEATS.forEach((b) => list.push({ id: `story-${b.id}`, label: "Refuel. Rebuild. Return.", y: top + dist * b.p }));
    }
    document.querySelectorAll<HTMLElement>("section.slide").forEach((el, i) => {
      // a trip section's stop is its end, where the slide has fully risen over the scene
      list.push({ id: el.id || `slide-${i}`, label: el.dataset.label || "", y: el.offsetTop + el.offsetHeight - vh });
    });
    stops.current = list;
  }, []);

  const nearest = useCallback((y: number) => {
    let best = 0;
    let bd = Infinity;
    stops.current.forEach((s, i) => {
      const d = Math.abs(s.y - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }, []);

  const goTo = useCallback(
    (i: number, duration = 1.5) => {
      const lenis = lenisRef.current;
      if (!lenis || !stops.current.length) return;
      const idx = Math.max(0, Math.min(stops.current.length - 1, i));
      animating.current = true;
      const dist = Math.abs(stops.current[idx].y - lenis.scroll) / window.innerHeight;
      if (duration >= 1.5) duration = Math.min(3.2, 1.1 + 0.85 * dist); // a slide trip (~1.6 screens) takes ~2.5 s
      lenis.scrollTo(stops.current[idx].y, {
        duration,
        easing: (t) => 1 - Math.pow(1 - t, 3),
        lock: true,
        force: true,
        onComplete: () => {
          animating.current = false;
        },
      });
    },
    []
  );

  /* ---------- Lenis + ScrollTrigger + snapping ---------- */
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, smoothWheel: true });
    lenisRef.current = lenis;
    let snapTimer: number | undefined;
    const noSnap = new URLSearchParams(window.location.search).get("nosnap") === "1";
    lenis.on("scroll", (e: Lenis) => {
      ScrollTrigger.update();
      setProgress(e.limit > 0 ? e.scroll / e.limit : 0);
      const idx = nearest(e.scroll);
      setCurrent(idx);
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(() => {
        if (animating.current || noSnap) return;
        const target = stops.current[nearest(lenis.scroll)];
        if (target && Math.abs(target.y - lenis.scroll) > 3) goTo(nearest(lenis.scroll), 0.8);
      }, 260);
    });
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const refresh = () => {
      computeStops();
      ScrollTrigger.refresh();
    };
    refresh();
    const t1 = window.setTimeout(refresh, 300);
    const t2 = window.setTimeout(refresh, 1500);
    window.addEventListener("resize", refresh);
    document.fonts?.ready.then(refresh);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(snapTimer);
      window.removeEventListener("resize", refresh);
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [computeStops, goTo, nearest]);

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const lenis = lenisRef.current;
      if (!lenis) return;
      const cur = nearest(lenis.targetScroll ?? lenis.scroll);
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case " ":
        case "Enter":
          e.preventDefault();
          goTo(cur + 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
        case "Backspace":
          e.preventDefault();
          goTo(cur - 1);
          break;
        case "Home":
          e.preventDefault();
          goTo(0);
          break;
        case "End":
          e.preventDefault();
          goTo(stops.current.length - 1);
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
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, nearest]);

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
    if (new URLSearchParams(window.location.search).get("qa") === "1") document.documentElement.classList.add("qa");
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const label = stops.current[current]?.label ?? "";

  return (
    <main className="relative">
      <div className="fixed inset-0 z-0 bg-ink">
        <StoryCanvas />
      </div>
      <div className="relative z-10">
      <ScrollStory />
      <IntroSections />
      <CareSections />
      <ProgramSections />
      <ClosingSections />
      </div>

      {/* chrome: hidden in presentation mode. Nothing is ever placed top-right. */}
      <div className="chrome fixed left-6 top-5 z-40 flex items-center gap-4 text-paper mix-blend-difference" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.08em" }}>
        <span className="uppercase">Refuel · Rebuild · Return</span>
        <span className="opacity-60">/</span>
        <span className="uppercase opacity-80">{label}</span>
      </div>
      <div className="chrome fixed bottom-10 right-6 z-40 flex items-center gap-3 text-paper mix-blend-difference" style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.06em" }}>
        <kbd className="rounded border border-current px-2 py-0.5">←</kbd>
        <kbd className="rounded border border-current px-2 py-0.5">→</kbd>
        <kbd className="rounded border border-current px-2 py-0.5">space</kbd>
        <span>navigate</span>
        <span className="opacity-50">·</span>
        <button type="button" onClick={() => setPresenting(true)} className="uppercase underline-offset-4 hover:underline">
          <kbd className="mr-2 rounded border border-current px-2 py-0.5">P</kbd>presentation mode
        </button>
      </div>

      <ProgressTrack progress={progress} current={current} total={stops.current.length} />
    </main>
  );
}
