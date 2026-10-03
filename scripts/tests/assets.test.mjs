import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  parseGlb,
  encodeGlb,
  accessorInfo,
  packedAccessorRange,
  readComponent,
} from "../lib/glb.mjs";
import { publishAssetSet, buildAssetSet } from "../lib/publish-assets.mjs";
const empty = (label) =>
  encodeGlb({
    json: {
      asset: { version: "2.0", generator: label },
      buffers: [{ byteLength: 0 }],
    },
  });
function directory(action) {
  const root = mkdtempSync(join(tmpdir(), "panda-asset-test-"));
  try {
    return action(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test("GLB parsing rejects invalid headers, truncated chunks and inconsistent embedded lengths", () => {
  const valid = empty("original");
  assert.equal(parseGlb(valid).json.asset.generator, "original");
  for (const mutate of [
    (buffer) => {
      buffer.writeUInt32LE(1, 4);
    },
    (buffer) => {
      buffer.writeUInt32LE(buffer.length + 4, 8);
    },
    (buffer) => {
      buffer.writeUInt32LE(buffer.length, 12);
    },
    (buffer) => {
      buffer.writeUInt32LE(123, 16);
    },
  ]) {
    const malformed = Buffer.from(valid);
    mutate(malformed);
    assert.throws(() => parseGlb(malformed));
  }
  assert.throws(() => parseGlb(valid.subarray(0, 16)));
  assert.throws(() =>
    encodeGlb({
      json: { asset: { version: "2.0" }, buffers: [{ byteLength: 5 }] },
      bin: Buffer.alloc(4),
    }),
  );
});
test("accessors read interleaved data and reject packed mutation, sparse/compressed views and overruns", () => {
  const bin = Buffer.alloc(28);
  [1, 2, 3].forEach((v, i) => bin.writeFloatLE(v, i * 4));
  [4, 5, 6].forEach((v, i) => bin.writeFloatLE(v, 16 + i * 4));
  const json = {
    asset: { version: "2.0" },
    buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteLength: 28, byteStride: 16 }],
    accessors: [{ bufferView: 0, componentType: 5126, type: "VEC3", count: 2 }],
  };
  const document = parseGlb(encodeGlb({ json, bin })),
    info = accessorInfo(document, 0);
  assert.equal(readComponent(info, 1, 2), 6);
  assert.throws(() => packedAccessorRange(document, 0));
  assert.throws(() => readComponent(info, 2, 0));
  for (const change of [
    (j) => {
      j.accessors[0].count = 3;
    },
    (j) => {
      j.accessors[0].sparse = {};
    },
    (j) => {
      j.bufferViews[0].extensions = { EXT_meshopt_compression: {} };
    },
    (j) => {
      j.accessors[0].byteOffset = -4;
    },
    (j) => {
      j.bufferViews[0].byteStride = 4;
    },
  ]) {
    const clone = structuredClone(document.json);
    change(clone);
    assert.throws(() => accessorInfo({ ...document, json: clone }, 0));
  }
});
test("a failed legacy repair leaves the original file unchanged even after in-memory mutation", () =>
  directory((root) => {
    const positions = Buffer.from(
      new Float32Array([0, 1.4, 0.7, 0, 0, 0]).buffer,
    );
    const joints = Buffer.from([0, 1, 0, 0, 2, 2, 2, 2]);
    const weights = Buffer.from(
      new Float32Array([0.6, 0.4, 0, 0, 0.2, 0.3, 0, 0]).buffer,
    );
    const bin = Buffer.concat([positions, joints, weights]);
    const json = {
      asset: { version: "2.0" },
      buffers: [{ byteLength: bin.length }],
      nodes: [{ name: "Head" }, { name: "LeftArm" }, { name: "Hips" }],
      skins: [{ joints: [0, 1, 2] }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: positions.length },
        { buffer: 0, byteOffset: positions.length, byteLength: joints.length },
        {
          buffer: 0,
          byteOffset: positions.length + joints.length,
          byteLength: weights.length,
        },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, type: "VEC3", count: 2 },
        { bufferView: 1, componentType: 5121, type: "VEC4", count: 2 },
        { bufferView: 2, componentType: 5126, type: "VEC4", count: 2 },
      ],
      meshes: [
        {
          primitives: [
            { attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } },
          ],
        },
      ],
    };
    const original = encodeGlb({ json, bin }),
      path = join(root, "legacy.glb");
    writeFileSync(path, original);
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [
            fileURLToPath(new URL("../fix-face-weights.mjs", import.meta.url)),
            path,
          ],
          { stdio: "pipe" },
        ),
      (error) => /가중치 합|weight sum/.test(error.stderr.toString()),
    );
    assert.deepEqual(readFileSync(path), original);
  }));
test("the complete set must validate before any published file is changed", () =>
  directory((root) => {
    const output = join(root, "public"),
      staged = join(root, "staged");
    mkdirSync(output);
    mkdirSync(staged);
    const original = empty("old");
    writeFileSync(join(output, "a.glb"), original);
    writeFileSync(join(staged, "a.glb"), empty("new"));
    writeFileSync(join(staged, "b.glb"), Buffer.from("invalid"));
    assert.throws(() =>
      publishAssetSet(
        output,
        ["a.glb", "b.glb"].map((name) => ({
          source: join(staged, name),
          url: "/" + name,
        })),
      ),
    );
    assert.deepEqual(readFileSync(join(output, "a.glb")), original);
  }));
test("a publication failure rolls back both existing files and preserves staged sources", () =>
  directory((root) => {
    const output = join(root, "public"),
      staged = join(root, "staged");
    mkdirSync(output);
    mkdirSync(staged);
    for (const name of ["a.glb", "b.glb"]) {
      writeFileSync(join(output, name), empty("old-" + name));
      writeFileSync(join(staged, name), empty("new-" + name));
    }
    let count = 0;
    assert.throws(
      () =>
        publishAssetSet(
          output,
          ["a.glb", "b.glb"].map((name) => ({
            source: join(staged, name),
            url: "/" + name,
          })),
          (from, to) => {
            if (++count === 4) throw new Error("injected I/O failure");
            renameSync(from, to);
          },
        ),
      /injected/,
    );
    for (const name of ["a.glb", "b.glb"]) {
      assert.deepEqual(readFileSync(join(output, name)), empty("old-" + name));
      assert.deepEqual(readFileSync(join(staged, name)), empty("new-" + name));
    }
    assert.deepEqual(readdirSync(root).sort(), ["public", "staged"]);
  }));
test("a build or validation failure cleans staging without publishing, and check mode is read-only", () =>
  directory((root) => {
    const output = join(root, "public");
    mkdirSync(output);
    const original = empty("old");
    writeFileSync(join(output, "a.glb"), original);
    for (const phase of ["build", "validate", "check"]) {
      const options = {
        outputRoot: output,
        urls: ["/a.glb"],
        checkOnly: phase === "check",
        build({ stagedRoot }) {
          writeFileSync(join(stagedRoot, "a.glb"), empty("new"));
          if (phase === "build") throw new Error("build failed");
        },
        validate() {
          if (phase === "validate") throw new Error("validation failed");
        },
      };
      if (phase === "check") buildAssetSet(options);
      else assert.throws(() => buildAssetSet(options));
      assert.deepEqual(readFileSync(join(output, "a.glb")), original);
      assert.deepEqual(readdirSync(root), ["public"]);
    }
  }));
