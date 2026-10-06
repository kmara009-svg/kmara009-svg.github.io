"use client";
import type { ReactNode } from "react";
import { Stage } from "../ui/primitives";

export function Slide({ id, label, tone = "paper", children }: { id: string; label: string; tone?: "paper" | "dark"; children: ReactNode }) {
  return (
    <section id={id} data-label={label} className="slide">
      <Stage tone={tone}>{children}</Stage>
    </section>
  );
}
