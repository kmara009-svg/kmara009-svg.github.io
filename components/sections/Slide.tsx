"use client";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Stage } from "../ui/primitives";
import { SLIDE_COUNT, scene } from "@/lib/scene";
import { range } from "@/lib/story";

gsap.registerPlugin(ScrollTrigger);

export const TRIP_VH = 2.6; // each slide section is this many viewport heights tall

/* A slide reached by a "trip": the first part of the section's scroll lifts the camera to a
   satellite view while the runner moves to the next marker, then dives back to street level,
   and finally the slide rises over the scene. `index` is the 1-based slide number. */
export function Slide({ id, label, index, tone = "paper", stageStyle, children }: { id: string; label: string; index: number; tone?: "paper" | "dark"; stageStyle?: CSSProperties; children: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: section.current,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        const q = self.progress;
        scene.setTrip(index, q);
        if (wrap.current) {
          const o = index >= SLIDE_COUNT ? range(q, 0.95, 0.995) : range(q, 0.92, 0.985);
          wrap.current.style.opacity = String(o);
          wrap.current.style.transform = `translateY(${(1 - o) * 60}px) scale(${0.96 + 0.04 * o})`;
          wrap.current.style.pointerEvents = o > 0.5 ? "auto" : "none";
        }
      },
    });
    return () => st.kill();
  }, [index]);
  return (
    <section id={id} ref={section} data-label={label} data-index={index} className="slide trip" style={{ height: `${TRIP_VH * 100}vh` }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        <div ref={wrap} className="absolute inset-0" style={{ opacity: 0, transformOrigin: "50% 60%" }}>
          <Stage tone={tone} style={stageStyle}>
            {children}
          </Stage>
        </div>
      </div>
    </section>
  );
}
