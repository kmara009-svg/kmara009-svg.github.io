"use client";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Stage } from "../ui/primitives";
import { FINISH_INDEX, scene } from "@/lib/scene";

gsap.registerPlugin(ScrollTrigger);

export const TRIP_VH = 3.2; // each slide section is this many viewport heights tall
export const LEAVE_EVENT = "stage:leave"; // dispatched by the navigation the moment a slide is left

/* A slide reached by a "trip": over the section's scroll she runs to the slide's sign, the camera
   zooms into the sign, and the slide appears over it. Every slide stays mounted but parked off
   screen (so showing one never stalls a frame); it is revealed and dismissed with short timed
   tweens rather than scrubbed by the scroll, which keeps both ends crisp. `index` is the 1-based
   slide number. */
export function Slide({ id, label, index, tone = "paper", stageStyle, children }: { id: string; label: string; index: number; tone?: "paper" | "dark"; stageStyle?: CSSProperties; children: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const w = wrap.current;
    if (!w) return;
    let tween: gsap.core.Tween | undefined;
    let shown = false;
    const park = () => {
      w.style.visibility = "hidden";
      w.style.transform = "translateY(150vh)";
      w.style.opacity = "0";
      w.style.pointerEvents = "none";
      w.style.willChange = "auto";
    };
    const show = () => {
      if (shown) return;
      shown = true;
      tween?.kill();
      const o = { t: 0 };
      w.style.willChange = "opacity, transform"; // composited on the GPU while it fades, so the page never repaints it per frame
      w.style.visibility = "visible";
      const apply = () => {
        w.style.opacity = String(o.t);
        w.style.transform = `translateY(${(1 - o.t) * 48}px) scale(${0.97 + 0.03 * o.t})`;
        w.style.pointerEvents = o.t > 0.5 ? "auto" : "none";
      };
      apply();
      tween = gsap.to(o, { t: 1, duration: 0.5, ease: "power3.out", onUpdate: apply });
    };
    const hide = (fast = false) => {
      if (!shown) return;
      shown = false;
      if (!fast) scene.leave(index);
      tween?.kill();
      const o = { t: 1 };
      w.style.pointerEvents = "none";
      w.style.willChange = "opacity, transform";
      tween = gsap.to(o, {
        t: 0,
        duration: fast ? 0.22 : 0.28,
        ease: "power1.in",
        onUpdate: () => {
          w.style.opacity = String(o.t);
          w.style.transform = `translateY(${-40 * (1 - o.t)}px) scale(${1 - 0.03 * (1 - o.t)})`;
        },
        onComplete: park,
      });
    };
    park();
    const at = index === FINISH_INDEX ? 0.94 : 0.9; // the camera is on the sign by here
    const st = ScrollTrigger.create({
      trigger: section.current,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        const q = self.progress;
        scene.setTrip(index, q);
        if (q >= at) show();
        else hide(true);
      },
    });
    // leaving the slide forwards: fade it out in a quick beat (a few px past the stop, so sitting on the slide never counts as leaving it)
    const leave = ScrollTrigger.create({
      trigger: section.current,
      start: "bottom bottom-=8",
      end: "bottom top",
      onEnter: () => hide(),
      onLeaveBack: () => show(),
    });
    const onLeave = (e: Event) => {
      if ((e as CustomEvent<{ id: string }>).detail?.id === id) hide();
    };
    document.addEventListener(LEAVE_EVENT, onLeave);
    return () => {
      tween?.kill();
      leave.kill();
      st.kill();
      document.removeEventListener(LEAVE_EVENT, onLeave);
    };
  }, [id, index]);
  return (
    <section id={id} ref={section} data-label={label} data-index={index} className="slide trip" style={{ height: `${TRIP_VH * 100}vh` }}>
      <div className="sticky top-0 h-screen overflow-hidden">
        <div ref={wrap} className="absolute inset-0" style={{ opacity: 0, visibility: "hidden", transform: "translateY(150vh)", transformOrigin: "50% 60%" }}>
          <Stage tone={tone} style={stageStyle}>
            {children}
          </Stage>
        </div>
      </div>
    </section>
  );
}
