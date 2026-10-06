"use client";
import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

/* ---------- 1920x1080 stage ---------- */
export function Stage({
  children,
  tone = "paper",
  className = "",
  style,
}: {
  children: ReactNode;
  tone?: "paper" | "dark";
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`stage ${tone} track-lines ${className}`} style={style}>
      {children}
    </div>
  );
}

/* Absolute box helper: everything on a slide is positioned in 1920x1080 px */
export function Box({
  x,
  y,
  w,
  h,
  children,
  className = "",
  style,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`absolute ${className}`} style={{ left: x, top: y, width: w, height: h, ...style }}>
      {children}
    </div>
  );
}

export const reveal = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { amount: 0.4 },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
};

export function Eyebrow({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <motion.div
      {...reveal}
      className={`inline-block px-6 py-2 font-bold uppercase tracking-wide ${dark ? "bg-lime text-ink" : "bg-lime text-ink"}`}
      style={{ fontSize: 28, lineHeight: "36px", clipPath: "polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)" }}
    >
      {children}
    </motion.div>
  );
}

export function Title({ children, size = 96, maxWidth = 1200, light }: { children: ReactNode; size?: number; maxWidth?: number; light?: boolean }) {
  return (
    <motion.h2
      {...reveal}
      transition={{ ...reveal.transition, delay: 0.08 }}
      className={`h-display ${light ? "text-paper" : "text-ink"}`}
      style={{ fontSize: size, maxWidth, margin: 0 }}
    >
      {children}
    </motion.h2>
  );
}

/* Standard slide header block at top-left: eyebrow at y=72, title at y=136 */
export function Header({ eyebrow, title, light, titleSize }: { eyebrow: string; title: string; light?: boolean; titleSize?: number }) {
  return (
    <>
      <Box x={96} y={72}>
        <Eyebrow>{eyebrow}</Eyebrow>
      </Box>
      <Box x={96} y={136} w={1200}>
        <Title light={light} size={titleSize}>{title}</Title>
      </Box>
    </>
  );
}

export function Cite({ children, light, y = 996 }: { children: ReactNode; light?: boolean; y?: number }) {
  return (
    <Box x={96} y={y} w={1700}>
      <div className={light ? "text-paper/70" : "text-mute"} style={{ fontSize: 28 }}>
        {children}
      </div>
    </Box>
  );
}

/* Angled photo panel for the bottom-right column (always below y=400, right of x=1320) */
export function PhotoPanel({
  src,
  alt,
  x = 1340,
  y = 440,
  w = 580,
  h = 640,
  objectPosition = "center",
}: {
  src: string;
  alt: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  objectPosition?: string;
}) {
  return (
    <Box x={x} y={y} w={w} h={h}>
      <motion.div
        initial={{ opacity: 0, x: 60 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ amount: 0.3 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative h-full w-full"
      >
        <div
          className="absolute lime-stripes"
          style={{ left: 0, top: 24, width: w - 20, height: h - 24, clipPath: "polygon(22% 0, 100% 0, 100% 100%, 0 100%)", opacity: 0.9 }}
        />
        <div className="absolute overflow-hidden" style={{ left: 40, top: 0, right: 0, bottom: 0, clipPath: "polygon(20% 0, 100% 0, 100% 100%, 0 100%)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="h-full w-full object-cover" style={{ objectPosition }} />
        </div>
      </motion.div>
    </Box>
  );
}

const ICONS: Record<string, ReactNode> = {
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  warn: (
    <>
      <path d="M12 3 2 20h20L12 3z" />
      <path d="M12 10v4M12 17.5v.5" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 13.5a6 6 0 0 1 4 6" />
    </>
  ),
  tick: <path d="m5 12 5 5 9-10" />,
  none: null,
};

export function Icon({ name, size = 32, className = "" }: { name: string; size?: number; className?: string }) {
  if (!ICONS[name]) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={`flex-none ${className}`} aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

export function Chip({ icon, children, accent, light }: { icon?: string; children: ReactNode; accent?: boolean; light?: boolean }) {
  const cls = accent ? "bg-lime text-ink" : light ? "bg-paper text-ink" : "bg-ink text-paper";
  return (
    <div className={`inline-flex items-center gap-4 rounded-full px-8 ${cls}`} style={{ fontSize: 30, fontWeight: 700, height: 68 }}>
      {icon ? <Icon name={icon} size={32} /> : null}
      <span>{children}</span>
    </div>
  );
}

/* Data table with 28px+ text. */
export function Table({
  head,
  rows,
  widths,
  rowH = 72,
  fontSize = 30,
  headTone = "ink",
  firstBold = true,
}: {
  head: string[];
  rows: ReactNode[][];
  widths: number[];
  rowH?: number;
  fontSize?: number;
  headTone?: "ink" | "lime";
  firstBold?: boolean;
}) {
  return (
    <motion.table
      {...reveal}
      className="border-collapse"
      style={{ width: widths.reduce((a, b) => a + b, 0), fontSize, tableLayout: "fixed" }}
    >
      <colgroup>
        {widths.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>
      <thead>
        <tr className={headTone === "ink" ? "bg-ink text-lime" : "bg-lime text-ink"} style={{ height: rowH }}>
          {head.map((h) => (
            <th key={h} className="px-6 text-left font-extrabold uppercase tracking-wide" style={{ fontSize: 28 }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <motion.tr
            key={i}
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ amount: 0.4 }}
            transition={{ duration: 0.45, delay: 0.1 + i * 0.07 }}
            className={i % 2 ? "bg-paper-2/70" : "bg-white/70"}
            style={{ height: rowH }}
          >
            {r.map((c, j) => (
              <td key={j} className={`px-6 align-middle ${j === 0 && firstBold ? "font-bold" : ""}`} style={{ borderBottom: "2px solid #e2e2dc" }}>
                {c}
              </td>
            ))}
          </motion.tr>
        ))}
      </tbody>
    </motion.table>
  );
}

export function Card({ children, tone = "paper", className = "", style, delay = 0 }: { children: ReactNode; tone?: "paper" | "ink" | "lime" | "white"; className?: string; style?: CSSProperties; delay?: number }) {
  const map = {
    paper: "bg-paper-2 text-ink",
    white: "bg-white text-ink border-2 border-paper-2",
    ink: "bg-ink text-paper",
    lime: "bg-lime text-ink",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ amount: 0.3 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      className={`${map[tone]} ${className}`}
      style={style}
    >
      {children}
    </motion.div>
  );
}
