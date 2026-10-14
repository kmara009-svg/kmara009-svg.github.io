"use client";
import { useEffect, useRef } from "react";
import { deck, STOPS } from "@/lib/deck";

/* The proximal femur in coronal section, as in a textbook osteoporosis illustration: a cream
   cortical shell around orange trabecular bone. Porosity 0 = finely stippled, thick cortex;
   1 = pores grown and merged into large holes, thin cortex. Drawn on a 2D canvas and animated
   by the story beats: bone loss opens the holes, rebuild fills them back in. */

// outline in bone units, y up (head to the left, greater trochanter to the right, shaft down)
const MIN_X = -5.4, MAX_X = 2.8, MIN_Y = -4.7, MAX_Y = 5.45;
export const BONE_W = 900;
export const BONE_H = Math.round(((MAX_Y - MIN_Y) / (MAX_X - MIN_X)) * BONE_W);
const K = BONE_W / (MAX_X - MIN_X);
const px = (x: number) => (x - MIN_X) * K;
const py = (y: number) => (MAX_Y - y) * K;

function outline() {
  const p = new Path2D();
  p.moveTo(px(2.3), py(-4.6)); // lateral shaft, bottom
  p.lineTo(px(2.35), py(-0.6));
  p.bezierCurveTo(px(2.4), py(0.6), px(2.7), py(1.6), px(2.5), py(2.4)); // lateral flare to the greater trochanter
  p.bezierCurveTo(px(2.4), py(2.9), px(2.1), py(3.25), px(1.6), py(3.3)); // trochanter tip
  p.bezierCurveTo(px(1.1), py(3.35), px(0.7), py(3.0), px(0.4), py(2.75)); // trochanteric fossa
  p.bezierCurveTo(px(-0.5), py(3.1), px(-1.3), py(3.9), px(-2.03), py(4.6)); // superior neck up to the head
  // the head: y-up anticlockwise from 0.2π to 1.8π becomes canvas angles -0.2π → -1.8π, anticlockwise
  p.arc(px(-3.5), py(3.55), 1.8 * K, -Math.PI * 0.2, -Math.PI * 1.8, true);
  p.bezierCurveTo(px(-1.5), py(1.5), px(-1.0), py(0.9), px(-0.95), py(0.2)); // inferior neck
  p.bezierCurveTo(px(-0.95), py(-0.2), px(-1.25), py(-0.5), px(-1.15), py(-0.9)); // lesser trochanter
  p.bezierCurveTo(px(-1.0), py(-1.3), px(-0.9), py(-1.6), px(-0.9), py(-2.0)); // medial shaft
  p.lineTo(px(-0.9), py(-4.6));
  p.closePath();
  return p;
}

function makeBone(canvas: HTMLCanvasElement) {
  canvas.width = BONE_W;
  canvas.height = BONE_H;
  const g = canvas.getContext("2d")!;
  const path = outline();
  // base: warm trabecular gradient with fine lighter grain, drawn once
  const base = document.createElement("canvas");
  base.width = BONE_W;
  base.height = BONE_H;
  const b = base.getContext("2d")!;
  const grad = b.createLinearGradient(0, 0, BONE_W, BONE_H);
  grad.addColorStop(0, "#f3bd68");
  grad.addColorStop(0.5, "#e59a3f");
  grad.addColorStop(1, "#cf7e2b");
  b.fillStyle = grad;
  b.fillRect(0, 0, BONE_W, BONE_H);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 9000; i++) {
    b.fillStyle = `rgba(255, 236, 200, ${0.08 + rnd() * 0.18})`;
    b.beginPath();
    b.arc(rnd() * BONE_W, rnd() * BONE_H, 0.8 + rnd() * 2.2, 0, Math.PI * 2);
    b.fill();
  }
  // pores: random points inside the outline; a few seeds grow into the big holes of osteoporotic bone
  type Pore = { x: number; y: number; r0: number; g: number };
  const pores: Pore[] = [];
  while (pores.length < 1400) {
    const x = rnd() * BONE_W, y = rnd() * BONE_H;
    if (!g.isPointInPath(path, x, y)) continue;
    const big = rnd() < 0.12;
    pores.push({ x, y, r0: 1.4 + rnd() * 1.8, g: big ? 0.8 + rnd() * 0.5 : 0.08 + rnd() * 0.17 });
  }
  const draw = (por: number) => {
    g.clearRect(0, 0, BONE_W, BONE_H);
    // soft drop shadow so the section sits off the background
    g.save();
    g.shadowColor = "rgba(0, 0, 0, 0.55)";
    g.shadowBlur = 40;
    g.shadowOffsetY = 18;
    g.fillStyle = "#e6d7bb";
    g.fill(path);
    g.restore();
    g.save();
    g.clip(path);
    g.drawImage(base, 0, 0);
    const grow = Math.pow(por, 1.25);
    for (const p of pores) {
      const r = p.r0 + 19 * grow * p.g;
      g.fillStyle = r > 9 ? "#4a2a12" : "#5a3418";
      g.beginPath();
      g.arc(p.x, p.y, r, 0, Math.PI * 2);
      g.fill();
      if (r > 12) {
        g.strokeStyle = "rgba(255, 205, 150, 0.28)";
        g.lineWidth = 1.5;
        g.stroke();
      }
    }
    // cortical shell: a band inside the outline that thins as bone is lost
    g.lineWidth = (0.46 - 0.3 * por) * K * 2;
    g.strokeStyle = "#ede0c8";
    g.lineJoin = "round";
    g.stroke(path);
    if (por > 0.35) {
      g.fillStyle = "rgba(90, 52, 24, 0.9)";
      for (let i = 0; i < pores.length; i += 9) {
        const p = pores[i];
        g.beginPath();
        g.arc(p.x, p.y, 1.2 + 3.5 * (por - 0.35), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.lineWidth = 6;
    g.strokeStyle = "rgba(120, 90, 60, 0.35)";
    g.stroke(path);
    g.restore();
  };
  return draw;
}

const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

export default function BoneSection({ style }: { style?: React.CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const draw = makeBone(ref.current);
    let por = STOPS[deck.index]?.beat === "bone-loss" ? 1 : 0;
    draw(por);
    let raf = 0;
    const tweenTo = (target: number, seconds: number) => {
      cancelAnimationFrame(raf);
      const from = por, t0 = performance.now(), ms = seconds * 1000;
      const step = () => {
        const u = Math.min(1, (performance.now() - t0) / ms);
        por = from + (target - from) * ease(u);
        draw(por);
        if (u < 1) raf = requestAnimationFrame(step);
      };
      step();
    };
    const off = deck.onReveal((i, instant) => {
      const beat = STOPS[i]?.beat;
      if (beat === "bone-normal") tweenTo(0, instant ? 0.3 : 0.6);
      else if (beat === "bone-loss") tweenTo(1, instant ? 0.3 : 2.8);
      else if (beat === "rebuild") tweenTo(0, instant ? 0.3 : 3.2);
    });
    return () => {
      cancelAnimationFrame(raf);
      off();
    };
  }, []);
  return <canvas ref={ref} aria-label="Cross-section of the upper femur showing cortical and trabecular bone" style={{ display: "block", ...style }} />;
}
