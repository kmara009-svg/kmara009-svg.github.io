"use client";
import { motion } from "framer-motion";
import { aerobic } from "@/lib/content";

/* Session profile, drawn to time: 10' warm-up ramp, 6 x (3' at RPE 7 : 90" at RPE 3), 10' cool-down. */
export default function IntervalChart() {
  const c = aerobic.chart;
  const W = 1000;
  const H = 400;
  const x0 = 130;
  const base = 300;
  const yHi = 60;
  const yLo = 200;
  const total = c.warmMin + c.reps * (c.workMin + c.restMin) + c.coolMin - c.restMin; // 47 min: last rest is omitted
  const px = (W - x0 - 10) / total;
  const warmW = c.warmMin * px;
  const workW = c.workMin * px;
  const restW = c.restMin * px;
  const intervalsStart = x0 + warmW;
  const intervalsW = c.reps * workW + (c.reps - 1) * restW;
  const coolStart = intervalsStart + intervalsW;
  const coolW = c.coolMin * px;
  const ease = [0.16, 1, 0.3, 1] as const;

  const bars: { x: number; w: number; y: number; fill: string; i: number }[] = [];
  for (let i = 0; i < c.reps; i++) {
    const x = intervalsStart + i * (workW + restW);
    bars.push({ x, w: workW - 4, y: yHi, fill: "#c8102e", i });
    if (i < c.reps - 1) bars.push({ x: x + workW, w: restW - 4, y: yLo, fill: "#9a9a97", i });
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={c.alt} style={{ overflow: "visible" }}>
      {/* guide lines */}
      <line x1={x0} x2={W - 10} y1={yHi} y2={yHi} stroke="#9a9a97" strokeWidth={2} strokeDasharray="8 8" />
      <line x1={x0} x2={W - 10} y1={yLo} y2={yLo} stroke="#9a9a97" strokeWidth={2} strokeDasharray="8 8" />
      <text x={0} y={yHi + 10} fill="#c8102e" fontSize={30} fontWeight={800}>
        {c.hi}
      </text>
      <text x={0} y={yLo + 10} fill="#1b7f4c" fontSize={30} fontWeight={800}>
        {c.lo}
      </text>
      <line x1={x0} x2={W - 10} y1={base} y2={base} stroke="#1e1e1e" strokeWidth={3} />

      {/* warm-up ramp */}
      <motion.polygon
        points={`${x0},${base} ${x0 + warmW - 4},${yLo} ${x0 + warmW - 4},${base}`}
        fill="#1b7f4c"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ amount: 0.6 }}
        transition={{ duration: 0.6, ease }}
      />
      {/* intervals */}
      {bars.map((b, k) => (
        <motion.rect
          key={k}
          x={b.x}
          width={b.w}
          fill={b.fill}
          rx={4}
          initial={{ y: base, height: 0 }}
          whileInView={{ y: b.y, height: base - b.y }}
          viewport={{ amount: 0.6 }}
          transition={{ duration: 0.7, delay: 0.3 + k * 0.08, ease }}
        />
      ))}
      {/* cool-down ramp */}
      <motion.polygon
        points={`${coolStart},${yLo} ${coolStart + coolW},${base} ${coolStart},${base}`}
        fill="#1b7f4c"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ amount: 0.6 }}
        transition={{ duration: 0.6, delay: 1.3, ease }}
      />

      {/* captions */}
      <text x={x0 + warmW / 2} y={base + 44} textAnchor="middle" fill="#1b7f4c" fontSize={30} fontWeight={700}>
        {c.warm}
      </text>
      <text x={intervalsStart + intervalsW / 2} y={base + 44} textAnchor="middle" fill="#c8102e" fontSize={30} fontWeight={700}>
        {c.intervals}
      </text>
      <text x={coolStart + coolW / 2} y={base + 44} textAnchor="middle" fill="#1b7f4c" fontSize={30} fontWeight={700}>
        {c.cool}
      </text>
    </svg>
  );
}
