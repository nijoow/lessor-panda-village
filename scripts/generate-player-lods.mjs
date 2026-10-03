/** Rebuild remote geometry LODs from the validated runtime rig, retaining skin and UVs.
 * Run after player:rebuild: node scripts/generate-player-lods.mjs
 * No texture copies: all levels use the original character material at runtime.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readGlb as parse, writeGlb as write } from "./lib/glb.mjs";
import {
  gltfCli as cli,
  playerPath,
  outputRoot,
  manifest,
} from "./lib/assets.mjs";
import { publishAssetSet } from "./lib/publish-assets.mjs";
import { jointNames, triangles, validatePlayerLod } from "./lib/player-lod.mjs";

const source = playerPath("base");

const original = parse(source).json;
const scratch = mkdtempSync(join(tmpdir(), "panda-lods-"));
const outputs = [];
try {
  for (const [name, ratio, error] of [
    ["medium", 0.2, 0.002],
    ["far", 0.06, 0.004],
  ]) {
    const simplified = join(scratch, `${name}.glb`);
    const final = join(scratch, `${name}-clean.glb`);
    execFileSync(
      cli,
      [
        "simplify",
        source,
        simplified,
        "--ratio",
        String(ratio),
        "--error",
        String(error),
      ],
      { stdio: "inherit" },
    );
    const document = parse(simplified);
    for (const mesh of document.json.meshes)
      for (const primitive of mesh.primitives) delete primitive.material;
    delete document.json.materials;
    delete document.json.images;
    delete document.json.textures;
    delete document.json.samplers;
    delete document.json.animations;
    write(simplified, document);
    execFileSync(
      cli,
      [
        "prune",
        simplified,
        final,
        "--keep-attributes",
        "true",
        "--keep-leaves",
        "true",
      ],
      { stdio: "inherit" },
    );
    const documentLod = parse(final),
      { json } = documentLod;
    validatePlayerLod(original, documentLod);
    outputs.push({
      source: final,
      url: manifest.player.urls[name === "medium" ? "lodMedium" : "lodFar"],
    });
    console.log(
      `${name}: ${triangles(original)} -> ${triangles(json)} triangles; ${jointNames(json).length} joints preserved, weights checked`,
    );
  }
  publishAssetSet(outputRoot, outputs);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
