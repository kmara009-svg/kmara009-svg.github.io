"use client";
import { Fragment, useEffect, useRef } from "react";
import { CLIPS } from "@/lib/media";
import { deck, STOPS } from "@/lib/deck";

/* Full-screen real footage under everything. Each clip is its own short file that starts on its
   first frame, so a move plays the instant a key is pressed; when a clip ends it stays on its
   last frame, and a move backwards (or a skipped clip) cuts to the clip's last-frame still.
   Clips are fetched in presentation order in the background, the next two first. During the
   X-ray beats the footage gets an X-ray look under the radiographs. */

const XRAY_FILTER = "grayscale(1) invert(1) sepia(0.35) hue-rotate(175deg) saturate(2.4) contrast(1.3) brightness(0.8)";

type Resting = { key: string; xray: boolean };
function resting(i: number): Resting {
  const s = STOPS[i];
  if (!s) return { key: "", xray: false };
  if (s.beat === "hero") return { key: "v:dawn", xray: false };
  if (s.beat === "xray-hip" || s.beat === "xray-limb") return { key: "s:run-hero", xray: true };
  if (s.beat) return { key: "", xray: false }; // bone beats: the story layer covers the screen
  return { key: s.clip ? `s:${s.clip}` : "", xray: false };
}

export default function MediaLayer() {
  const vids = useRef<Record<string, HTMLVideoElement | null>>({});
  const stills = useRef<Record<string, HTMLImageElement | null>>({});
  const filterBox = useRef<HTMLDivElement>(null);
  const visible = useRef("");

  useEffect(() => {
    const entries = (): [string, HTMLElement | null][] => [
      ...Object.entries(vids.current).map(([k, v]) => [`v:${k}`, v] as [string, HTMLElement | null]),
      ...Object.entries(stills.current).map(([k, v]) => [`s:${k}`, v] as [string, HTMLElement | null]),
    ];
    let pauseTimer: number | undefined;
    const show = (key: string, seconds: number) => {
      visible.current = key;
      for (const [k, el] of entries()) {
        if (!el) continue;
        el.style.transition = `opacity ${seconds}s linear`;
        el.style.opacity = k === key ? "1" : "0";
      }
      window.clearTimeout(pauseTimer);
      pauseTimer = window.setTimeout(() => {
        for (const [k, v] of Object.entries(vids.current)) if (v && `v:${k}` !== visible.current) v.pause();
      }, seconds * 1000 + 60);
    };
    const xray = (on: boolean, seconds: number) => {
      const f = filterBox.current;
      if (!f) return;
      f.style.transition = `filter ${seconds}s ease`;
      f.style.filter = on ? XRAY_FILTER : "none";
    };
    const play = (id: string, fromStart: boolean) => {
      const v = vids.current[id];
      if (!v) return;
      if (fromStart) {
        try {
          v.currentTime = 0;
        } catch {}
      }
      v.play().catch(() => {});
    };
    /* fetch clips in presentation order, the ones needed next first */
    const order = Array.from(new Set(STOPS.map((s) => s.clip).filter(Boolean) as string[]));
    const warmed = new Set<string>(["dawn"]);
    const warm = (id: string) => {
      const v = vids.current[id];
      if (!v || warmed.has(id)) return;
      warmed.add(id);
      v.preload = "auto";
      v.load();
    };
    const warmAround = (i: number) => {
      for (let k = 1; k <= 2; k++) {
        const c = STOPS[i + k]?.clip;
        if (c) warm(c);
      }
    };
    let cancelled = false;
    const warmAll = async () => {
      for (const id of order) {
        if (cancelled) return;
        if (warmed.has(id)) continue;
        warm(id);
        const v = vids.current[id];
        if (!v) continue;
        await new Promise<void>((res) => {
          const done = () => res();
          v.addEventListener("canplaythrough", done, { once: true });
          v.addEventListener("error", done, { once: true });
          window.setTimeout(done, 6000);
        });
      }
    };

    const r = resting(deck.index);
    show(r.key, 0);
    xray(r.xray, 0);
    if (r.key === "v:dawn") play("dawn", false);
    warmAround(deck.index);
    const hero = vids.current.dawn;
    const startWarm = () => window.setTimeout(warmAll, 400);
    if (hero && hero.readyState < 4) hero.addEventListener("canplaythrough", startWarm, { once: true });
    else startWarm();

    const offMove = deck.subscribe((m) => {
      if (m.clip) {
        xray(false, 0.25);
        play(m.clip, true);
        show(`v:${m.clip}`, 0.35);
      } else {
        const rr = resting(m.to);
        xray(rr.xray, 0.35);
        if (rr.key === "v:dawn") play("dawn", false);
        show(rr.key, 0.35);
      }
      warmAround(m.to);
    });
    const offReveal = deck.onReveal((i, instant) => {
      if (resting(i).xray) xray(true, instant ? 0.2 : 0.9);
    });
    // a clip cut short by the presenter: rest on its last frame instead of freezing mid-stride
    const offSettle = deck.onSettle((i) => {
      const key = visible.current;
      if (!key.startsWith("v:") || key === "v:dawn") return;
      const v = vids.current[key.slice(2)];
      if (v && !v.ended && v.duration && v.currentTime < v.duration - 0.2) {
        v.pause();
        show(resting(i).key, 0.18);
      }
    });
    return () => {
      cancelled = true;
      window.clearTimeout(pauseTimer);
      offMove();
      offReveal();
      offSettle();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-ink" aria-hidden>
      <div ref={filterBox} className="absolute inset-0" style={{ willChange: "filter" }}>
        {Object.values(CLIPS).map((c) => (
          <Fragment key={c.id}>
            {!c.loop ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={(el) => {
                  stills.current[c.id] = el;
                }}
                src={c.end}
                alt=""
                decoding="async"
                fetchPriority="low"
                className="absolute inset-0 h-full w-full object-cover"
                style={{ opacity: 0 }}
              />
            ) : null}
            <video
              ref={(el) => {
                vids.current[c.id] = el;
              }}
              src={c.src}
              poster={c.poster}
              muted
              playsInline
              loop={!!c.loop}
              preload={c.loop ? "auto" : "none"}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ opacity: 0 }}
            />
          </Fragment>
        ))}
      </div>
    </div>
  );
}
