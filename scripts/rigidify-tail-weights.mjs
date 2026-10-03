/**
 * 최적화 전 base.glb에서 꼬리 정점을 Tail1에 강체 가중합니다.
 * 분절된 Meshy 꼬리에 여러 본을 섞을 때 생기는 찌그러짐을 막는 소스 제작 도구입니다.
 */
import {
  readGlb,
  packedAccessorRange,
  assertLegacySkin,
  assertSkinWeights,
  writeFileAtomic,
} from "./lib/glb.mjs";

const GLB_PATH = process.argv[2];
if (!GLB_PATH)
  throw new Error(
    "Usage: node scripts/rigidify-tail-weights.mjs <uncompressed-legacy-source.glb>",
  );
const TAIL_Z_START = -0.12;

const document = readGlb(GLB_PATH);
const { glb, json } = document;

const meshNode = json.nodes.find(
  (node) => node.mesh !== undefined && node.skin !== undefined,
);
if (!meshNode) throw new Error("스킨 메시 노드가 없음");
const primitive = json.meshes[meshNode.mesh].primitives[0];
assertLegacySkin(document, primitive);

const range = (i) => packedAccessorRange(document, i);

const positionRange = range(primitive.attributes.POSITION);
const jointRange = range(primitive.attributes.JOINTS_0);
const weightRange = range(primitive.attributes.WEIGHTS_0);
if (positionRange.componentType !== 5126)
  throw new Error("POSITION은 최적화 전 float여야 함");
if (jointRange.componentType !== 5121)
  throw new Error("JOINTS_0은 최적화 전 uint8이어야 함");
if (weightRange.componentType !== 5126)
  throw new Error("WEIGHTS_0은 최적화 전 float여야 함");

const positions = new Float32Array(
  glb.buffer,
  glb.byteOffset + positionRange.offset,
  positionRange.count * 3,
);
const joints = new Uint8Array(
  glb.buffer,
  glb.byteOffset + jointRange.offset,
  jointRange.count * 4,
);
const weights = new Float32Array(
  glb.buffer,
  glb.byteOffset + weightRange.offset,
  weightRange.count * 4,
);
const jointNames = json.skins[meshNode.skin].joints.map(
  (nodeIndex) => json.nodes[nodeIndex].name,
);
const tailRootIndex = jointNames.indexOf("Tail1");
if (tailRootIndex < 0) throw new Error("Tail1 본이 없음");

let changed = 0;
for (let vertex = 0; vertex < positionRange.count; vertex++) {
  if (positions[vertex * 3 + 2] >= TAIL_Z_START) continue;
  joints[vertex * 4] = tailRootIndex;
  weights[vertex * 4] = 1;
  for (let influence = 1; influence < 4; influence++) {
    joints[vertex * 4 + influence] = 0;
    weights[vertex * 4 + influence] = 0;
  }
  changed++;
}

console.log(`✅ 꼬리 강체 가중치 적용: ${changed.toLocaleString()} vertices`);

assertSkinWeights(document, primitive, json.skins[0].joints.length);
writeFileAtomic(GLB_PATH, glb);
