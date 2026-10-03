import { accessorInfo, assertSkinWeights, readComponent } from "./glb.mjs";
import { manifest } from "./assets.mjs";
export const jointNames = (json) =>
  json.skins[0].joints.map((index) => json.nodes[index].name);
export const triangles = (json) =>
  json.meshes.reduce(
    (sum, mesh) =>
      sum +
      mesh.primitives.reduce(
        (count, primitive) =>
          count + json.accessors[primitive.indices].count / 3,
        0,
      ),
    0,
  );
export function validatePlayerLod(original, document) {
  const { json } = document;
  if (
    !json.nodes.some(
      (node) =>
        node.name === manifest.player.meshNode && node.skin !== undefined,
    )
  )
    throw new Error("LOD runtime mesh node is missing");
  if (JSON.stringify(jointNames(json)) !== JSON.stringify(jointNames(original)))
    throw new Error("LOD changed skin joint order");
  for (const [order, index] of json.skins[0].joints.entries()) {
    const before = original.nodes[original.skins[0].joints[order]],
      after = json.nodes[index];
    for (const [property, fallback] of [
      ["translation", [0, 0, 0]],
      ["rotation", [0, 0, 0, 1]],
      ["scale", [1, 1, 1]],
    ]) {
      const expected = before[property] ?? fallback,
        actual = after[property] ?? fallback;
      if (
        expected.length !== actual.length ||
        expected.some(
          (value, component) =>
            !Number.isFinite(actual[component]) ||
            Math.abs(value - actual[component]) > 1e-6,
        )
      )
        throw new Error(`Changed ${before.name} ${property}`);
    }
  }
  for (const skin of json.skins) {
    const info = accessorInfo(document, skin.inverseBindMatrices);
    if (
      info.accessor.type !== "MAT4" ||
      info.accessor.count !== skin.joints.length
    )
      throw new Error("Invalid inverse bind matrices");
  }
  for (const mesh of json.meshes)
    for (const primitive of mesh.primitives) {
      const positions = accessorInfo(document, primitive.attributes.POSITION);
      for (const attribute of [
        "POSITION",
        "NORMAL",
        "TEXCOORD_0",
        "JOINTS_0",
        "WEIGHTS_0",
      ]) {
        const info = accessorInfo(document, primitive.attributes[attribute]);
        if (info.accessor.count !== positions.accessor.count)
          throw new Error(`Mismatched ${attribute} count`);
        for (let i = 0; i < info.accessor.count; i++)
          for (let j = 0; j < info.elementCount; j++)
            if (!Number.isFinite(readComponent(info, i, j)))
              throw new Error(`Invalid ${attribute}`);
      }
      assertSkinWeights(document, primitive, json.skins[0].joints.length, 0.02);
      const indices = accessorInfo(document, primitive.indices);
      if (
        indices.accessor.type !== "SCALAR" ||
        indices.accessor.count % 3 ||
        (primitive.mode ?? 4) !== 4
      )
        throw new Error("LOD must use indexed triangles");
      for (let i = 0; i < indices.accessor.count; i++) {
        const index = readComponent(indices, i, 0);
        if (
          !Number.isInteger(index) ||
          index < 0 ||
          index >= positions.accessor.count
        )
          throw new Error("Invalid triangle index");
      }
    }
  if (triangles(json) >= triangles(original))
    throw new Error("LOD did not reduce geometry");
}
