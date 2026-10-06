"use client";
import { motion } from "framer-motion";

const TONES: Record<string, { bg: string; fg: string }> = {
  red: { bg: "#c8102e", fg: "#ffffff" },
  amber: { bg: "#f2b705", fg: "#1e1e1e" },
  green: { bg: "#1b7f4c", fg: "#ffffff" },
};

export default function ZoneBar({ zones, marker }: { zones: { label: string; tone: string }[]; marker: string }) {
  const widths = [0.32, 0.34, 0.34];
  return (
    <div style={{ width: 1224 }}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.6 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="font-bold text-risk-red"
        style={{ fontSize: 32, marginBottom: 12, paddingLeft: 24 }}
      >
        {marker}
      </motion.div>
      <div className="flex" style={{ height: 96, gap: 4 }}>
        {zones.map((z, i) => (
          <motion.div
            key={z.label}
            initial={{ scaleX: 0, opacity: 0 }}
            whileInView={{ scaleX: 1, opacity: 1 }}
            viewport={{ amount: 0.6 }}
            transition={{ duration: 0.7, delay: 0.2 + i * 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex origin-left items-center justify-center font-bold"
            style={{ width: `${widths[i] * 100}%`, background: TONES[z.tone].bg, color: TONES[z.tone].fg, fontSize: 32, borderRadius: i === 0 ? "10px 0 0 10px" : i === 2 ? "0 10px 10px 0" : 0 }}
          >
            {z.label}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
