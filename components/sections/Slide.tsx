"use client";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import gsap from "gsap";
import { Stage } from "../ui/primitives";
import { LEAVE_S, REVEAL_S, deck, registerSlideLabel, stopOfSlide } from "@/lib/deck";

/* One slide of the deck. Every slide stays mounted but parked off screen (so revealing one never
   stalls a frame, and its in-view entrance animations replay each time it is shown). The deck
   reveals it as its arrival footage ends and dismisses it the moment the presenter moves on.
   `index` is the 1-based slide number. */
export function Slide({ id, label, index, tone = "paper", stageStyle, children }: { id: string; label: string; index: number; tone?: "paper" | "dark"; stageStyle?: CSSProperties; children: ReactNode }) {
  registerSlideLabel(index, label);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const w = wrap.current;
    if (!w) return;
    const me = stopOfSlide(index);
    let tween: gsap.core.Tween | undefined;
    let shown = false;
    const park = () => {
      w.style.visibility = "hidden";
      w.style.transform = "translate3d(0, 150vh, 0)";
      w.style.opacity = "0";
      w.style.pointerEvents = "none";
      w.style.willChange = "auto";
    };
    const show = (fast: boolean) => {
      if (shown) return;
      shown = true;
      tween?.kill();
      const o = { t: 0 };
      w.style.willChange = "opacity, transform"; // composited while it fades
      w.style.visibility = "visible";
      const apply = () => {
        w.style.opacity = String(o.t);
        w.style.transform = `translate3d(0, ${(1 - o.t) * 36}px, 0) scale(${0.98 + 0.02 * o.t})`;
      };
      apply();
      tween = gsap.to(o, {
        t: 1,
        duration: fast ? 0.22 : REVEAL_S,
        ease: "power2.out",
        onUpdate: apply,
        onComplete: () => {
          w.style.pointerEvents = "auto";
          w.style.willChange = "auto";
        },
      });
    };
    const hide = (fast: boolean) => {
      if (!shown) return;
      shown = false;
      tween?.kill();
      const o = { t: 1 };
      w.style.pointerEvents = "none";
      w.style.willChange = "opacity, transform";
      tween = gsap.to(o, {
        t: 0,
        duration: fast ? 0.18 : LEAVE_S,
        ease: "power1.in",
        onUpdate: () => {
          w.style.opacity = String(o.t);
          w.style.transform = `translate3d(0, ${-28 * (1 - o.t)}px, 0) scale(${1 - 0.02 * (1 - o.t)})`;
        },
        onComplete: park,
      });
    };
    park();
    if (deck.index === me && !deck.move) show(true);
    const offMove = deck.subscribe((m) => {
      if (m.from === me || (shown && m.to !== me)) hide(m.instant);
    });
    const offReveal = deck.onReveal((i, instant) => {
      if (i === me) show(instant);
    });
    return () => {
      tween?.kill();
      offMove();
      offReveal();
    };
  }, [index]);
  return (
    <section id={id} data-label={label} data-index={index} className="deck-slide">
      <div ref={wrap} className="absolute inset-0" style={{ opacity: 0, visibility: "hidden", transform: "translate3d(0, 150vh, 0)", transformOrigin: "50% 60%" }}>
        <Stage tone={tone} style={stageStyle}>
          {children}
        </Stage>
      </div>
    </section>
  );
}
