# REFUEL. REBUILD. RETURN.

A scroll-driven presentation website for a RED-S rehabilitation pitch by **Kyle Marambio** (Sports Trainer & S&C Coach): a criteria-based recovery plan for Shantha, a 19-year-old national-team distance runner.

The content (every section, figure, table, number and APA reference) is taken verbatim from the `RED-S_Rehabilitation_Strategy.pptx` deck and lives in one file: `lib/content.ts`.

## Stack

Next.js (static export) · Tailwind CSS v4 · React Three Fiber + drei · GSAP ScrollTrigger · Framer Motion · Lenis.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static site in ./out
```

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml` (set the repository's Pages source to "GitHub Actions").

## Presenting (screen recording)

* Every stop is a 1920×1080 stage, scaled to fit the window. Record at 1920×1080 for a 1:1 layout.
* `→` `↓` `space` `enter` advance, `←` `↑` go back, `Home` / `End` jump. The 3D story has six beats; each slide is one stop.
* Press `P` for presentation mode: fullscreen, cursor hidden, navigation chrome hidden. `Esc` leaves it.
* The top-right 600×400 px of every stop is kept empty for a webcam overlay. Open `/?qa=1` to see that zone outlined.
* All text is 28 px or larger at 1920×1080.

## Project map

| Path | What it is |
|---|---|
| `lib/content.ts` | All deck content, in deck order |
| `lib/story.ts` | Scroll-story progress store, beats and phase timings |
| `components/Experience.tsx` | Lenis smooth scroll, stop snapping, keyboard navigation, presentation mode |
| `components/ScrollStory.tsx` | Pinned hero → X-ray → bone → finish-line story with HTML overlays |
| `components/three/` | Rigged runner + bone-parented X-ray skeleton, track, dust, marching-cubes trabecular bone, camera rig |
| `public/models/` | `runner.glb` (Mixamo "Michelle" character, from the three.js examples) and `run.json` (a Mixamo run clip retargeted onto her rig) |
| `components/sections/` | One component per slide |
| `components/charts/` | Risk bars, energy-availability zone bar, interval chart |
| `public/fallback/` | Static frames shown if WebGL is unavailable |

The injury-report slide uses `public/images/injury-report.png`; swap that file to change the form image.

## The 3D story

* **Runner**: a textured, rigged Mixamo character driven by a motion-captured Mixamo run clip. The clip was retargeted onto her skeleton offline (per-bone rest-pose offsets, then `SkeletonUtils.retargetClip`) and stored as `public/models/run.json`. To use a different character, export a Mixamo rig as GLB, retarget the clip onto it the same way and point `components/three/Runner.tsx` at the new files.
* **X-ray**: her body fades to a translucent glow while capsule bones parented to her real rig bones light up. The pelvis, sacrum, femoral neck, tibia and foot bones use the lime "high-risk" material.
* **Bone**: trabecular bone is a warped gyroid isosurface polygonised with three's `MarchingCubes`. Scroll progress drives the trabecular thickness and a grain term that perforates the network, so it thins to an osteoporotic lattice and rebuilds again.
