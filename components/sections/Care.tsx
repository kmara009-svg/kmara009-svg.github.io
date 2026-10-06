"use client";
import { motion } from "framer-motion";
import { Slide } from "./Slide";
import { Box, Card, Chip, Cite, Header, Icon, Table, reveal } from "../ui/primitives";
import { dayOne, injuryReport, prevention, risk, startNow } from "@/lib/content";
import RiskBars from "../charts/RiskBars";

const TONE_TEXT: Record<string, string> = { green: "#1b7f4c", red: "#c8102e", teal: "#0f766e", amber: "#b45309" };

export function DayOne() {
  return (
    <Slide id="day-one" label="Day 1: my first response">
      <Header eyebrow={dayOne.eyebrow} title={dayOne.title} />
      {/* timeline connector */}
      <Box x={96} y={518} w={1728} h={6}>
        <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ amount: 0.5 }} transition={{ duration: 1.2, ease: "easeInOut" }} className="h-full origin-left bg-lime" />
      </Box>
      {dayOne.steps.map((s, i) => (
        <Box key={s.n} x={96 + i * 440} y={420} w={408} h={200}>
          <Card tone="ink" delay={0.25 * i} className="flex h-full flex-col justify-center px-6">
            <span className="h-display text-lime" style={{ fontSize: 56 }}>
              {s.n}
            </span>
            <span style={{ fontSize: 36, fontWeight: 800, marginTop: 6 }}>{s.name}</span>
            <span style={{ fontSize: 28, opacity: 0.85, marginTop: 4, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{s.detail}</span>
          </Card>
        </Box>
      ))}
      <Box x={96} y={660} w={480} h={300}>
        <motion.div {...reveal} className="h-full w-full overflow-hidden" style={{ clipPath: "polygon(0 0, 100% 0, 92% 100%, 0 100%)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/clinician.jpg" alt="Clinician reviewing results on a tablet" className="h-full w-full object-cover" />
        </motion.div>
      </Box>
      <Box x={608} y={660} w={592} h={300}>
        <Card tone="white" delay={0.5} className="flex h-full flex-col justify-center px-8">
          <div className="h-display text-risk-red" style={{ fontSize: 40 }}>
            {dayOne.stop.title}
          </div>
          <ul className="m-0 list-none p-0" style={{ fontSize: 30, marginTop: 10, lineHeight: 1.3 }}>
            {dayOne.stop.items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
        </Card>
      </Box>
      <Box x={1232} y={660} w={592} h={300}>
        <Card tone="white" delay={0.65} className="flex h-full flex-col justify-center px-8">
          <div className="font-extrabold uppercase tracking-wide" style={{ fontSize: 30, color: "#0f766e" }}>
            {dayOne.who.title}
          </div>
          <ul className="m-0 list-none p-0" style={{ fontSize: 30, marginTop: 10, lineHeight: 1.3 }}>
            {dayOne.who.items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
        </Card>
      </Box>
      <Cite>{dayOne.cite}</Cite>
    </Slide>
  );
}

export function InjuryReport() {
  return (
    <Slide id="injury-report" label="The injury report">
      <Header eyebrow={injuryReport.eyebrow} title={injuryReport.title} />
      <Box x={96} y={320} w={520} h={614}>
        <motion.div {...reveal} className="h-full w-full bg-white" style={{ boxShadow: "0 24px 60px rgba(30,30,30,0.18)", border: "2px solid #e2e2dc" }}>
          {/* Image placeholder: swap /public/images/injury-report.png for the final scan of the form. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={injuryReport.image} alt="Completed sports injury report form for Shantha, signed by Kyle Marambio" className="h-full w-full object-contain" />
        </motion.div>
      </Box>
      {injuryReport.rows.map((r, i) => (
        <Box key={r.label} x={700} y={440 + i * 82} w={1124} h={70}>
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ amount: 0.5 }} transition={{ delay: 0.15 + i * 0.1, duration: 0.5 }} className="flex h-full items-center gap-6">
            <div className="flex items-center justify-center bg-lime font-extrabold text-ink" style={{ width: 220, height: 60, fontSize: 30, clipPath: "polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)" }}>
              {r.label}
            </div>
            <div style={{ fontSize: 30 }}>{r.text}</div>
          </motion.div>
        </Box>
      ))}
      <Cite>{injuryReport.caption}</Cite>
    </Slide>
  );
}

export function StartNow() {
  return (
    <Slide id="start-now" label="Start now, avoid for now">
      <Header eyebrow={startNow.eyebrow} title={startNow.title} />
      {startNow.columns.map((c, i) => (
        <Box key={c.title} x={96 + i * 592} y={420} w={544} h={450}>
          <Card tone="white" delay={i * 0.15} className="flex h-full flex-col px-9 py-8">
            <div className="flex items-center gap-4 font-extrabold uppercase tracking-wide" style={{ fontSize: 32, color: TONE_TEXT[c.tone] }}>
              <Icon name={c.icon} size={38} />
              {c.title}
            </div>
            <ul className="m-0 list-none p-0" style={{ fontSize: 32, marginTop: 20 }}>
              {c.items.map((it, j) => (
                <motion.li key={it} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ amount: 0.5 }} transition={{ delay: 0.3 + i * 0.15 + j * 0.08 }} style={{ lineHeight: "60px", borderBottom: j < c.items.length - 1 ? "2px solid #ecece6" : "none" }}>
                  {it}
                </motion.li>
              ))}
            </ul>
          </Card>
        </Box>
      ))}
      <Cite>{startNow.cite}</Cite>
    </Slide>
  );
}

export function Risk() {
  return (
    <Slide id="risk" label="Risk stacks up">
      <Header eyebrow={risk.eyebrow} title={risk.title} />
      <Box x={96} y={320} w={1224}>
        <motion.div {...reveal} className="font-bold" style={{ fontSize: 32 }}>
          {risk.chartTitle}
        </motion.div>
      </Box>
      <Box x={96} y={380} w={1224}>
        <RiskBars bars={risk.bars} />
      </Box>
      <Box x={96} y={850}>
        <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.9 }}>
          <Chip accent>
            <span style={{ fontWeight: 500 }}>{risk.strip.text}</span>
            <strong>{risk.strip.strong}</strong>
          </Chip>
        </motion.div>
      </Box>
      <Box x={1340} y={440} w={484} h={540}>
        <Card tone="ink" delay={0.3} className="flex h-full flex-col px-9 py-8">
          <div className="font-extrabold uppercase tracking-wide text-lime" style={{ fontSize: 30 }}>
            {risk.stack.title}
          </div>
          <ul className="m-0 list-none p-0" style={{ fontSize: 30, marginTop: 14 }}>
            {risk.stack.items.map((it, j) => (
              <motion.li key={it} initial={{ opacity: 0, x: 12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ amount: 0.5 }} transition={{ delay: 0.5 + j * 0.12 }} className="flex items-center gap-4" style={{ height: 66 }}>
                <Icon name="tick" size={30} className="text-lime" />
                {it}
              </motion.li>
            ))}
          </ul>
        </Card>
      </Box>
      <Cite>{risk.cite}</Cite>
    </Slide>
  );
}

export function Prevention() {
  return (
    <Slide id="prevention" label="Removing the risks">
      <Header eyebrow={prevention.eyebrow} title={prevention.title} />
      <Box x={96} y={420}>
        <Table head={prevention.head} rows={prevention.rows} widths={[420, 860, 448]} rowH={76} />
      </Box>
      <Cite>{prevention.cite}</Cite>
    </Slide>
  );
}

export function CareSections() {
  return (
    <>
      <DayOne />
      <InjuryReport />
      <StartNow />
      <Risk />
      <Prevention />
    </>
  );
}
