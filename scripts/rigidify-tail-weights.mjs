/**
 * 최적화 전 base.glb에서 꼬리 정점을 Tail1에 강체 가중합니다.
 * 분절된 Meshy 꼬리에 여러 본을 섞을 때 생기는 찌그러짐을 막는 소스 제작 도구입니다.
 */
import fs from "node:fs";

const GLB_PATH = "public/models/player/base.glb";
const TAIL_Z_START = -0.12;

const glb = fs.readFileSync(GLB_PATH);
const jsonLength = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
const binStart = 20 + jsonLength + 8;
const meshNode = json.nodes.find((node) => node.mesh !== undefined && node.skin !== undefined);
if (!meshNode) throw new Error("스킨 메시 노드가 없음");
const primitive = json.meshes[meshNode.mesh].primitives[0];

const range = (accessorIndex) => {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  return {
    offset: binStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0),
    count: accessor.count,
    componentType: accessor.componentType,
  };
};

const positionRange = range(primitive.attributes.POSITION);
const jointRange = range(primitive.attributes.JOINTS_0);
const weightRange = range(primitive.attributes.WEIGHTS_0);
if (positionRange.componentType !== 5126) throw new Error("POSITION은 최적화 전 float여야 함");
if (jointRange.componentType !== 5121) throw new Error("JOINTS_0은 최적화 전 uint8이어야 함");
if (weightRange.componentType !== 5126) throw new Error("WEIGHTS_0은 최적화 전 float여야 함");

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

fs.writeFileSync(GLB_PATH, glb);
console.log(`✅ 꼬리 강체 가중치 적용: ${changed.toLocaleString()} vertices`);
