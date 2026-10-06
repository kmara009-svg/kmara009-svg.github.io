/* Single source of content: the "RED-S Rehabilitation Strategy" PowerPoint.
   Every figure, table, number and reference below is copied verbatim, in deck order. */

export const hero = {
  eyebrow: "RED-S rehab proposal",
  lines: ["REFUEL.", "REBUILD.", "RETURN."],
  subtitle: "A rehabilitation program for Shantha",
  tagline: "A criteria-based recovery plan for Shantha",
  presenter: "Kyle Marambio",
  role: "Sports Trainer & S&C Coach",
};

export const glance = {
  eyebrow: "The case",
  title: "SHANTHA AT A GLANCE",
  stats: [
    { value: "19", label: "years old, national team", countTo: 19 },
    { value: "100–120", label: "km run per week" },
    { value: "8 yrs", label: "endurance, almost no lifting" },
    { value: "12–24", label: "week team-based recovery" },
  ],
  chips: [
    { icon: "bolt", text: "Fatigue, slower times" },
    { icon: "clock", text: "Missed cycles" },
    { icon: "warn", text: "Early bone loss" },
    { icon: "none", text: "Diagnosis: RED-S", accent: true },
  ],
};

export const energy = {
  eyebrow: "01 · Background",
  title: "ENERGY AVAILABILITY",
  formula: { a: "Energy intake", b: "Exercise energy", c: "Fat-free mass", result: "EA", resultLabel: "fuel left" },
  marker: "▼ Shantha: likely here",
  zones: [
    { label: "< 30 · Low", tone: "red" },
    { label: "30–45 · Reduced", tone: "amber" },
    { label: "≥ 45 · Optimal", tone: "green" },
  ],
  unit: "kcal per kg fat-free mass per day",
  note: "Thresholds are guides, not hard cut-offs",
  cite: "Loucks & Thuma (2003); Mountjoy et al. (2023)",
};

export const skeleton = {
  eyebrow: "01 · Anatomy",
  title: "WHERE THE SKELETON PAYS",
  high: ["Pelvis & sacrum", "Femoral neck"],
  lower: ["Tibial shaft", "Metatarsals"],
  cards: [
    { photo: "/images/xray-pelvis.jpg", chip: "Pelvis", level: "HIGH RISK", text: "Trabecular bone thins first when oestrogen falls", tone: "red" },
    { photo: "/images/xray-feet.jpg", chip: "Feet", level: "LOWER RISK", text: "Cortical shafts overloaded by repeated foot strikes", tone: "green" },
  ],
  cite: "Warden et al. (2014); Stellingwerff et al. (2023)",
};

export const hormones = {
  eyebrow: "01 · Pathophysiology",
  title: "EMPTY TANK, FRAGILE BONE",
  flow: [
    { name: "Low EA", detail: "Under-fuelled for load", tone: "ink" },
    { name: "Hypothalamus", detail: "↓ GnRH pulses", tone: "paper" },
    { name: "Pituitary", detail: "↓ LH & FSH", tone: "paper" },
    { name: "Ovaries", detail: "↓ Oestrogen, cycle stops", tone: "paper" },
    { name: "Bone", detail: "↑ Breakdown · ↓ Build", tone: "red" },
  ],
  parallel: { title: "IN PARALLEL", text: "↓ T3, IGF-1, leptin → fatigue, slow recovery, slower times" },
  cite: "Loucks & Thuma (2003); Ihle & Loucks (2004)",
};

export const normalVsReds = {
  eyebrow: "01 · Function & impact",
  title: "NORMAL VS RED-S",
  head: ["System", "Normal role", "In RED-S", "Impact on running"],
  rows: [
    ["Hormones (HPO)", "Regular cycle, oestrogen", "Cycle stops", "Bone loses protection"],
    ["Bone", "Remodels to match load", "Net loss, weaker", "↑ Stress-fracture risk"],
    ["Muscle", "Repairs & adapts", "Poor repair", "↓ Strength, slow recovery"],
    ["Metabolism", "Fuels training", "Energy-saving mode", "Fatigue, slower times"],
  ],
  strip: "Training harder while under-fuelled = slower",
  cite: "Mountjoy et al. (2023)",
};

export const signs = {
  eyebrow: "01 · Presentation",
  title: "SIGNS & SEVERITY",
  signs: [
    { icon: "bolt", text: "Persistent fatigue" },
    { icon: "chart", text: "Slower race times" },
    { icon: "clock", text: "Missed cycles" },
    { icon: "warn", text: "Early bone loss" },
  ],
  catLabel: "IOC REDs CAT2 → participation",
  head: ["Level", "Guidance"],
  levels: [
    { level: "Green", guidance: "Full training & racing", color: "#1b7f4c", ink: "#ffffff" },
    { level: "Yellow", guidance: "Full, with monitoring", color: "#f2b705", ink: "#1e1e1e" },
    { level: "Orange", guidance: "Modify training/racing", color: "#e4772b", ink: "#1e1e1e" },
    { level: "Red", guidance: "Remove from sport", color: "#c8102e", ink: "#ffffff" },
  ],
  note: { strong: "Shantha:", text: " planned as Orange until the physician confirms" },
  cite: "Stellingwerff et al. (2023)",
};

export const dayOne = {
  eyebrow: "02 · Initial care",
  title: "DAY 1: MY FIRST RESPONSE",
  steps: [
    { n: "01", name: "Recognise", detail: "Private chat, history" },
    { n: "02", name: "Assess", detail: "TOTAPS; palpate bone" },
    { n: "03", name: "Record", detail: "Injury form, APSS, LEAF-Q" },
    { n: "04", name: "Refer", detail: "Physician; no racing" },
  ],
  stop: { title: "STOP & REFER", items: ["Focal bone pain", "Dizziness, fainting", "Very low heart rate", "Disordered eating"] },
  who: { title: "WHO DOES WHAT", items: ["Me: first contact, report", "Me (S&C): the program", "Refer: diagnosis, diet", "Coach: limits only"] },
  cite: "Haff & Triplett (2016); Melin et al. (2014)",
};

export const injuryReport = {
  eyebrow: "02 · Initial care",
  title: "THE INJURY REPORT",
  rows: [
    { label: "Type", text: "Overuse, non-contact, gradual onset" },
    { label: "Nature", text: "Suspected RED-S, not a trauma" },
    { label: "Symptoms", text: "Fatigue, missed periods, slower times" },
    { label: "Pain", text: "None; no focal bony tenderness" },
    { label: "Screens", text: "TOTAPS, LEAF-Q, APSS completed" },
    { label: "Action", text: "Referred to sports physician; racing withdrawn" },
  ],
  caption: "Form: club sports injury report (completed by K. Marambio)",
  image: "/images/injury-report.png",
};

export const startNow = {
  eyebrow: "02 · Early management",
  title: "START NOW, AVOID FOR NOW",
  columns: [
    { title: "START NOW", tone: "green", icon: "check", items: ["Graded ↑ energy intake", "Cut running volume", "Supervised strength", "Bike / pool aerobic", "Sleep 8 h+ a night"] },
    { title: "CONTRAINDICATED", tone: "red", icon: "warn", items: ["Racing", "Fasted or double sessions", "High-volume running", "Jumps before bone clear", "Weight-loss goals"] },
    { title: "COMMUNICATE", tone: "teal", icon: "users", items: ["Weekly MDT check-in", "Coach: limits only", "Athlete consents to sharing", "One point of contact"] },
  ],
  cite: "Mountjoy et al. (2023); Stellingwerff et al. (2023)",
};

export const risk = {
  eyebrow: "03 · Risk factors",
  title: "RISK STACKS UP",
  chartTitle: "Bone stress injury incidence (n = 259)",
  bars: [
    { label: "All athletes", value: 10.8 },
    { label: "Low BMD alone", value: 21.0 },
    { label: "Low BMD + ≥12 h/wk", value: 29.7 },
    { label: "≥12 h/wk + lean sport + diet restraint", value: 46.2 },
  ],
  strip: { text: "Amenorrhoeic elite distance runners: ", strong: "~4.5× more bone injuries" },
  stack: { title: "SHANTHA'S STACK", items: ["Lean-build sport", "Diet restriction", "100–120 km/week", "Low BMD", "Missed cycles", "No strength work"] },
  cite: "Barrack et al. (2014); Heikura et al. (2018)",
};

export const prevention = {
  eyebrow: "03 · Prevention",
  title: "REMOVING THE RISKS",
  head: ["Risk", "Counter-strategy", "Owner"],
  rows: [
    ["Low intake", "Graded ↑ intake; fuel every run", "Dietitian"],
    ["Weight pressure", "No weigh-ins or body talk", "Psychologist"],
    ["High run volume", "Criteria-gated return to run", "S&C + coach"],
    ["No strength base", "Heavy lifting 2–3×/week", "S&C"],
    ["Low BMD", "Ca/vit D review; DXA re-scan", "Physician"],
    ["Recurrence", "REDs screen each pre-season", "Whole team"],
  ],
  cite: "Mountjoy et al. (2023); Beck et al. (2017)",
};

export const needs = {
  eyebrow: "04 · Needs analysis",
  title: "WHAT SHE MUST REBUILD",
  head: ["Quality", "Demand", "Level", "Rehab target"],
  rows: [
    { quality: "Aerobic capacity", demand: 5, level: "Very high", target: "Hold via low-impact work" },
    { quality: "Running economy", demand: 4, level: "High", target: "Stiff, strong calf & hips" },
    { quality: "Muscular endurance", demand: 4, level: "High", target: "High-rep single-leg, calf" },
    { quality: "Max strength", demand: 3, level: "Moderate", target: "Heavy lifts: bone + speed" },
    { quality: "Anaerobic kick", demand: 3, level: "Moderate", target: "Late-phase plyometrics" },
    { quality: "Impact / landing", demand: 5, level: "Very high", target: "Graded jumps → running" },
  ],
  context: [
    { label: "Training:", text: "6 runs/wk, 100–120 km" },
    { label: "Status:", text: "8 yrs running, no lifting" },
    { label: "History:", text: "restriction, low BMD" },
    { label: "Psych:", text: "body image, confidence" },
  ],
  cite: "Warden et al. (2014); Beck et al. (2017)",
};

export const monitoring = {
  eyebrow: "05 · Monitoring",
  title: "MONITORING DASHBOARD",
  head: ["Measure", "Tool / tech", "When", "Red flag"],
  rows: [
    ["Energy/cycle", "Food log, LEAF-Q, app", "Weekly", "No cycle by wk 12"],
    ["Bone", "DXA · palpation", "0, 6–12 mo", "Z-score falls"],
    ["Load", "sRPE (AU), HR", "Every session", "Weekly spike"],
    ["Strength", "Force-plate IMTP", "Every 4 wk", "Asymmetry > 10%"],
    ["Impact", "CMJ; pain 0–10", "Fortnightly", "Any bone pain"],
    ["Wellbeing", "RESTQ-Sport, HRV", "Daily/weekly", "Mood, sleep ↓"],
  ],
  cite: "Foster et al. (2001); Halson (2014)",
};

export const decisions = {
  eyebrow: "05 · Decision rules",
  title: "DATA DRIVES DECISIONS",
  columns: [
    { title: "PROGRESS", tone: "green", icon: "check", items: ["No bone pain", "Strength trending up", "Fuel targets met", "Cycle signs returning"], action: "→ Advance one step" },
    { title: "HOLD", tone: "amber", icon: "clock", items: ["Soreness > 24 h", "sRPE above plan", "Fuel targets missed", "Poor sleep or mood"], action: "→ Repeat the week" },
    { title: "REGRESS", tone: "red", icon: "warn", items: ["Focal bone pain", "Weight loss", "Dizziness, low HR", "Restricting or bingeing"], action: "→ No impact; physician" },
  ],
  cite: "Warden et al. (2014); Stellingwerff et al. (2023)",
};

export const phases = {
  eyebrow: "06 · Resistance",
  title: "STRENGTH IN THREE PHASES",
  phases: [
    { name: "PHASE 1", weeks: "Wk 1–4", focus: "Foundation", freq: "2×/week", dose: "3×10 @ 60–70% 1RM · 3-1-1 · 90 s", gate: "Gate → clean technique, pain-free", tone: "lime" },
    { name: "PHASE 2", weeks: "Wk 5–12", focus: "Strength", freq: "2–3×/week", dose: "5×5 @ 80–85% 1RM · 2–3 min + landings", gate: "Gate → trap-bar DL ≥ 1.25× BW", tone: "lime" },
    { name: "PHASE 3", weeks: "Wk 13–24", focus: "Power", freq: "2×/week", dose: "4×3 @ 85–90% 1RM + hops 3×8", gate: "Gate → DL ≥ 1.5× BW; 25 calf raises", tone: "ink" },
  ],
  cite: "Watson et al. (2018); Haff & Triplett (2016)",
};

export const session = {
  eyebrow: "06 · Resistance",
  title: "SESSION · WEEK 6",
  head: ["Exercise", "Sets", "Load", "Tempo", "Rest"],
  rows: [
    ["1 · Drop landing → CMJ", "3×10", "Body weight", "Fast", "60 s"],
    ["2 · Trap-bar deadlift", "5×5", "80–85% 1RM", "2-0-1", "3 min"],
    ["3 · Back squat", "5×5", "80–85% 1RM", "3-0-1", "3 min"],
    ["4 · Overhead press", "5×5", "80% 1RM", "2-0-1", "2 min"],
    ["5 · Single-leg RDL", "3×8", "70% 1RM", "3-1-1", "90 s"],
    ["6 · Calf raise", "3×12", "Heavy", "3-1-1", "60 s"],
  ],
  footer: "RAMP warm-up · ≈ 45 min · 24 sets · Regress: bone pain → no jumps",
  cite: "Watson et al. (2018); Beck et al. (2017)",
};

export const aerobic = {
  eyebrow: "07 · Cardio",
  title: "TODAY'S AEROBIC SESSION",
  chart: {
    alt: "Session profile: 10-minute warm-up, six 3-minute efforts at RPE 7 with 90 seconds easy, 10-minute cool-down",
    hi: "RPE 7",
    lo: "RPE 3",
    warm: "Warm-up 10′",
    cool: "Cool-down 10′",
    intervals: "6 × 3′ hard : 90″ easy",
    warmMin: 10,
    coolMin: 10,
    reps: 6,
    workMin: 3,
    restMin: 1.5,
  },
  table: [
    ["Mode", "Bike or deep-water run"],
    ["Frequency", "3×/wk + 2 easy runs"],
    ["Intensity", "RPE 7 · HR zone 4"],
    ["Work:rest", "2:1 · 47 min total"],
    ["Monitor", "Chest-strap HR, sRPE"],
  ],
  rules: [
    { label: "Progress", text: "+1 interval/week" },
    { label: "Regress", text: "bike-only if bone pain" },
    { label: "Safety", text: "fuelled first; stop if pain" },
  ],
  cite: "Mujika & Padilla (2000); Foster et al. (2001)",
};

export const returnToSport = {
  eyebrow: "08 · Return to sport",
  title: "CRITERIA, NOT CALENDAR",
  steps: [
    { step: "STEP 1 · ≈ WK 1–8", name: "RETURN TO PARTICIPATION", items: ["Intake at target", "Pain-free hopping", "Phase 1 gate"], tone: "paper" },
    { step: "STEP 2 · ≈ WK 8–16", name: "RETURN TO TRAINING", items: ["Run–walk → continuous", "CAT2 yellow or better", "Cycle returning", "DL ≥ 1.25× BW"], tone: "ink" },
    { step: "STEP 3 · ≈ WK 16–24+", name: "RETURN TO RACING", items: ["Physician clearance", "3 pain-free full weeks", "DL ≥ 1.5× BW", "Racing + yearly screen"], tone: "lime" },
  ],
  cite: "Ardern et al. (2016); Stellingwerff et al. (2023)",
};

export const evidence = {
  eyebrow: "09 · Evidence",
  title: "EVIDENCE & ITS LIMITS",
  head: ["Decision", "Evidence", "Limitation"],
  rows: [
    ["Fuel before load", "Loucks & Thuma (2003)", "Lab-based, small samples"],
    ["Heavy lifts for bone", "Watson et al. (2018)", "Older women, not runners"],
    ["CAT2 to grade risk", "Stellingwerff et al. (2023)", "New; validation ongoing"],
    ["Screen with LEAF-Q", "Melin et al. (2014)", "Field EA is error-prone"],
    ["Restore the cycle", "Heikura et al. (2018)", "Cross-sectional design"],
    ["Keep intensity", "Mujika & Padilla (2000)", "Mixed, non-REDs samples"],
  ],
  footer: "Several measures, not one number · plan reviewed as evidence evolves",
};

export const closing = {
  lines: ["FUEL FIRST.", "LOAD SMART.", "CRITERIA, NOT CALENDAR."],
  chip: "Thank you · questions welcome",
};

export const references: { eyebrow: string; title: string; items: string[]; note?: string }[] = [
  {
    eyebrow: "APA 7th",
    title: "REFERENCES (1/5)",
    items: [
      "Ardern, C. L., Glasgow, P., Schneiders, A., Witvrouw, E., Clarsen, B., Cools, A., Gojanovic, B., Griffin, S., Khan, K. M., Moksnes, H., Mutch, S. A., Phillips, N., Reurink, G., Sadler, R., Silbernagel, K. G., Thorborg, K., Wangensteen, A., Wilk, K. E., & Bizzini, M. (2016). 2016 Consensus statement on return to sport from the First World Congress in Sports Physical Therapy, Bern. British Journal of Sports Medicine, 50(14), 853–864. https://doi.org/10.1136/bjsports-2016-096278",
      "Barrack, M. T., Gibbs, J. C., De Souza, M. J., Williams, N. I., Nichols, J. F., Rauh, M. J., & Nattiv, A. (2014). Higher incidence of bone stress injuries with increasing female athlete triad–related risk factors: A prospective multisite study of exercising girls and women. The American Journal of Sports Medicine, 42(4), 949–958. https://doi.org/10.1177/0363546513520295",
      "Beck, B. R., Daly, R. M., Singh, M. A. F., & Taaffe, D. R. (2017). Exercise and Sports Science Australia (ESSA) position statement on exercise prescription for the prevention and management of osteoporosis. Journal of Science and Medicine in Sport, 20(5), 438–445. https://doi.org/10.1016/j.jsams.2016.10.001",
    ],
  },
  {
    eyebrow: "APA 7th",
    title: "REFERENCES (2/5)",
    items: [
      "Foster, C., Florhaug, J. A., Franklin, J., Gottschall, L., Hrovatin, L. A., Parker, S., Doleshal, P., & Dodge, C. (2001). A new approach to monitoring exercise training. Journal of Strength and Conditioning Research, 15(1), 109–115.",
      "Haff, G. G., & Triplett, N. T. (Eds.). (2016). Essentials of strength training and conditioning (4th ed.). Human Kinetics.",
      "Halson, S. L. (2014). Monitoring training load to understand fatigue in athletes. Sports Medicine, 44(Suppl. 2), S139–S147. https://doi.org/10.1007/s40279-014-0253-z",
      "Heikura, I. A., Uusitalo, A. L. T., Stellingwerff, T., Bergland, D., Mero, A. A., & Burke, L. M. (2018). Low energy availability is difficult to assess but outcomes have large impact on bone injury rates in elite distance athletes. International Journal of Sport Nutrition and Exercise Metabolism, 28(4), 403–411. https://doi.org/10.1123/ijsnem.2017-0313",
    ],
  },
  {
    eyebrow: "APA 7th",
    title: "REFERENCES (3/5)",
    items: [
      "Ihle, R., & Loucks, A. B. (2004). Dose-response relationships between energy availability and bone turnover in young exercising women. Journal of Bone and Mineral Research, 19(8), 1231–1240. https://doi.org/10.1359/JBMR.040410",
      "Loucks, A. B., & Thuma, J. R. (2003). Luteinizing hormone pulsatility is disrupted at a threshold of energy availability in regularly menstruating women. The Journal of Clinical Endocrinology & Metabolism, 88(1), 297–311. https://doi.org/10.1210/jc.2002-020369",
      "Melin, A., Tornberg, Å. B., Skouby, S., Faber, J., Ritz, C., Sjödin, A., & Sundgot-Borgen, J. (2014). The LEAF questionnaire: A screening tool for the identification of female athletes at risk for the female athlete triad. British Journal of Sports Medicine, 48(7), 540–545. https://doi.org/10.1136/bjsports-2013-093240",
    ],
  },
  {
    eyebrow: "APA 7th",
    title: "REFERENCES (4/5)",
    items: [
      "Mountjoy, M., Ackerman, K. E., Bailey, D. M., Burke, L. M., Constantini, N., Hackney, A. C., Heikura, I. A., Melin, A., Pensgaard, A. M., Stellingwerff, T., Sundgot-Borgen, J. K., Torstveit, M. K., Jacobsen, A. U., Verhagen, E., Budgett, R., Engebretsen, L., & Erdener, U. (2023). 2023 International Olympic Committee’s (IOC) consensus statement on Relative Energy Deficiency in Sport (REDs). British Journal of Sports Medicine, 57(17), 1073–1098. https://doi.org/10.1136/bjsports-2023-106994",
      "Mujika, I., & Padilla, S. (2000). Detraining: Loss of training-induced physiological and performance adaptations. Part I: Short term insufficient training stimulus. Sports Medicine, 30(2), 79–87. https://doi.org/10.2165/00007256-200030020-00002",
      "Stellingwerff, T., Mountjoy, M., McCluskey, W. T., Ackerman, K. E., Verhagen, E., & Heikura, I. A. (2023). Review of the scientific rationale, development and validation of the International Olympic Committee Relative Energy Deficiency in Sport Clinical Assessment Tool: V.2 (IOC REDs CAT2)—by a subgroup of the IOC consensus on REDs. British Journal of Sports Medicine, 57(17), 1109–1118. https://doi.org/10.1136/bjsports-2023-106914",
    ],
  },
  {
    eyebrow: "APA 7th",
    title: "REFERENCES (5/5)",
    items: [
      "Warden, S. J., Davis, I. S., & Fredericson, M. (2014). Management and prevention of bone stress injuries in long-distance runners. Journal of Orthopaedic & Sports Physical Therapy, 44(10), 749–765. https://doi.org/10.2519/jospt.2014.5334",
      "Watson, S. L., Weeks, B. K., Weis, L. J., Harding, A. T., Horan, S. A., & Beck, B. R. (2018). High-intensity resistance and impact training improves bone mineral density and physical function in postmenopausal women with osteopenia and osteoporosis: The LIFTMOR randomized controlled trial. Journal of Bone and Mineral Research, 33(2), 211–220. https://doi.org/10.1002/jbmr.3284",
    ],
    note: "Photographs: Unsplash, used under the Unsplash License.",
  },
];
