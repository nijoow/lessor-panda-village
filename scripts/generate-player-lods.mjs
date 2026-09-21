/** Rebuild remote geometry LODs from the validated runtime rig, retaining skin and UVs.
 * Run after player:rebuild: node scripts/generate-player-lods.mjs
 * No texture copies: all levels use the original character material at runtime.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "node_modules/.bin/gltf-transform");
const source = join(root, "public/models/player/base.glb");
const parse = (file) => {
  const data = readFileSync(file);
  const length = data.readUInt32LE(12);
  const json = JSON.parse(data.subarray(20, 20 + length).toString());
  const bin = data.subarray(28 + length);
  return { json, bin };
};
const write = (file, { json, bin }) => {
  const encoded = Buffer.from(JSON.stringify(json));
  const padded = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 0x20);
  encoded.copy(padded);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + padded.length + bin.length, 8);
  header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
  writeFileSync(file, Buffer.concat([header, padded, binHeader, bin]));
};
const original = parse(source).json;
const jointNames = (json) => json.skins[0].joints.map((index) => json.nodes[index].name);
const triangles = (json) => json.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((count, primitive) => count + json.accessors[primitive.indices].count / 3, 0), 0);
const scratch = mkdtempSync(join(tmpdir(), "panda-lods-"));
try {
  for (const [name, ratio, error] of [["medium", 0.2, 0.002], ["far", 0.06, 0.004]]) {
    const simplified = join(scratch, `${name}.glb`);
    const final = join(scratch, `${name}-clean.glb`);
    execFileSync(cli, ["simplify", source, simplified, "--ratio", String(ratio), "--error", String(error)], { stdio: "inherit" });
    const document = parse(simplified);
    for (const mesh of document.json.meshes) for (const primitive of mesh.primitives) delete primitive.material;
    delete document.json.materials; delete document.json.images; delete document.json.textures;
    delete document.json.samplers; delete document.json.animations;
    write(simplified, document);
    execFileSync(cli, ["prune", simplified, final, "--keep-attributes", "true", "--keep-leaves", "true"], { stdio: "inherit" });
    const { json, bin } = parse(final);
    if (JSON.stringify(jointNames(json)) !== JSON.stringify(jointNames(original))) throw new Error("LOD changed skin joint order");
    const sourceJoints = original.skins[0].joints;
    for (const [order, index] of json.skins[0].joints.entries()) {
      const before = original.nodes[sourceJoints[order]];
      const after = json.nodes[index];
      for (const [property, fallback] of [["translation", [0, 0, 0]], ["rotation", [0, 0, 0, 1]], ["scale", [1, 1, 1]]]) {
        const expected = before[property] ?? fallback;
        const actual = after[property] ?? fallback;
        if (expected.some((value, component) => Math.abs(value - actual[component]) > 1e-6)) throw new Error(`Changed ${before.name} ${property}`);
      }
    }
    for (const skin of json.skins) {
      if (json.accessors[skin.inverseBindMatrices].count !== skin.joints.length) throw new Error("Invalid inverse bind matrix count");
    }
    for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
      for (const attribute of ["POSITION", "NORMAL", "TEXCOORD_0", "JOINTS_0", "WEIGHTS_0"]) {
        if (primitive.attributes[attribute] === undefined) throw new Error(`Missing ${attribute}`);
      }
      const weights = json.accessors[primitive.attributes.WEIGHTS_0];
      const view = json.bufferViews[weights.bufferView];
      const size = weights.componentType === 5126 ? 4 : weights.componentType === 5123 ? 2 : 1;
      for (let i = 0; i < weights.count; i++) {
        let total = 0;
        for (let j = 0; j < 4; j++) {
          const offset = (view.byteOffset ?? 0) + (weights.byteOffset ?? 0) + i * (view.byteStride ?? size * 4) + j * size;
          total += size === 4 ? bin.readFloatLE(offset) : size === 2 ? bin.readUInt16LE(offset) / 65535 : bin.readUInt8(offset) / 255;
        }
        if (Math.abs(total - 1) > 0.02) throw new Error(`Invalid skin weight sum ${total}`);
      }
    }
    if (triangles(json) >= triangles(original)) throw new Error("LOD did not reduce geometry");
    copyFileSync(final, join(root, `public/models/player/lod-${name}.glb`));
    console.log(`${name}: ${triangles(original)} -> ${triangles(json)} triangles; ${jointNames(json).length} joints preserved, weights checked`);
  }
} finally { rmSync(scratch, { recursive: true, force: true }); }
