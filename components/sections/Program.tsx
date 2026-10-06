"use client";
import { motion } from "framer-motion";
import { Slide } from "./Slide";
import { Box, Card, Chip, Cite, Header, Icon, PhotoPanel, Table, reveal } from "../ui/primitives";
import { aerobic, decisions, evidence, monitoring, needs, phases, returnToSport, session } from "@/lib/content";
import IntervalChart from "../charts/IntervalChart";

const TONE_TEXT: Record<string, string> = { green: "#1b7f4c", red: "#c8102e", amber: "#b45309" };

function Demand({ n }: { n: number }) {
  return (
    <span className="inline-flex" style={{ gap: 6 }} aria-label={`${n} of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className="inline-block" style={{ width: 24, height: 24, borderRadius: 4, background: i < n ? "#1e1e1e" : "#d6d6d0" }} />
      ))}
    </span>
  );
}

export function Needs() {
  const rows = needs.rows.map((r) => [r.quality, <Demand key="d" n={r.demand} />, <span key="l" className="text-mute">{r.level}</span>, r.target]);
  return (
    <Slide id="needs" label="What she must rebuild">
      <Header eyebrow={needs.eyebrow} title={needs.title} />
      <Box x={96} y={320}>
        <Table head={needs.head} rows={rows} widths={[364, 190, 180, 490]} rowH={68} fontSize={28} />
      </Box>
      {needs.context.map((c, i) => (
        <Box key={c.label} x={96 + (i % 2) * 624} y={830 + Math.floor(i / 2) * 80} w={600} h={64}>
          <Card tone="lime" delay={0.6 + i * 0.1} className="flex h-full items-center px-6" style={{ fontSize: 28 }}>
            <strong className="mr-3">{c.label}</strong>
            {c.text}
          </Card>
        </Box>
      ))}
      <Cite y={1004}>{needs.cite}</Cite>
      <PhotoPanel src="/images/track-legs.jpg" alt="Runners' legs on a red track" />
    </Slide>
  );
}

export function Monitoring() {
  return (
    <Slide id="monitoring" label="Monitoring dashboard">
      <Header eyebrow={monitoring.eyebrow} title={monitoring.title} />
      <Box x={96} y={420}>
        <Table head={monitoring.head} rows={monitoring.rows} widths={[320, 520, 360, 528]} rowH={76} />
      </Box>
      <Cite>{monitoring.cite}</Cite>
    </Slide>
  );
}

export function Decisions() {
  return (
    <Slide id="decisions" label="Data drives decisions">
      <Header eyebrow={decisions.eyebrow} title={decisions.title} />
      {decisions.columns.map((c, i) => (
        <Box key={c.title} x={96 + i * 592} y={420} w={544} h={500}>
          <Card tone="white" delay={i * 0.15} className="flex h-full flex-col px-9 py-8">
            <div className="flex items-center gap-4 font-extrabold uppercase tracking-wide" style={{ fontSize: 32, color: TONE_TEXT[c.tone] }}>
              <Icon name={c.icon} size={38} />
              {c.title}
            </div>
            <ul className="m-0 flex-1 list-none p-0" style={{ fontSize: 32, marginTop: 18 }}>
              {c.items.map((it, j) => (
                <motion.li key={it} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ amount: 0.5 }} transition={{ delay: 0.3 + i * 0.15 + j * 0.08 }} style={{ lineHeight: "58px" }}>
                  {it}
                </motion.li>
              ))}
            </ul>
            <div className={`${c.tone === "green" ? "bg-lime text-ink" : c.tone === "amber" ? "bg-risk-amber text-ink" : "bg-risk-red text-paper"} px-6 py-3 font-bold`} style={{ fontSize: 30 }}>
              {c.action}
            </div>
          </Card>
        </Box>
      ))}
      <Cite>{decisions.cite}</Cite>
    </Slide>
  );
}

export function Phases() {
  return (
    <Slide id="phases" label="Strength in three phases">
      <Header eyebrow={phases.eyebrow} title={phases.title} />
      {phases.phases.map((p, i) => (
        <Box key={p.name} x={96} y={320 + i * 224} w={1224} h={200}>
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ amount: 0.5 }} transition={{ duration: 0.6, delay: i * 0.2, ease: [0.16, 1, 0.3, 1] }} className="flex h-full">
            <div className={`flex flex-col justify-center px-8 ${p.tone === "ink" ? "bg-ink text-lime" : "bg-lime text-ink"}`} style={{ width: 300, clipPath: "polygon(0 0, 100% 0, calc(100% - 22px) 100%, 0 100%)" }}>
              <span className="h-display" style={{ fontSize: 52 }}>
                {p.name}
              </span>
              <span style={{ fontSize: 30, fontWeight: 700, marginTop: 6 }}>{p.weeks}</span>
            </div>
            <div className="flex flex-1 flex-col justify-center border-2 border-paper-2 bg-white px-8" style={{ marginLeft: -10 }}>
              <div style={{ fontSize: 32 }}>
                <strong>{p.focus}</strong> · {p.freq}
              </div>
              <div style={{ fontSize: 30, marginTop: 6 }}>{p.dose}</div>
              <div className="font-bold" style={{ fontSize: 30, color: "#1b7f4c", marginTop: 6 }}>
                {p.gate}
              </div>
            </div>
          </motion.div>
        </Box>
      ))}
      <Cite>{phases.cite}</Cite>
      <PhotoPanel src="/images/barbell.jpg" alt="Woman lifting a heavy barbell" objectPosition="center 40%" />
    </Slide>
  );
}

export function Session() {
  return (
    <Slide id="session" label="Session · Week 6">
      <Header eyebrow={session.eyebrow} title={session.title} />
      <Box x={96} y={420}>
        <Table head={session.head} rows={session.rows} widths={[560, 220, 380, 280, 288]} rowH={66} />
      </Box>
      <Box x={96} y={905}>
        <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.6 }}>
          <Chip>{session.footer}</Chip>
        </motion.div>
      </Box>
      <Cite y={1004}>{session.cite}</Cite>
    </Slide>
  );
}

export function Aerobic() {
  return (
    <Slide id="aerobic" label="Today's aerobic session">
      <Header eyebrow={aerobic.eyebrow} title={aerobic.title} />
      <Box x={96} y={320} w={1000} h={400}>
        <IntervalChart />
      </Box>
      <Box x={96} y={760} w={1000}>
        <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.6 }} style={{ fontSize: 32, lineHeight: "46px" }}>
          {aerobic.rules.map((r) => (
            <div key={r.label}>
              <strong>{r.label}</strong> {r.text}
            </div>
          ))}
        </motion.div>
      </Box>
      <Box x={1180} y={440}>
        <motion.table {...reveal} className="border-collapse" style={{ width: 644, fontSize: 30, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 260 }} />
            <col style={{ width: 384 }} />
          </colgroup>
          <tbody>
            {aerobic.table.map((r, i) => (
              <tr key={r[0]} className={i % 2 ? "bg-paper-2/70" : "bg-white/70"} style={{ height: 64, borderBottom: "2px solid #e2e2dc" }}>
                <td className="px-5 font-bold">{r[0]}</td>
                <td className="px-5">{r[1]}</td>
              </tr>
            ))}
          </tbody>
        </motion.table>
      </Box>
      <Box x={1180} y={790} w={644} h={190}>
        <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.3 }} className="h-full w-full overflow-hidden" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 8% 100%)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/bike.jpg" alt="Woman riding a stationary bike" className="h-full w-full object-cover" style={{ objectPosition: "center 35%" }} />
        </motion.div>
      </Box>
      <Cite>{aerobic.cite}</Cite>
    </Slide>
  );
}

export function ReturnToSport() {
  const geo = [
    { x: 96, y: 620, h: 360 },
    { x: 688, y: 500, h: 480 },
    { x: 1280, y: 440, h: 540 },
  ];
  const tones = { paper: "paper", ink: "ink", lime: "lime" } as const;
  return (
    <Slide id="return" label="Criteria, not calendar">
      <Header eyebrow={returnToSport.eyebrow} title={returnToSport.title} />
      <Box x={96} y={320} w={544} h={270}>
        <motion.div {...reveal} className="h-full w-full overflow-hidden" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/blocks.jpg" alt="Athlete pushing off starting blocks on a track" className="h-full w-full object-cover" style={{ objectPosition: "center 70%" }} />
        </motion.div>
      </Box>
      {returnToSport.steps.map((s, i) => (
        <Box key={s.step} x={geo[i].x} y={geo[i].y} w={544} h={geo[i].h}>
          <Card tone={tones[s.tone as keyof typeof tones]} delay={0.2 + i * 0.25} className="flex h-full flex-col px-9 py-8">
            <div className={`font-bold uppercase tracking-wide ${s.tone === "ink" ? "text-lime" : "text-mute"}`} style={{ fontSize: 28 }}>
              {s.step}
            </div>
            <div className="h-display" style={{ fontSize: 44, marginTop: 10 }}>
              {s.name}
            </div>
            <ul className="m-0 list-none p-0" style={{ fontSize: 30, marginTop: 18 }}>
              {s.items.map((it, j) => (
                <motion.li key={it} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ amount: 0.5 }} transition={{ delay: 0.5 + i * 0.25 + j * 0.1 }} className="flex items-center gap-3" style={{ lineHeight: "48px" }}>
                  <Icon name="tick" size={28} className={s.tone === "ink" ? "text-lime" : "text-ink"} />
                  {it}
                </motion.li>
              ))}
            </ul>
          </Card>
        </Box>
      ))}
      <Cite>{returnToSport.cite}</Cite>
    </Slide>
  );
}

export function Evidence() {
  return (
    <Slide id="evidence" label="Evidence & its limits">
      <Header eyebrow={evidence.eyebrow} title={evidence.title} />
      <Box x={96} y={420}>
        <Table head={evidence.head} rows={evidence.rows} widths={[460, 620, 648]} rowH={76} />
      </Box>
      <Box x={96} y={990} w={1728}>
        <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.6 }} className="font-bold" style={{ fontSize: 30 }}>
          {evidence.footer}
        </motion.div>
      </Box>
    </Slide>
  );
}

export function ProgramSections() {
  return (
    <>
      <Needs />
      <Monitoring />
      <Decisions />
      <Phases />
      <Session />
      <Aerobic />
      <ReturnToSport />
      <Evidence />
    </>
  );
}
