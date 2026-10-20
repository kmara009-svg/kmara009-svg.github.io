// A lighter copy of the runner for her rivals, who are only ever seen a few metres off: the same skeleton, skin
// weights and uvs with every mesh simplified, and no images (the app dresses them in runner.glb's materials, which
// are already loaded), so four rivals cost about what one runner does. Also bakes their kit mask.
//   npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp
//   node scripts/model/rival-lod.mjs public/models/runner.glb public/models/rival.glb public/models/rival-kit.png
// 1. Each primitive is welded, then simplified to its share of the triangles (the face least, as it is looked at,
//    the hair most) with meshoptimizer, which only collapses edges, so every kept vertex keeps its weights and uvs.
//    The result is quantized (KHR_mesh_quantization, which three's loader reads natively: no decoder).
// 2. The kit mask says where the body texture is skin (r), top fabric (g) or shorts fabric (b); the shoes' lime
//    accents are white (all three, so a filtered blend still splits cleanly). It is judged by colour and by where on
//    her the texel is worn (the body mesh's uvs and bind-pose heights: feet, legs and shorts, upper body), so the
//    white and black of her shoes keep their own colours.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, quantize, simplifyPrimitive, weldPrimitive } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const [src, dst, maskOut] = process.argv.slice(2);
if (!src || !dst || !maskOut) throw new Error("usage: node scripts/model/rival-lod.mjs <runner.glb> <rival.glb> <rival-kit.png>");
const RATIO = { Ch03_Body: 0.32, Face: 0.5, Hair: 0.22, Headband: 0.3, Gold: 1 };

await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const root = doc.getRoot();

/* ---------- kit mask, from the full body mesh and its texture ---------- */
const N = 512;
const body = root.listMeshes().flatMap((m) => m.listPrimitives()).find((p) => p.getMaterial()?.getName() === "Ch03_Body");
const image = body.getMaterial().getBaseColorTexture().getImage();
{
  // zones: 1 feet (below 14 cm), 2 legs and shorts, 3 upper body (above the waistband)
  const pos = body.getAttribute("POSITION").getArray(), uv = body.getAttribute("TEXCOORD_0").getArray(), idx = body.getIndices().getArray();
  const zone = new Uint8Array(N * N);
  const edge = (ax, ay, bx, by, px, py) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t + 1], idx[t + 2]];
    const y = (pos[v[0] * 3 + 1] + pos[v[1] * 3 + 1] + pos[v[2] * 3 + 1]) / 3;
    const code = y < 0.14 ? 1 : y < 1.02 ? 2 : 3;
    const P = v.map((k) => [uv[k * 2] * N, uv[k * 2 + 1] * N]);
    const area = edge(...P[0], ...P[1], ...P[2]);
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0])) - 1), x1 = Math.min(N - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1])) - 1), y1 = Math.min(N - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])) + 1);
    for (let py = y0; py <= y1; py++)
      for (let px = x0; px <= x1; px++) {
        const cx = px + 0.5, cy = py + 0.5; // a little outside each triangle too, so filtering at chart edges finds a zone
        if (edge(...P[1], ...P[2], cx, cy) / area >= -0.15 && edge(...P[2], ...P[0], cx, cy) / area >= -0.15 && edge(...P[0], ...P[1], cx, cy) / area >= -0.15) zone[py * N + px] = code;
      }
  }
  const col = await sharp(Buffer.from(image)).resize(N, N).removeAlpha().raw().toBuffer();
  const out = Buffer.alloc(N * N * 3);
  for (let p = 0; p < N * N; p++) {
    const r = col[p * 3], g = col[p * 3 + 1], b = col[p * 3 + 2], z = zone[p];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const v = mx / 255, s = mx ? (mx - mn) / mx : 0;
    let hue = 0;
    if (mx !== mn) {
      hue = mx === r ? (60 * (g - b)) / (mx - mn) : mx === g ? 120 + (60 * (b - r)) / (mx - mn) : 240 + (60 * (r - g)) / (mx - mn);
      if (hue < 0) hue += 360;
    }
    const lime = g > 130 && g > r * 1.05 && b < 120 && s > 0.45;
    const skin = !lime && hue >= 6 && hue <= 45 && s >= 0.22 && s <= 0.85 && v >= 0.12 && v <= 0.92;
    const top = z === 3 && !lime && !skin && s < 0.16 && v > 0.42;
    const shorts = z === 2 && !lime && !skin && v < 0.3;
    out[p * 3] = skin || lime ? 255 : 0;
    out[p * 3 + 1] = top || lime ? 255 : 0;
    out[p * 3 + 2] = shorts || lime ? 255 : 0;
  }
  await sharp(out, { raw: { width: N, height: N, channels: 3 } }).png({ compressionLevel: 9 }).toFile(maskOut);
}

/* ---------- the light model ---------- */
const tris = (p) => p.getIndices().getCount() / 3;
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const name = prim.getMaterial()?.getName() ?? "";
    const ratio = RATIO[name] ?? 0.4;
    const before = tris(prim);
    if (ratio < 1) {
      weldPrimitive(prim);
      simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio, error: 0.02 });
    }
    console.log(`${name}: ${before} -> ${tris(prim)} triangles`);
  }
}
for (const tex of root.listTextures()) tex.dispose(); // the materials stay, by name, for the app to match
await doc.transform(prune({ keepAttributes: true }), quantize());
await io.write(dst, doc);
