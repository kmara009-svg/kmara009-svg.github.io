"use client";
import { motion } from "framer-motion";
import { useCountUp } from "@/lib/useCountUp";

function Value({ v }: { v: number }) {
  const { ref, text } = useCountUp(v, { decimals: 1, duration: 1.3 });
  return (
    <span ref={ref} className="font-extrabold tabular-nums" style={{ fontSize: 34 }}>
      {text}%
    </span>
  );
}

/* Single-hue sequential bars (charcoal steps); the final, highest bar is lime.
   Every bar is direct-labelled, so colour never carries the value alone. */
export default function RiskBars({ bars }: { bars: { label: string; value: number }[] }) {
  const max = 50;
  const fills = ["#9a9a97", "#5e5e5c", "#2c2c2c", "#c6f432"];
  return (
    <div className="flex flex-col" style={{ gap: 18 }}>
      {bars.map((b, i) => (
        <div key={b.label} className="flex items-center" style={{ height: 92 }}>
          <div className="pr-6" style={{ width: 540, fontSize: 30, fontWeight: 600, lineHeight: 1.15 }}>
            {b.label}
          </div>
          <div className="relative flex items-center" style={{ width: 560, height: 92 }}>
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ amount: 0.6 }}
              transition={{ duration: 1.2, delay: 0.15 * i, ease: [0.16, 1, 0.3, 1] }}
              className="h-14 origin-left"
              style={{ width: `${(b.value / max) * 100}%`, background: fills[i], borderRadius: "0 6px 6px 0" }}
            />
            <div className="pl-5">
              <Value v={b.value} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
