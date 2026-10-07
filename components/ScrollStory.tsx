"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { hero } from "@/lib/content";
import { STORY_VH, range, srange, story, storyState } from "@/lib/story";
import { scene } from "@/lib/scene";
import { XRAY_LABELS, labelEls } from "@/lib/labels";
import { Box } from "./ui/primitives";

gsap.registerPlugin(ScrollTrigger);

export default function ScrollStory() {
  const section = useRef<HTMLElement>(null);

  // overlay refs
  const heroBlock = useRef<HTMLDivElement>(null);
  const cue = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const microTitle = useRef<HTMLDivElement>(null);
  const stateTag = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const heroScrim = useRef<HTMLDivElement>(null);
  const dim = useRef<HTMLDivElement>(null);
  const chips = useRef<(HTMLDivElement | null)[]>([]);
  const words = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: section.current,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        story.set(self.progress);
        scene.setStory(self.progress);
      },
    });
    const unsub = story.subscribe((p) => {
      const s = storyState(p);
      const heroO = 1 - srange(p, 0.04, 0.12);
      if (heroBlock.current) {
        heroBlock.current.style.opacity = String(heroO);
        heroBlock.current.style.transform = `translateY(${-50 * (1 - heroO)}px)`;
      }
      if (cue.current) cue.current.style.opacity = String(1 - range(p, 0.01, 0.05));
      if (flash.current) flash.current.style.opacity = String(Math.min(1, s.flash));
      if (microTitle.current) microTitle.current.style.opacity = String(range(p, 0.445, 0.47) * (1 - range(p, 0.62, 0.655)));
      if (stateTag.current) {
        const text = s.porosity < 0.2 ? "Normal bone" : "Bone loss";
        if (stateTag.current.textContent !== text) stateTag.current.textContent = text;
        stateTag.current.classList.toggle("bg-risk-red", text !== "Normal bone");
        stateTag.current.classList.toggle("text-paper", text !== "Normal bone");
        stateTag.current.classList.toggle("bg-paper", text === "Normal bone");
        stateTag.current.classList.toggle("text-ink", text === "Normal bone");
      }
      if (scrim.current) scrim.current.style.opacity = String(s.micro ? 1 : 0);
      if (heroScrim.current) heroScrim.current.style.opacity = String(heroO);
      if (dim.current) dim.current.style.opacity = String(s.micro || s.finish ? 0 : 0.62 * s.xray);
      const chipT = [0.47, 0.52, 0.57];
      chips.current.forEach((el, i) => {
        if (!el) return;
        const o = range(p, chipT[i], chipT[i] + 0.025) * (1 - range(p, 0.62, 0.655));
        el.style.opacity = String(o);
        el.style.transform = `translateY(${30 * (1 - o)}px)`;
      });
      const wordT = [0.645, 0.71, 0.775];
      words.current.forEach((el, i) => {
        if (!el) return;
        const o = range(p, wordT[i], wordT[i] + 0.03) * (1 - range(p, 0.835, 0.86));
        el.style.opacity = String(o);
        el.style.transform = `translateX(${-40 * (1 - range(p, wordT[i], wordT[i] + 0.03))}px)`;
      });
    });
    return () => {
      st.kill();
      unsub();
    };
  }, []);

  return (
    <section id="story" ref={section} className="relative" style={{ height: `${STORY_VH * 100}vh` }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* daylight scrim behind the hero headline, and a dimmer for the X-ray */}
        <div ref={heroScrim} className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(20,20,22,0.88) 0%, rgba(20,20,22,0.7) 34%, rgba(20,20,22,0.25) 56%, rgba(20,20,22,0) 72%)" }} />
        <div ref={dim} className="pointer-events-none absolute inset-0" style={{ opacity: 0, background: "radial-gradient(ellipse at 55% 50%, rgba(8,12,24,0.45) 0%, rgba(8,12,24,0.85) 70%, rgba(8,12,24,0.95) 100%)" }} />
        {/* left-side scrim so captions stay readable over the bone lattice */}
        <div ref={scrim} className="pointer-events-none absolute inset-0" style={{ opacity: 0, transition: "opacity 0.25s linear", background: "linear-gradient(90deg, rgba(20,20,22,0.9) 0%, rgba(20,20,22,0.72) 40%, rgba(20,20,22,0.25) 70%, rgba(20,20,22,0) 100%)" }} />

        {/* X-ray bone labels, projected from 3D each frame (viewport px, 28px text) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {XRAY_LABELS.map((l) => (
            <div
              key={l.id}
              ref={(el) => {
                labelEls[l.id] = el;
              }}
              className="xray-label absolute left-0 top-0"
              style={{ opacity: 0, flexDirection: l.left ? "row-reverse" : "row" }}
            >
              <span className="dot" />
              <span className="name">{l.name}</span>
              <span className="type">{l.type}</span>
            </div>
          ))}
        </div>

        {/* overlays live on a 1920x1080 stage, scaled like every other slide */}
        <div className="stage" style={{ background: "transparent", pointerEvents: "none" }}>
          {/* HERO */}
          <div ref={heroBlock}>
            <Box x={96} y={120}>
              <div className="inline-block bg-lime px-6 py-2 font-bold uppercase tracking-wide text-ink" style={{ fontSize: 28, lineHeight: "36px", clipPath: "polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)" }}>
                {hero.eyebrow}
              </div>
            </Box>
            <Box x={96} y={200} w={1200}>
              <h1 className="h-display m-0 text-paper" style={{ fontSize: 176 }}>
                {hero.lines.map((l, i) => (
                  <span key={l} className={`block ${i === 2 ? "text-lime" : ""}`}>
                    {l}
                  </span>
                ))}
              </h1>
            </Box>
            <Box x={96} y={720} w={1100}>
              <p className="m-0 text-paper" style={{ fontSize: 44, fontWeight: 500 }}>
                {hero.subtitle}
              </p>
            </Box>
            <Box x={96} y={820}>
              <div className="inline-flex flex-col bg-paper px-8 py-5 text-ink" style={{ clipPath: "polygon(0 0, 100% 0, calc(100% - 18px) 100%, 0 100%)" }}>
                <span style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.15 }}>{hero.presenter}</span>
                <span style={{ fontSize: 28, fontWeight: 500 }}>{hero.role}</span>
              </div>
            </Box>
          </div>
          <div ref={cue} className="chrome">
            <Box x={96} y={990}>
              <div className="flex items-center gap-4 text-paper/70" style={{ fontSize: 28 }}>
                <span>Scroll</span>
                <span className="inline-block h-[2px] w-16 bg-lime" />
                <span>or press →</span>
              </div>
            </Box>
          </div>

          {/* MICRO BONE captions */}
          <div ref={microTitle} style={{ opacity: 0 }}>
            <Box x={96} y={330}>
              <div className="font-bold uppercase tracking-wide text-lime" style={{ fontSize: 30 }}>
                Inside the femur · bone in cross-section
              </div>
            </Box>
            <Box x={96} y={386}>
              <div ref={stateTag} className="inline-block bg-paper px-5 py-2 font-extrabold uppercase text-ink" style={{ fontSize: 28, clipPath: "polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)" }}>
                Normal bone
              </div>
            </Box>
            <Box x={96} y={640}>
              <div className="flex flex-col gap-3 text-paper" style={{ fontSize: 28 }}>
                <div className="flex items-center gap-4">
                  <span className="inline-block h-6 w-6 rounded-sm" style={{ background: "#ede0c8" }} />
                  <span><b>Cortical bone</b> · the dense outer shell</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="inline-block h-6 w-6 rounded-sm" style={{ background: "#e59a3f" }} />
                  <span><b>Trabecular bone</b> · the spongy interior, lost first</span>
                </div>
              </div>
            </Box>
          </div>
          {["Low energy", "Low oestrogen", "Bone loss"].map((t, i) => (
            <div
              key={t}
              ref={(el) => {
                chips.current[i] = el;
              }}
              style={{ opacity: 0 }}
            >
              <Box x={96 + i * 400} y={520}>
                <div className="flex items-center gap-6">
                  <div className={`${i === 2 ? "bg-risk-red text-paper" : "bg-paper text-ink"} px-7 py-4 font-extrabold uppercase`} style={{ fontSize: 34, clipPath: "polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)" }}>
                    {t}
                  </div>
                  {i < 2 ? <span className="text-lime" style={{ fontSize: 48, fontWeight: 900 }}>→</span> : null}
                </div>
              </Box>
            </div>
          ))}
          {["REFUEL", "REBUILD", "RETURN"].map((w, i) => (
            <div
              key={w}
              ref={(el) => {
                words.current[i] = el;
              }}
              style={{ opacity: 0 }}
            >
              <Box x={96} y={400 + i * 190}>
                <div className={`h-display ${i === 2 ? "text-lime" : "text-paper"}`} style={{ fontSize: 170 }}>
                  {w}.
                </div>
              </Box>
            </div>
          ))}
        </div>

        {/* camera-cut flash */}
        <div ref={flash} className="pointer-events-none absolute inset-0" style={{ opacity: 0, background: "radial-gradient(circle at 50% 50%, #ffffff 0%, #c6f432 45%, #1e1e1e 100%)" }} />
      </div>
    </section>
  );
}
