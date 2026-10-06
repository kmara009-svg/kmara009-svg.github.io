"use client";
import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";

export function useCountUp(to: number, opts: { decimals?: number; duration?: number } = {}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { amount: 0.6 });
  const [val, setVal] = useState(0);
  const { decimals = 0, duration = 1.4 } = opts;
  useEffect(() => {
    if (!inView) {
      setVal(0);
      return;
    }
    const controls = animate(0, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setVal(v),
    });
    return () => controls.stop();
  }, [inView, to, duration]);
  return { ref, text: val.toFixed(decimals) };
}
