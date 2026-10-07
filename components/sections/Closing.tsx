"use client";
import { motion } from "framer-motion";
import { Slide } from "./Slide";
import { Box, Header } from "../ui/primitives";
import { closing, references } from "@/lib/content";

export function ClosingAsks() {
  return (
    <Slide id="closing" index={25} label="Fuel first. Load smart." tone="dark" stageStyle={{ background: "transparent" }}>
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

export function References() {
  return (
    <>
      {references.map((r, i) => (
        <Slide key={r.title} id={`references-${i + 1}`} index={20 + i} label={`References ${i + 1}/${references.length}`}>
          <Header eyebrow={r.eyebrow} title={r.title} />
          <Box x={96} y={300} w={1728}>
            <div className="corner-guard" style={{ height: 130 }} />
            {r.items.map((it, j) => (
              <motion.p
                key={j}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ amount: 0.3 }}
                transition={{ delay: 0.1 + j * 0.12, duration: 0.5 }}
                className="m-0"
                style={{ fontSize: 28, lineHeight: 1.3, marginBottom: 24, paddingLeft: 60, textIndent: -60, wordBreak: "break-word" }}
              >
                {it}
              </motion.p>
            ))}
            {r.note ? (
              <p className="m-0 text-mute" style={{ fontSize: 28, marginTop: 20 }}>
                {r.note}
              </p>
            ) : null}
          </Box>
        </Slide>
      ))}
    </>
  );
}

export function ClosingSections() {
  return (
    <>
      <References />
      <ClosingAsks />
    </>
  );
}
