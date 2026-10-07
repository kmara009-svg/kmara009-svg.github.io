"use client";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Stage } from "../ui/primitives";
import { FINISH_INDEX, scene } from "@/lib/scene";
import { range } from "@/lib/story";

gsap.registerPlugin(ScrollTrigger);

export const TRIP_VH = 3.2; // each slide section is this many viewport heights tall

/* A slide reached by a "trip": over the section's scroll she runs to the slide's sign and
   halts in front of it, the camera zooms into the sign, and finally the slide rises over it.
   `index` is the 1-based slide number. */
export function Slide({ id, label, index, tone = "paper", stageStyle, children }: { id: string; label: string; index: number; tone?: "paper" | "dark"; stageStyle?: CSSProperties; children: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let exit: gsap.core.Tween | undefined;
    const setOut = (t: number) => {
      if (!wrap.current) return;
      wrap.current.style.opacity = String(1 - t);
      wrap.current.style.transform = `translateY(${-40 * t}px) scale(${1 - 0.03 * t})`;
      wrap.current.style.pointerEvents = "none";
    };
    const st = ScrollTrigger.create({
      trigger: section.current,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        const q = self.progress;
        exit?.kill();
        scene.setTrip(index, q);
        if (wrap.current) {
          const o = index === FINISH_INDEX ? range(q, 0.95, 0.995) : range(q, 0.905, 0.985);
          // the slide is only mounted once the camera is on its sign, so its entrance effects play as it appears
          wrap.current.style.display = q >= 0.88 ? "block" : "none";
          wrap.current.style.opacity = String(o);
          wrap.current.style.transform = `translateY(${(1 - o) * 60}px) scale(${0.96 + 0.04 * o})`;
          wrap.current.style.pointerEvents = o > 0.5 ? "auto" : "none";
        }
      },
    });
    // leaving the slide: instead of letting it crawl off with the scroll, fade it out in a quick timed beat
    const leave = ScrollTrigger.create({
      trigger: section.current,
      start: "bottom bottom-=8", // a few px past the stop, so sitting on the slide never counts as leaving it
      end: "bottom top",
      onEnter: () => {
        exit?.kill();
        const o = { t: 0 };
        exit = gsap.to(o, { t: 1, duration: 0.35, ease: "power2.in", onUpdate: () => setOut(o.t) });
      },
      onLeaveBack: () => {
        exit?.kill();
        setOut(0);
        if (wrap.current) wrap.current.style.pointerEvents = "auto";
      },
    });
    return () => {
      exit?.kill();
      leave.kill();
      st.kill();
    };
  }, [index]);
  return (
    <section id={id} ref={section} data-label={label} data-index={index} className="slide trip" style={{ height: `${TRIP_VH * 100}vh` }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        <div ref={wrap} className="absolute inset-0" style={{ opacity: 0, display: "none", transformOrigin: "50% 60%" }}>
          <Stage tone={tone} style={stageStyle}>
            {children}
          </Stage>
        </div>
      </div>
    </section>
  );
}
