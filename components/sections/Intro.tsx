"use client";
import { motion } from "framer-motion";
import { Slide } from "./Slide";
import { Box, Card, Chip, Cite, Header, Icon, PhotoPanel, Table, reveal } from "../ui/primitives";
import { energy, glance, hormones, normalVsReds, signs, skeleton } from "@/lib/content";
import ZoneBar from "../charts/ZoneBar";
import { useCountUp } from "@/lib/useCountUp";

function BigNumber({ value, countTo }: { value: string; countTo?: number }) {
  const { ref, text } = useCountUp(countTo ?? 0, { duration: 1.2 });
  return (
    <span ref={ref} className="tabular-nums" style={{ fontSize: 120, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 0.95 }}>
      {countTo ? text : value}
    </span>
  );
}

export function Glance() {
  return (
    <Slide id="glance" index={1} label="Shantha at a glance">
      <Header eyebrow={glance.eyebrow} title={glance.title} />
      {glance.stats.map((s, i) => (
        <Box key={s.label} x={96 + (i % 2) * 624} y={320 + Math.floor(i / 2) * 234} w={600} h={210}>
          <Card tone="paper" delay={i * 0.1} className="flex h-full flex-col justify-center px-10" style={{ borderLeft: "10px solid #c6f432" }}>
            <BigNumber value={s.value} countTo={s.countTo} />
            <span style={{ fontSize: 30, fontWeight: 600 }}>{s.label}</span>
          </Card>
        </Box>
      ))}
      <Box x={96} y={810} w={1224}>
        <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.4 }} className="flex flex-wrap" style={{ gap: 16 }}>
          {glance.chips.map((c) => (
            <Chip key={c.text} icon={c.icon} accent={c.accent}>
              {c.text}
            </Chip>
          ))}
        </motion.div>
      </Box>
      <PhotoPanel src="/images/runner-stride.jpg" alt="Female runner mid-stride" objectPosition="60% 30%" />
    </Slide>
  );
}

export function Energy() {
  const f = energy.formula;
  const box = "flex items-center justify-center bg-white border-2 border-ink font-bold";
  return (
    <Slide id="energy" index={2} label="Energy availability">
      <Header eyebrow={energy.eyebrow} title={energy.title} />
      <Box x={96} y={320} w={1224} h={230}>
        <motion.div {...reveal} className="relative h-full w-full">
          <div className={`absolute ${box}`} style={{ left: 0, top: 0, width: 340, height: 84, fontSize: 30 }}>
            {f.a}
          </div>
          <div className="absolute flex items-center justify-center text-risk-red" style={{ left: 350, top: 0, width: 60, height: 84, fontSize: 56, fontWeight: 900 }}>
            −
          </div>
          <div className={`absolute ${box}`} style={{ left: 420, top: 0, width: 340, height: 84, fontSize: 30 }}>
            {f.b}
          </div>
          <div className="absolute bg-ink" style={{ left: 0, top: 104, width: 760, height: 6 }} />
          <div className={`absolute ${box}`} style={{ left: 210, top: 130, width: 340, height: 84, fontSize: 30 }}>
            {f.c}
          </div>
          <div className="absolute flex items-center justify-center text-risk-red" style={{ left: 790, top: 60, width: 70, height: 84, fontSize: 56, fontWeight: 900 }}>
            =
          </div>
          <div className="absolute flex flex-col items-center justify-center bg-lime text-ink" style={{ left: 880, top: 10, width: 220, height: 190, clipPath: "polygon(0 0, 100% 0, 100% 100%, 12% 100%)" }}>
            <span className="h-display" style={{ fontSize: 112 }}>
              {f.result}
            </span>
            <span style={{ fontSize: 28, fontWeight: 700 }}>{f.resultLabel}</span>
          </div>
        </motion.div>
      </Box>
      <Box x={96} y={600}>
        <ZoneBar zones={energy.zones} marker={energy.marker} />
      </Box>
      <Box x={96} y={770} w={1224}>
        <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.5 }}>
          <div style={{ fontSize: 30 }}>{energy.unit}</div>
          <div className="italic" style={{ fontSize: 32, fontWeight: 700, marginTop: 20 }}>
            {energy.note}
          </div>
        </motion.div>
      </Box>
      <Cite>{energy.cite}</Cite>
      <PhotoPanel src="/images/plate.jpg" alt="Balanced plate of eggs, vegetables and avocado" />
    </Slide>
  );
}

export function Skeleton() {
  const labelY = [444, 525, 848, 961];
  const labels = [
    { text: skeleton.high[0], tone: "#c8102e" },
    { text: skeleton.high[1], tone: "#c8102e" },
    { text: skeleton.lower[0], tone: "#1b7f4c" },
    { text: skeleton.lower[1], tone: "#1b7f4c" },
  ];
  return (
    <Slide id="skeleton" index={3} label="Where the skeleton pays">
      <Header eyebrow={skeleton.eyebrow} title={skeleton.title} />
      <Box x={96} y={320} w={440} h={660}>
        <motion.img {...reveal} src="/images/skeleton-diagram.png" alt="Lower-limb skeleton marking high-risk trabecular sites (pelvis and sacrum, femoral neck) and lower-risk cortical sites (tibial shaft, metatarsals)" className="h-full w-full object-contain" />
      </Box>
      {labels.map((l, i) => (
        <Box key={l.text} x={548} y={labelY[i] - 20}>
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ amount: 0.5 }} transition={{ delay: 0.3 + i * 0.12, duration: 0.5 }} className="font-bold" style={{ fontSize: 32, color: l.tone, whiteSpace: "nowrap" }}>
            {l.text}
          </motion.div>
        </Box>
      ))}
      {skeleton.cards.map((c, i) => (
        <Box key={c.chip} x={1000 + i * 424} y={440} w={400} h={540}>
          <Card tone="white" delay={0.2 + i * 0.15} className="flex h-full flex-col overflow-hidden">
            <div className="relative" style={{ height: 230 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.photo} alt={`X-ray style image of the ${c.chip.toLowerCase()}`} className="h-full w-full object-cover" />
              <div className="absolute bg-lime px-5 py-1 font-bold text-ink" style={{ left: 16, bottom: 16, fontSize: 28 }}>
                {c.chip}
              </div>
            </div>
            <div className="flex flex-1 flex-col px-7 py-6">
              <div className="font-black uppercase" style={{ fontSize: c.tone === "red" ? 44 : 32, color: c.tone === "red" ? "#c8102e" : "#1b7f4c", lineHeight: 1 }}>
                {c.level}
              </div>
              <div style={{ fontSize: 30, marginTop: 16, lineHeight: 1.25 }}>{c.text}</div>
            </div>
          </Card>
        </Box>
      ))}
      <Cite>{skeleton.cite}</Cite>
    </Slide>
  );
}

export function Hormones() {
  const tone: Record<string, string> = { ink: "bg-ink text-paper", paper: "bg-white text-ink border-2 border-paper-2", red: "bg-risk-red text-paper" };
  return (
    <Slide id="hormones" index={4} label="Empty tank, fragile bone">
      <Header eyebrow={hormones.eyebrow} title={hormones.title} />
      {hormones.flow.map((f, i) => (
        <div key={f.name}>
          <Box x={96} y={320 + i * 132} w={760} h={96}>
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ amount: 0.5 }}
              transition={{ duration: 0.5, delay: i * 0.3, ease: [0.16, 1, 0.3, 1] }}
              className={`flex h-full items-center justify-between px-8 ${tone[f.tone]}`}
            >
              <span className={`font-extrabold ${f.tone === "ink" ? "text-lime" : ""}`} style={{ fontSize: 36 }}>
                {f.name}
              </span>
              <span style={{ fontSize: 28, fontWeight: 500 }}>{f.detail}</span>
            </motion.div>
          </Box>
          {i < hormones.flow.length - 1 ? (
            <Box x={456} y={416 + i * 132} w={40} h={36}>
              <motion.svg width={40} height={36} viewBox="0 0 40 36" initial={{ opacity: 0, scaleY: 0 }} whileInView={{ opacity: 1, scaleY: 1 }} viewport={{ amount: 0.5 }} transition={{ duration: 0.3, delay: 0.2 + i * 0.3 }} style={{ originY: 0 }}>
                <path d="M20 0v24M8 16l12 14 12-14" stroke="#c8102e" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </motion.svg>
            </Box>
          ) : null}
        </div>
      ))}
      <Box x={1000} y={440} w={824} h={240}>
        <motion.div {...reveal} className="h-full w-full overflow-hidden" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 6% 100%)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/jog-fence.jpg" alt="Woman jogging beside a fence at sunrise" className="h-full w-full object-cover" />
        </motion.div>
      </Box>
      <Box x={1000} y={710} w={824} h={240}>
        <Card tone="ink" delay={1.4} className="flex h-full flex-col justify-center px-10">
          <div className="h-display text-lime" style={{ fontSize: 48 }}>
            {hormones.parallel.title}
          </div>
          <div style={{ fontSize: 30, marginTop: 14 }}>{hormones.parallel.text}</div>
        </Card>
      </Box>
      <Cite>{hormones.cite}</Cite>
    </Slide>
  );
}

export function NormalVsReds() {
  return (
    <Slide id="normal-vs-reds" index={5} label="Normal vs RED-S">
      <Header eyebrow={normalVsReds.eyebrow} title={normalVsReds.title} />
      <Box x={96} y={420}>
        <Table head={normalVsReds.head} rows={normalVsReds.rows} widths={[330, 470, 420, 508]} rowH={78} />
      </Box>
      <Box x={96} y={860}>
        <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.5 }}>
          <Chip accent>{normalVsReds.strip}</Chip>
        </motion.div>
      </Box>
      <Cite>{normalVsReds.cite}</Cite>
    </Slide>
  );
}

export function Signs() {
  return (
    <Slide id="signs" index={6} label="Signs & severity">
      <Header eyebrow={signs.eyebrow} title={signs.title} />
      {signs.signs.map((s, i) => (
        <Box key={s.text} x={96 + (i % 2) * 444} y={320 + Math.floor(i / 2) * 174} w={420} h={150}>
          <Card tone="white" delay={i * 0.1} className="flex h-full items-center gap-6 px-8">
            <Icon name={s.icon} size={44} className="text-risk-red" />
            <span style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.15 }}>{s.text}</span>
          </Card>
        </Box>
      ))}
      <Box x={96} y={690} w={864} h={270}>
        <motion.div {...reveal} className="h-full w-full overflow-hidden" style={{ clipPath: "polygon(0 0, 100% 0, 94% 100%, 0 100%)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/blur-legs.jpg" alt="Motion-blurred runner's legs" className="h-full w-full object-cover" />
        </motion.div>
      </Box>
      <Box x={1020} y={440} w={804}>
        <motion.div {...reveal} className="font-bold" style={{ fontSize: 32 }}>
          {signs.catLabel}
        </motion.div>
      </Box>
      <Box x={1020} y={500}>
        <motion.table {...reveal} transition={{ ...reveal.transition, delay: 0.2 }} className="border-collapse" style={{ width: 804, fontSize: 30, tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 260 }} />
            <col style={{ width: 544 }} />
          </colgroup>
          <thead>
            <tr className="bg-ink text-lime" style={{ height: 72 }}>
              {signs.head.map((h) => (
                <th key={h} className="px-6 text-left font-extrabold uppercase tracking-wide" style={{ fontSize: 28 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {signs.levels.map((l, i) => (
              <motion.tr key={l.level} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ amount: 0.5 }} transition={{ delay: 0.3 + i * 0.12 }} style={{ height: 72, background: l.color, color: l.ink }}>
                <td className="px-6 font-bold">{l.level}</td>
                <td className="px-6">{l.guidance}</td>
              </motion.tr>
            ))}
          </tbody>
        </motion.table>
      </Box>
      <Box x={1020} y={884} w={804} h={96}>
        <Card tone="lime" delay={0.9} className="flex h-full items-center px-8" style={{ fontSize: 30 }}>
          <span>
            <strong>{signs.note.strong}</strong>
            {signs.note.text}
          </span>
        </Card>
      </Box>
      <Cite>{signs.cite}</Cite>
    </Slide>
  );
}

export function IntroSections() {
  return (
    <>
      <Glance />
      <Energy />
      <Skeleton />
      <Hormones />
      <NormalVsReds />
      <Signs />
    </>
  );
}
