"use client";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Stage } from "../ui/primitives";
import { scene } from "@/lib/scene";
import { register } from "@/lib/slideLayer";

gsap.registerPlugin(ScrollTrigger);

export const TRIP_VH = 3.2; // each slide section is this many viewport heights tall

/* A slide reached by a "trip". The section is scroll distance only: its trigger maps the whole
   way from the previous slide's stop (the section's top entering the bottom of the screen) to
   this slide's stop (its bottom at the bottom of the screen) onto q = 0..1, so leaving a slide
   starts moving the scene from the very first frame. Over that scroll she runs from the previous
   sign to this one and the camera zooms into it. The slide itself sits in a fixed layer that
   lib/slideLayer drives from the scroll state: it grows out of the billboard as the camera
   arrives and shrinks back onto it when you move on. `index` is the 1-based slide number. */
export function Slide({ id, label, index, tone = "paper", stageStyle, children }: { id: string; label: string; index: number; tone?: "paper" | "dark"; stageStyle?: CSSProperties; children: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const w = wrap.current;
    const stage = w?.querySelector<HTMLElement>(".stage");
    if (!w || !stage) return;
    const off = register(index, w, stage);
    const st = ScrollTrigger.create({
      trigger: section.current,
      start: "top bottom",
      end: "bottom bottom",
      onUpdate: (self) => scene.setTrip(index, self.progress),
    });
    return () => {
      st.kill();
      off();
    };
  }, [index]);
  return (
    <section id={id} ref={section} data-label={label} data-index={index} className="slide trip" style={{ height: `${TRIP_VH * 100}vh` }}>
      <div className="pointer-events-none fixed inset-0">
        <div ref={wrap} className="absolute inset-0" style={{ opacity: 0, visibility: "hidden", transform: "translateY(150vh)" }}>
          <Stage tone={tone} style={stageStyle}>
            {children}
          </Stage>
        </div>
      </div>
    </section>
  );
}
