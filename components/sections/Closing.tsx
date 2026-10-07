"use client";
import { motion } from "framer-motion";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Slide } from "./Slide";
import { Box, Header } from "../ui/primitives";
import { closing, references } from "@/lib/content";
import { FINISH_INDEX, SLIDE_COUNT } from "@/lib/scene";

export function ClosingAsks() {
  return (
    <Slide id="closing" index={FINISH_INDEX} label="Fuel first. Load smart." tone="dark" stageStyle={{ background: "transparent" }}>
      {/* the finish line: the live 3D scene stays visible behind a dark gradient */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(20,20,22,0.9) 0%, rgba(20,20,22,0.72) 48%, rgba(20,20,22,0.12) 72%, rgba(20,20,22,0) 100%)" }} />
      <div className="absolute lime-stripes" style={{ left: 0, top: 0, width: 36, height: 1080, opacity: 0.9 }} />
      {closing.lines.map((l, i) => (
        <Box key={l} x={96} y={330 + i * 130} w={1728}>
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ amount: 0.5 }}
            transition={{ duration: 0.7, delay: i * 0.35, ease: [0.16, 1, 0.3, 1] }}
            className={`h-display ${i === 2 ? "text-lime" : "text-paper"}`}
            style={{ fontSize: 104, whiteSpace: "nowrap" }}
          >
            {l}
          </motion.div>
        </Box>
      ))}
      <Box x={96} y={760}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ amount: 0.5 }} transition={{ delay: 1.2, duration: 0.6 }} className="inline-block bg-lime px-8 py-4 font-bold text-ink" style={{ fontSize: 32, clipPath: "polygon(0 0, 100% 0, calc(100% - 16px) 100%, 0 100%)" }}>
          {closing.chip}
        </motion.div>
      </Box>
    </Slide>
  );
}

/* Every reference on one slide after the finish line. Three columns (the third starts below the
   webcam zone); the text size is the largest, down from 28 px, at which all of them fit. */
const COLS = [
  { x: 96, y: 250, w: 544, h: 800 },
  { x: 672, y: 250, w: 544, h: 800 },
  { x: 1280, y: 430, w: 544, h: 620 },
];
const ITEMS = references.flatMap((r) => r.items);
const NOTE = references.map((r) => r.note).find(Boolean);
const refStyle = (size: number): CSSProperties => ({ fontSize: size, lineHeight: 1.22, marginBottom: Math.round(size * 0.55), paddingLeft: 36, textIndent: -36, wordBreak: "break-word" });

export function References() {
  const measure = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ size: number; col: number[] }>({ size: 28, col: ITEMS.map(() => 0) });
  useLayoutEffect(() => {
    const fit = () => {
      const m = measure.current;
      if (!m) return;
      for (let size = 28; size >= 14; size -= 1) {
        m.style.fontSize = `${size}px`;
        const gap = Math.round(size * 0.55);
        const hs = Array.from(m.children).map((c) => (c as HTMLElement).offsetHeight + gap);
        const col: number[] = [];
        let c = 0, used = 0, ok = true;
        for (const h of hs) {
          if (used + h > COLS[c].h) {
            c++;
            used = 0;
            if (c >= COLS.length) {
              ok = false;
              break;
            }
          }
          col.push(c);
          used += h;
        }
        if (ok) {
          setLayout({ size, col });
          return;
        }
      }
    };
    fit();
    document.fonts?.ready.then(fit);
  }, []);
  return (
    <>
      {/* hidden measuring copy at column width, outside the scaled stage */}
      <div ref={measure} aria-hidden className="absolute" style={{ left: -9999, top: 0, width: COLS[0].w, visibility: "hidden", fontSize: 28 }}>
        {ITEMS.map((it, j) => (
          <p key={j} className="m-0" style={{ ...refStyle(28), fontSize: "inherit", marginBottom: 0 }}>
            {it}
          </p>
        ))}
      </div>
      <Slide id="references" index={SLIDE_COUNT} label="References">
        <Header eyebrow="APA 7th" title="REFERENCES" />
        {COLS.map((cfg, c) => (
          <Box key={c} x={cfg.x} y={cfg.y} w={cfg.w} h={cfg.h} style={{ overflow: "hidden" }}>
            {ITEMS.map((it, j) =>
              layout.col[j] === c ? (
                <motion.p
                  key={j}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ amount: 0.2 }}
                  transition={{ delay: 0.08 + j * 0.05, duration: 0.45 }}
                  className="m-0"
                  style={refStyle(layout.size)}
                >
                  {it}
                </motion.p>
              ) : null
            )}
          </Box>
        ))}
        {NOTE ? (
          <Box x={96} y={1040} w={1100}>
            <p className="m-0 text-mute" style={{ fontSize: Math.max(layout.size, 18) }}>
              {NOTE}
            </p>
          </Box>
        ) : null}
      </Slide>
    </>
  );
}

export function ClosingSections() {
  return (
    <>
      <ClosingAsks />
      <References />
    </>
  );
}
