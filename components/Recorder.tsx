"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* Records this tab, picture and the speeches' sound, and saves it as a 1920 x 1080 MP4 to the
   downloads folder when you stop (the button again, S, or the browser's own "Stop sharing"). The
   browser asks which screen to share and offers this tab first. The sound is taken straight from the speech videos
   rather than from the speakers, so it is clean whatever else the computer is playing. The
   button sits in the navigation chrome, so it is out of the recording in presentation mode. */
const TYPES = [
  "video/mp4;codecs=avc1.640028,mp4a.40.2",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a",
  "video/mp4;codecs=avc1,opus",
  "video/mp4;codecs=vp9,opus",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm",
];
const LIMIT_S = 15 * 60; // the brief's limit: the timer says when a take has run past it

/* the speeches' sound, mixed into one track for the recorder; every speech element is routed through
   it once (a media element can only be wired into Web Audio once) and keeps playing to the speakers */
let mix: { ctx: AudioContext; out: MediaStreamAudioDestinationNode; wired: WeakSet<HTMLMediaElement> } | null = null;
function speechSound() {
  if (!mix) {
    const ctx = new AudioContext();
    mix = { ctx, out: ctx.createMediaStreamDestination(), wired: new WeakSet() };
  }
  const { ctx, out, wired } = mix;
  void ctx.resume();
  document.querySelectorAll("video").forEach((v) => {
    if (wired.has(v)) return;
    const src = ctx.createMediaElementSource(v);
    src.connect(ctx.destination);
    src.connect(out);
    wired.add(v);
  });
  return out.stream.getAudioTracks();
}

/* the share is drawn into a fixed 1920 x 1080 frame (letterboxed when the window isn't 16:9), so the
   file keeps one size even when the window changes, as it does on entering presentation mode */
function fixedFrame(screen: MediaStream) {
  const W = 1920, H = 1080;
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.srcObject = screen;
  void v.play();
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  let on = true;
  const draw = () => {
    if (!on) return;
    if (v.videoWidth) {
      const s = Math.min(W / v.videoWidth, H / v.videoHeight), w = v.videoWidth * s, h = v.videoHeight * s;
      g.fillStyle = "#000";
      g.fillRect(0, 0, W, H);
      g.drawImage(v, (W - w) / 2, (H - h) / 2, w, h);
    }
    if ("requestVideoFrameCallback" in v) v.requestVideoFrameCallback(draw);
    else requestAnimationFrame(draw);
  };
  draw();
  const track = c.captureStream(30).getVideoTracks()[0];
  return {
    track,
    stop() {
      on = false;
      track.stop();
      v.srcObject = null;
    },
  };
}

const stamp = () => {
  const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}`;
};
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function Recorder() {
  const [can, setCan] = useState(false);
  const [state, setState] = useState<"idle" | "asking" | "recording">("idle");
  const [secs, setSecs] = useState(0);
  const [note, setNote] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => setCan(!!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== "undefined"), []);

  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (stateRef.current !== "idle") return;
    setState("asking");
    setNote("");
    let sound: MediaStreamTrack[] = [];
    try {
      sound = speechSound(); // inside the click or key press, so the sound can start
    } catch {
      /* no Web Audio: the recording falls back to whatever sound the tab share carries */
    }
    let screen: MediaStream;
    try {
      screen = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: sound.length === 0,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        surfaceSwitching: "exclude",
      } as DisplayMediaStreamOptions);
    } catch {
      setState("idle");
      return; // the share was cancelled
    }
    const type = TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const frame = fixedFrame(screen);
    const tracks = [frame.track, ...(sound.length ? sound : screen.getAudioTracks())];
    const r = new MediaRecorder(new MediaStream(tracks), { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 192_000 });
    const chunks: Blob[] = [];
    const t0 = Date.now();
    const tick = window.setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 500);
    r.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    r.onstop = () => {
      window.clearInterval(tick);
      const mime = r.mimeType || type || "video/webm";
      const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
      const name = `RED-S presentation ${stamp()}.${ext}`;
      const url = URL.createObjectURL(new Blob(chunks, { type: mime.split(";")[0] }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
      // then end the screen share (once the file is on its way)
      window.setTimeout(() => {
        frame.stop();
        screen.getTracks().forEach((t) => t.stop());
      }, 500);
      rec.current = null;
      setState("idle");
      setNote(ext === "mp4" ? `Saved “${name}” to your downloads` : `Saved “${name}”: this browser can't record MP4, use Chrome or Edge`);
    };
    // the browser's own "Stop sharing" ends the screen track
    screen.getVideoTracks()[0]?.addEventListener("ended", () => r.state !== "inactive" && r.stop());
    r.start(1000);
    rec.current = r;
    setSecs(0);
    setState("recording");
  }, []);

  // S starts or stops the recording
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "s" && e.key !== "S") || e.ctrlKey || e.metaKey || e.altKey) return;
      if (stateRef.current === "recording") stop();
      else void start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [start, stop]);

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(""), 8000);
    return () => window.clearTimeout(t);
  }, [note]);

  if (!can) return null;
  return (
    <>
      <span className="opacity-50">·</span>
      <button
        type="button"
        onClick={(e) => {
          e.currentTarget.blur(); // so space and enter go on navigating rather than pressing it again
          if (state === "recording") stop();
          else void start();
        }}
        className="uppercase underline-offset-4 hover:underline"
      >
        <kbd className="mr-2 rounded border border-current px-2 py-0.5">S</kbd>
        {state === "recording" ? (
          <>
            ● stop recording {clock(secs)}
            {secs > LIMIT_S ? " (over 15 min)" : ""}
          </>
        ) : state === "asking" ? (
          "choose this tab…"
        ) : (
          "record"
        )}
      </button>
      {note ? <span className="normal-case opacity-90">{note}</span> : null}
    </>
  );
}
