"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { deck, STOPS, type Beat } from "@/lib/deck";
import { hero, skeleton } from "@/lib/content";
import { XRAY_HIP, XRAY_LIMB, type Radiograph } from "@/lib/xray";
import { Box } from "../ui/primitives";
import BoneSection, { BONE_H, BONE_W } from "./BoneSection";

/* The opening story drawn over the footage: the hero titles, the real radiographs with the
   high- and lower-risk bones marked, and the femur cross-section losing and regaining bone.
   Backgrounds switch when a move starts (or when its footage ends); text and images appear
   when the deck reveals the stop. */

const XRAY_BEATS: Beat[] = ["xray-hip", "xray-limb"];
const BONE_BEATS: Beat[] = ["bone-normal", "bone-loss", "rebuild"];

function fade(on: boolean, seconds: number, delay = 0): CSSProperties {
  return {
    opacity: on ? 1 : 0,
    visibility: on ? "visible" : "hidden",
    transition: on
      ? `opacity ${seconds}s ease ${delay}s, visibility 0s linear ${delay}s`
      : `opacity ${Math.min(seconds, 0.28)}s ease, visibility 0s linear ${Math.min(seconds, 0.28)}s`,
  };
}

/* the film's edges dissolve into the dark instead of ending in a hard rectangle */
const FILM_EDGE = "linear-gradient(to right, transparent, #000 11%, #000 89%, transparent), linear-gradient(to bottom, transparent, #000 13%, #000 87%, transparent)";
const FILM: CSSProperties = {
  WebkitMaskImage: FILM_EDGE,
  maskImage: FILM_EDGE,
  WebkitMaskComposite: "source-in",
  maskComposite: "intersect",
  filter: "sepia(0.28) hue-rotate(172deg) saturate(1.5) brightness(1.04) drop-shadow(0 0 36px rgba(110, 170, 255, 0.22))",
};
const LABEL_W = 440;

function Radiographs({ items, on, t }: { items: Radiograph[]; on: boolean; t: number }) {
  return (
    <div style={fade(on, t)}>
      {items.map((r) => (
        <div key={r.src}>
          <Box x={r.x} y={r.y} w={r.w} h={r.h}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.src} alt={r.alt} decoding="async" className="h-full w-full object-contain" style={FILM} />
          </Box>
          {r.markers.map((m, i) => {
            const mx = r.x + m.fx * r.w, my = r.y + m.fy * r.h;
            const left = m.align === "left";
            return (
              <div key={m.id}>
                <svg className="pointer-events-none absolute left-0 top-0" width={1920} height={1080} style={{ overflow: "visible" }}>
                  <line x1={mx} y1={my} x2={m.lx + (left ? -12 : 12)} y2={m.ly} stroke="#c6f432" strokeWidth={2} strokeOpacity={0.8} />
                </svg>
                <div className="xray-ring" style={{ left: mx - 34, top: my - 34, animationDelay: `${i * 0.4}s` }} />
                <Box x={left ? m.lx : m.lx - LABEL_W} y={m.ly - 17} w={LABEL_W}>
                  <div className="xray-label" style={{ flexDirection: left ? "row" : "row-reverse", textAlign: left ? "left" : "right" }}>
                    <span className="dot" />
                    <span className="flex flex-col" style={{ gap: 6 }}>
                      <span className="name">{m.name}</span>
                      <span className="type">{m.type}</span>
                    </span>
                  </div>
                </Box>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function StoryLayer() {
  const initial = STOPS[deck.index]?.beat ?? null;
  const [fg, setFg] = useState<Beat | null>(initial);
  const [bg, setBg] = useState<Beat | null>(initial);
  const [fast, setFast] = useState(false);
  useEffect(() => {
    const offMove = deck.subscribe((m) => {
      setFast(m.instant);
      setFg(null);
      // footage plays in the open; otherwise the next background is in place at once
      setBg(m.clip ? null : STOPS[m.to].beat ?? null);
    });
    const offReveal = deck.onReveal((i, instant) => {
      const b = STOPS[i].beat ?? null;
      setFast(instant);
      setFg(b);
      setBg(b);
    });
    return () => {
      offMove();
      offReveal();
    };
  }, []);

  const t = fast ? 0.2 : 0.45;
  const boneW = 600;
  const boneH = Math.round((boneW * BONE_H) / BONE_W);
  const chips = ["Low energy", "Low oestrogen", "Bone loss"];
  const words = ["REFUEL.", "REBUILD.", "RETURN."];
  const boneTag = fg === "bone-loss" ? "Bone loss" : fg === "rebuild" ? "Rebuilding bone" : "Normal bone";

  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden" aria-live="polite">
      {/* backgrounds */}
      <div className="absolute inset-0" style={{ ...fade(fg === "hero", t), background: "linear-gradient(90deg, rgba(20,20,22,0.86) 0%, rgba(20,20,22,0.66) 34%, rgba(20,20,22,0.2) 58%, rgba(20,20,22,0) 74%)" }} />
      <div className="absolute inset-0" style={{ ...fade(!!bg && XRAY_BEATS.includes(bg), fast ? 0.2 : 0.9), background: "radial-gradient(ellipse at 50% 55%, rgba(6,14,30,0.7) 0%, rgba(3,7,16,0.9) 60%, rgba(2,4,10,0.96) 100%)" }} />
      <div className="absolute inset-0" style={{ ...fade(!!bg && BONE_BEATS.includes(bg), t), background: "radial-gradient(ellipse at 52% 50%, #2a2622 0%, #161515 55%, #0e0e0f 100%)" }} />

      <div className="stage" style={{ background: "transparent" }}>
        {/* HERO */}
        <div style={fade(fg === "hero", t)}>
          <Box x={96} y={120}>
            <div className="inline-block bg-lime px-6 py-2 font-bold uppercase tracking-wide text-ink" style={{ fontSize: 28, lineHeight: "36px", clipPath: "polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)" }}>
              {hero.eyebrow}
            </div>
          </Box>
          <Box x={96} y={200} w={1200}>
            <h1 className="h-display m-0 text-paper" style={{ fontSize: 176 }}>
              {hero.lines.map((l, i) => (
                <span key={l} className={`block ${i === 2 ? "text-lime" : ""}`}>
                  {l}
                </span>
              ))}
            </h1>
          </Box>
          <Box x={96} y={720} w={1100}>
            <p className="m-0 text-paper" style={{ fontSize: 44, fontWeight: 500 }}>
              {hero.subtitle}
            </p>
          </Box>
          <Box x={96} y={820}>
            <div className="inline-flex flex-col bg-paper px-8 py-5 text-ink" style={{ clipPath: "polygon(0 0, 100% 0, calc(100% - 18px) 100%, 0 100%)" }}>
              <span style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.15 }}>{hero.presenter}</span>
              <span style={{ fontSize: 28, fontWeight: 500 }}>{hero.role}</span>
            </div>
          </Box>
          <div className="chrome">
            <Box x={96} y={990}>
              <div className="flex items-center gap-4 text-paper/70" style={{ fontSize: 28 }}>
                <span>Press</span>
                <span className="inline-block h-[2px] w-16 bg-lime" />
                <span>→ or space to begin</span>
              </div>
            </Box>
          </div>
        </div>

        {/* X-RAY */}
        <div style={fade(!!fg && XRAY_BEATS.includes(fg), t)}>
          <Box x={96} y={110}>
            <div className="inline-block bg-lime px-6 py-2 font-bold uppercase tracking-wide text-ink" style={{ fontSize: 28, lineHeight: "36px" }}>
              {skeleton.eyebrow}
            </div>
          </Box>
          <Box x={96} y={176} w={1180}>
            <div className="h-display text-paper" style={{ fontSize: 72 }}>
              {skeleton.title}
            </div>
          </Box>
        </div>
        <div style={fade(fg === "xray-hip", t)}>
          <Box x={96} y={300} w={460}>
            <div className="font-black uppercase" style={{ fontSize: 44, color: "#ff5a6e", lineHeight: 1 }}>
              {skeleton.cards[0].level}
            </div>
            <div className="text-paper" style={{ fontSize: 30, marginTop: 14, lineHeight: 1.25 }}>
              {skeleton.cards[0].text}
            </div>
          </Box>
        </div>
        <Radiographs items={XRAY_HIP} on={fg === "xray-hip"} t={fast ? 0.2 : 0.9} />
        <div style={fade(fg === "xray-limb", t)}>
          <Box x={96} y={300} w={460}>
            <div className="font-black uppercase" style={{ fontSize: 44, color: "#7be0a0", lineHeight: 1 }}>
              {skeleton.cards[1].level}
            </div>
            <div className="text-paper" style={{ fontSize: 30, marginTop: 14, lineHeight: 1.25 }}>
              {skeleton.cards[1].text}
            </div>
          </Box>
        </div>
        <Radiographs items={XRAY_LIMB} on={fg === "xray-limb"} t={t} />

        {/* BONE */}
        <div style={fade(!!bg && BONE_BEATS.includes(bg), t)}>
          <Box x={690} y={170} w={boneW} h={boneH}>
            <BoneSection style={{ width: boneW, height: boneH }} />
          </Box>
        </div>
        <div style={fade(!!fg && BONE_BEATS.includes(fg), t)}>
          <Box x={96} y={150}>
            <div className="font-bold uppercase tracking-wide text-lime" style={{ fontSize: 30 }}>
              Inside the femur · bone in cross-section
            </div>
          </Box>
          <Box x={96} y={208}>
            <div
              className={`inline-block px-5 py-2 font-extrabold uppercase ${fg === "bone-loss" ? "bg-risk-red text-paper" : "bg-paper text-ink"}`}
              style={{ fontSize: 28, clipPath: "polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)", transition: "background-color 0.4s ease 1.2s, color 0.4s ease 1.2s" }}
            >
              {boneTag}
            </div>
          </Box>
          <Box x={1340} y={620} w={480}>
            <div className="flex flex-col gap-6 text-paper" style={{ fontSize: 28, lineHeight: 1.2 }}>
              <div className="flex items-start gap-4">
                <span className="mt-1 inline-block h-7 w-7 flex-none rounded-sm" style={{ background: "#ede0c8" }} />
                <span>
                  <b>Cortical bone</b>
                  <br />
                  the dense outer shell
                </span>
              </div>
              <div className="flex items-start gap-4">
                <span className="mt-1 inline-block h-7 w-7 flex-none rounded-sm" style={{ background: "#e59a3f" }} />
                <span>
                  <b>Trabecular bone</b>
                  <br />
                  the spongy interior, lost first
                </span>
              </div>
            </div>
          </Box>
        </div>
        {chips.map((c, i) => (
          <div key={c} style={fade(fg === "bone-loss", t, fast ? 0 : 0.3 + i * 0.85)}>
            <Box x={96} y={330 + i * 150}>
              <div className={`${i === 2 ? "bg-risk-red text-paper" : "bg-paper text-ink"} px-7 py-4 font-extrabold uppercase`} style={{ fontSize: 34, clipPath: "polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)" }}>
                {c}
              </div>
              {i < 2 ? (
                <div className="text-lime" style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, marginTop: 10, marginLeft: 24 }}>
                  ↓
                </div>
              ) : null}
            </Box>
          </div>
        ))}
        {words.map((w, i) => (
          <div key={w} style={fade(fg === "rebuild", t, fast ? 0 : 0.2 + i * 1.0)}>
            <Box x={96} y={320 + i * 150}>
              <div className={`h-display ${i === 2 ? "text-lime" : "text-paper"}`} style={{ fontSize: 120 }}>
                {w}
              </div>
            </Box>
          </div>
        ))}
      </div>
    </div>
  );
}
