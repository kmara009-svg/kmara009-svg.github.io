// A lighter copy of the runner for her rivals, who are only ever seen a few metres off: the same skeleton, skin
// weights and uvs with every mesh simplified, and no images (the app dresses them in runner.glb's materials, which
// are already loaded), so four rivals cost about what one runner does.
//   npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer
//   node scripts/model/rival-lod.mjs public/models/runner.glb public/models/rival.glb
// Each primitive is welded, then simplified to its share of the triangles (the face least, as it is looked at,
// the hair most) with meshoptimizer, which only collapses edges, so every kept vertex keeps its weights and uvs.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { meshopt, prune, simplifyPrimitive, weldPrimitive } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const [src, dst] = process.argv.slice(2);
if (!src || !dst) throw new Error("usage: node scripts/model/rival-lod.mjs <runner.glb> <rival.glb>");
const RATIO = { Ch03_Body: 0.32, Face: 0.5, Hair: 0.22, Headband: 0.3, Gold: 1 };

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(src);
const root = doc.getRoot();
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
// quantized and meshopt-compressed (the app's glTF loader decodes it)
await doc.transform(prune({ keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
await io.write(dst, doc);
