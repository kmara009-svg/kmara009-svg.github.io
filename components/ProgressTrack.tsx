"use client";

/* Progress bar shaped like a straight of running track: red lanes, white lane lines,
   a lime fill for distance covered and a chequered finish at the far right. */
export default function ProgressTrack({ progress, current, total }: { progress: number; current: number; total: number }) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40" style={{ height: 22 }} aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(180deg, #b8442f 0 4px, rgba(255,255,255,0.85) 4px 5px, #b8442f 5px 9px, rgba(255,255,255,0.85) 9px 10px, #b8442f 10px 14px, rgba(255,255,255,0.85) 14px 15px, #b8442f 15px 22px)",
        }}
      />
      <div className="absolute left-0 top-0 h-full bg-lime" style={{ width: `${pct}%`, transition: "width 0.12s linear" }} />
      <div className="absolute top-0 h-full" style={{ left: `calc(${pct}% - 2px)`, width: 4, background: "#1e1e1e" }} />
      <div
        className="absolute right-0 top-0 h-full"
        style={{
          width: 24,
          background:
            "repeating-conic-gradient(#1e1e1e 0 25%, #f7f7f4 0 50%) 0 0 / 8px 8px",
        }}
      />
      <span className="sr-only">
        {current + 1} of {total}
      </span>
    </div>
  );
}
