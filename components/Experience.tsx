"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import dynamic from "next/dynamic";
import ScrollStory from "./ScrollStory";
import ProgressTrack from "./ProgressTrack";
import { BEATS } from "@/lib/story";
import { CEREMONY, SLIDE_COUNT, refsHold, scene } from "@/lib/scene";
import { setTransit } from "@/lib/slideLayer";
import { IntroSections } from "./sections/Intro";
import { CareSections } from "./sections/Care";
import { ProgramSections } from "./sections/Program";
import { ClosingSections } from "./sections/Closing";

gsap.registerPlugin(ScrollTrigger);

const StoryCanvas = dynamic(() => import("./three/StoryCanvas"), { ssr: false });

type Stop = { id: string; label: string; y: number };

/* the medal trip from a standstill: a brisk run in, slower through the ceremony (lib/scene
   CEREMONY, 0.42 to 0.84 of the way), then the zoom; and back, out of the zoom, through the
   ceremony, the run back. Both set off at once and come to rest. Monotone cubics through
   (t, progress, slope). */
const MEDAL_IN = [
  [0, 0, 0.3],
  [0.34, 0.42, 0.85],
  [0.8, 0.84, 0.95],
  [1, 1, 0],
];
const MEDAL_OUT = [
  [0, 0, 0.3],
  [0.2, 0.16, 0.95],
  [0.66, 0.58, 0.85],
  [1, 1, 0],
];
function medalEase(K: number[][], t: number) {
  let i = 0;
  while (i < K.length - 2 && t > K[i + 1][0]) i++;
  const [t0, p0, m0] = K[i], [t1, p1, m1] = K[i + 1];
  const h = t1 - t0, u = Math.min(1, Math.max(0, (t - t0) / h)), u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * h * m1;
}

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
      // the visible viewport (without any scrollbar), the box the fixed slide layer and canvas fill
      const el = document.documentElement;
      const s = Math.min(el.clientWidth / 1920, el.clientHeight / 1080);
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

  const goToRef = useRef<(i: number, d?: number) => void>(() => {});
  /* scroll speed (px/s), sampled from Lenis, so a move that starts while another is under way can
     pick up at the speed the page is already moving instead of restarting from a standstill */
  const vel = useRef({ v: 0, y: 0, t: 0 });
  const dest = useRef(0); // the stop the current move is heading for
  const soft = useRef(false); // the current move is a long settle that wheel or touch input may take over
  const goTo = useCallback(
    (i: number, duration = 1.5, lock = true) => {
      const lenis = lenisRef.current;
      if (!lenis || !stops.current.length) return;
      const idx = Math.max(0, Math.min(stops.current.length - 1, i));
      const from = lenis.scroll;
      // a move across several stops (or a retarget mid-move) shows only the slide it is leaving,
      // if it starts on one, and the one it heads for, never the slides it flies past
      const at = nearest(from);
      const onStop = Math.abs(stops.current[at].y - from) < 2;
      const slideOf = (k: number) => k - BEATS.length + 1; // stops after the story beats are slides 1..n
      setTransit(Math.abs(idx - at) > 1 || !onStop ? [onStop ? slideOf(at) : -1, slideOf(idx)] : null);
      dest.current = idx;
      const to = stops.current[idx].y;
      const dist = Math.abs(to - from) / window.innerHeight;
      const trip = dist > 1.8; // a slide trip is 3.2 screens: ~6.5 s, moving from the first frame so a key press answers at once
      // the last trip, twice as long for the medal, gets the time for it when taken on its own
      const medal = trip && onStop && refsHold() && Math.abs(idx - at) === 1 && Math.max(idx, at) === stops.current.length - 1;
      if (duration >= 1.5) duration = trip ? (medal ? Math.min(12, 2.4 + 1.5 * dist) : Math.min(6.5, 2.4 + 1.4 * dist)) : Math.min(3, 1.1 + 0.85 * dist);
      // already moving (a second press mid-trip): start the new ease at the current speed, so the
      // camera and the runner carry straight on rather than lurching
      const moving = animating.current && Math.abs(vel.current.v) > 30 && Math.sign(vel.current.v) === Math.sign(to - from);
      const m0 = moving ? Math.min(3, Math.abs((vel.current.v * duration) / (to - from || 1))) : trip ? 0.3 : 0;
      const easing = medal && !moving
        ? (t: number) => medalEase(to > from ? MEDAL_IN : MEDAL_OUT, t)
        : moving || trip
        ? (t: number) => {
            // cubic Hermite from 0 to 1, starting with slope m0 and coming to rest; from a standstill
            // a trip uses a gentle cosine ease with a small initial push instead
            if (!moving) return 0.3 * t + 0.7 * (0.5 - 0.5 * Math.cos(Math.PI * t));
            const t2 = t * t, t3 = t2 * t;
            return (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2);
          }
        : (t: number) => 1 - Math.pow(1 - t, 3);
      animating.current = true;
      soft.current = !lock;
      lenis.scrollTo(to, {
        duration,
        easing,
        lock,
        force: true,
        onComplete: () => {
          animating.current = false;
          soft.current = false;
          setTransit(null);
        },
      });
    },
    [nearest]
  );
  goToRef.current = goTo;

  /* ---------- Lenis + ScrollTrigger + snapping ---------- */
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, smoothWheel: true });
    lenisRef.current = lenis;
    let snapTimer: number | undefined;
    const noSnap = new URLSearchParams(window.location.search).get("nosnap") === "1";
    let lastP = -1;
    // wheel or touch input takes over a long settle: stop it where it is and scroll on from there
    lenis.on("virtual-scroll", ({ deltaX, deltaY }: { deltaX: number; deltaY: number }) => {
      if (!soft.current || !animating.current || (deltaX === 0 && deltaY === 0)) return;
      animating.current = false;
      soft.current = false;
      setTransit(null);
      lenis.scrollTo(lenis.animatedScroll, { immediate: true, force: true });
    });
    lenis.on("scroll", (e: Lenis) => {
      ScrollTrigger.update();
      scene.resolve(e.scroll);
      const now = performance.now(), vs = vel.current;
      if (now - vs.t > 8) {
        const inst = ((e.scroll - vs.y) / (now - vs.t)) * 1000;
        vs.v = now - vs.t > 120 ? inst : vs.v + (inst - vs.v) * 0.5;
        vs.y = e.scroll;
        vs.t = now;
      }
      // state updates re-render the chrome only (the heavy tree below is memoised), and only when they change visibly
      const pr = e.limit > 0 ? Math.round((e.scroll / e.limit) * 400) / 400 : 0;
      if (pr !== lastP) {
        lastP = pr;
        setProgress(pr);
      }
      const idx = nearest(e.scroll);
      setCurrent((c) => (c === idx ? c : idx));
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(() => {
        if (animating.current || noSnap) return;
        let k = nearest(lenis.scroll);
        // once the medal ceremony has begun, settle on through it to the references rather than
        // back to the finish line
        const st = scene.get();
        if (st.mode === "trip" && st.trip === SLIDE_COUNT && refsHold() && st.q >= CEREMONY[0]) k = stops.current.length - 1;
        const d = stops.current[k] ? Math.abs(stops.current[k].y - lenis.scroll) : 0;
        // a short settle onto the stop; from deep in the long last section it goes at a trip's pace
        // (so the ceremony plays rather than flashes by) and gives way to the next wheel or touch input
        const far = d > 1.8 * window.innerHeight;
        if (d > 3) goTo(k, far ? undefined : 0.8, !far);
      }, 260);
    });
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // keep the presenter on the same stop when the layout changes (fullscreen, resize, late fonts)
    const refresh = () => {
      const at = stops.current.length && !animating.current ? nearest(lenis.scroll) : -1;
      computeStops();
      ScrollTrigger.refresh();
      if (at >= 0 && stops.current[at] && Math.abs(stops.current[at].y - lenis.scroll) > 2) lenis.scrollTo(stops.current[at].y, { immediate: true, force: true });
      scene.resolve(lenis.scroll);
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
      // mid-move, count from where it is heading (Lenis does not update its target for programmatic scrolls)
      const cur = animating.current ? dest.current : nearest(lenis.scroll);
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
    if (new URLSearchParams(window.location.search).get("qa") === "1") {
      document.documentElement.classList.add("qa");
      // QA hooks: jump between stops and read the scene state from automated checks
      Object.assign(window, { __goTo: (i: number, d?: number) => goToRef.current(i, d), __scene: scene, __stops: () => stops.current, __lenis: () => lenisRef.current, __ST: ScrollTrigger });
    }
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const label = stops.current[current]?.label ?? "";

  /* the scene and every slide are built once; scroll-driven state never re-renders them */
  const world = useMemo(
    () => (
      <>
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
      </>
    ),
    []
  );

  return (
    <main className="relative">
      {world}

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
