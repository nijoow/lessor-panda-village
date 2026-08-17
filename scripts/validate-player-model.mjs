/**
 * 플레이어 리그/가중치/텍스처/애니메이션의 핵심 불변조건을 검사합니다.
 * 사용법: pnpm player:validate
 */
import fs from "node:fs";
import path from "node:path";

const SOURCE_BASE = "assets/player/source/base-rig-v3.glb";
const PUBLIC_DIR = "public/models/player";

const fail = (message) => {
  throw new Error(`플레이어 모델 검증 실패: ${message}`);
};

const parseGlb = (filePath) => {
  const glb = fs.readFileSync(filePath);
  if (glb.readUInt32LE(0) !== 0x46546c67 || glb.readUInt32LE(4) !== 2) {
    fail(`${filePath}가 GLB 2.0이 아님`);
  }
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString());
  const binHeader = 20 + jsonLength;
  const binLength = glb.readUInt32LE(binHeader);
  const binStart = binHeader + 8;
  return {
    glb,
    json,
    bin: glb.subarray(binStart, binStart + binLength),
  };
};

const accessorInfo = ({ json, bin }, index) => {
  const accessor = json.accessors[index];
  const view = json.bufferViews[accessor.bufferView];
  const elementBytes = { 5121: 1, 5122: 2, 5123: 2, 5126: 4 }[accessor.componentType];
  const elementCount = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
  if (!elementBytes || !elementCount) fail(`지원하지 않는 accessor 형식: ${accessor.componentType}/${accessor.type}`);
  return {
    accessor,
    data: new DataView(bin.buffer, bin.byteOffset, bin.byteLength),
    offset: (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0),
    stride: view.byteStride ?? elementBytes * elementCount,
    elementBytes,
    elementCount,
  };
};

const readComponent = (info, element, component) => {
  const offset = info.offset + element * info.stride + component * info.elementBytes;
  switch (info.accessor.componentType) {
    case 5121:
      return info.data.getUint8(offset);
    case 5122:
      return info.data.getInt16(offset, true);
    case 5123:
      return info.data.getUint16(offset, true);
    case 5126:
      return info.data.getFloat32(offset, true);
    default:
      fail(`지원하지 않는 componentType: ${info.accessor.componentType}`);
  }
};

const source = parseGlb(SOURCE_BASE);
const sourceNodes = source.json.nodes ?? [];
const sourceNodeNames = new Set(sourceNodes.map((node) => node.name).filter(Boolean));
const requiredBones = [
  "Hips",
  "Spine",
  "Spine01",
  "Spine02",
  "neck",
  "Head",
  "LeftShoulder",
  "RightShoulder",
  "LeftArm",
  "RightArm",
  "Tail1",
  "Tail2",
  "Tail3",
  "Tail4",
];
for (const bone of requiredBones) {
  if (!sourceNodeNames.has(bone)) fail(`소스 리그에 ${bone} 본이 없음`);
}

if ((source.json.skins?.length ?? 0) !== 1) fail("소스 스킨은 정확히 1개여야 함");
const skin = source.json.skins[0];
if (skin.joints.length !== 28) fail(`예상 본 28개, 실제 ${skin.joints.length}개`);

const meshNode = sourceNodes.find((node) => node.mesh !== undefined && node.skin !== undefined);
if (!meshNode) fail("소스에 스킨 메시 노드가 없음");
const primitive = source.json.meshes[meshNode.mesh].primitives[0];
for (const attribute of ["POSITION", "JOINTS_0", "WEIGHTS_0", "TEXCOORD_0"]) {
  if (primitive.attributes[attribute] === undefined) fail(`${attribute} 속성이 없음`);
}

const positionsInfo = accessorInfo(source, primitive.attributes.POSITION);
const jointsInfo = accessorInfo(source, primitive.attributes.JOINTS_0);
const weightsInfo = accessorInfo(source, primitive.attributes.WEIGHTS_0);
if (positionsInfo.accessor.componentType !== 5122 || !positionsInfo.accessor.normalized) {
  fail("소스 POSITION은 정규화 int16이어야 함");
}
if (jointsInfo.accessor.componentType !== 5121) fail("소스 JOINTS_0은 uint8이어야 함");
if (weightsInfo.accessor.componentType !== 5123 || !weightsInfo.accessor.normalized) {
  fail("소스 WEIGHTS_0은 정규화 uint16이어야 함");
}

const jointNames = skin.joints.map((nodeIndex) => sourceNodes[nodeIndex].name);
const tailRootIndex = jointNames.indexOf("Tail1");
const tailJointIndices = new Set(
  jointNames
    .map((name, index) => (name.startsWith("Tail") ? index : -1))
    .filter((index) => index >= 0),
);
let tailVertices = 0;
for (let vertex = 0; vertex < jointsInfo.accessor.count; vertex++) {
  const vertexJoints = [];
  const vertexWeights = [];
  let sum = 0;
  for (let influence = 0; influence < 4; influence++) {
    vertexJoints.push(readComponent(jointsInfo, vertex, influence));
    const weight = readComponent(weightsInfo, vertex, influence);
    vertexWeights.push(weight);
    sum += weight;
  }
  if (sum !== 65535) fail(`정규화되지 않은 가중치: vertex ${vertex}`);
  const hasTailInfluence = vertexJoints.some(
    (joint, influence) => vertexWeights[influence] > 0 && tailJointIndices.has(joint),
  );
  if (!hasTailInfluence) continue;
  tailVertices++;
  if (vertexJoints[0] !== tailRootIndex || vertexWeights[0] !== 65535) {
    fail(`꼬리 강체 가중치 위반: vertex ${vertex}`);
  }
  for (let influence = 1; influence < 4; influence++) {
    if (vertexWeights[influence] !== 0) fail(`꼬리에 혼합 가중치가 남음: vertex ${vertex}`);
  }
}
if (tailVertices < 10000) fail(`꼬리 정점 범위가 비정상적으로 작음: ${tailVertices}`);

const image = source.json.images?.[0];
if (!image || image.mimeType !== "image/webp") fail("소스 베이스컬러가 WebP가 아님");
const imageView = source.json.bufferViews[image.bufferView];
if (imageView.byteLength < 300_000) fail("소스 텍스처가 과압축되었을 가능성이 큼");

const runtimeBase = parseGlb(path.join(PUBLIC_DIR, "base.glb"));
const runtimeNames = new Set((runtimeBase.json.nodes ?? []).map((node) => node.name));
if (!runtimeBase.json.extensionsUsed?.includes("EXT_meshopt_compression")) {
  fail("런타임 base.glb에 Meshopt 압축이 없음");
}
const runtimeMeshNode = runtimeBase.json.nodes.find(
  (node) => node.mesh !== undefined && node.skin !== undefined,
);
if (!runtimeMeshNode) fail("런타임 스킨 메시가 없음");
const runtimePrimitive = runtimeBase.json.meshes[runtimeMeshNode.mesh].primitives[0];
const runtimeWeights = runtimeBase.json.accessors[runtimePrimitive.attributes.WEIGHTS_0];
if (runtimeWeights.componentType !== 5123 || !runtimeWeights.normalized) {
  fail("런타임 가중치가 12비트 이상 정밀도의 정규화 uint16이 아님");
}

const expectedAnimations = new Map([
  ["idle.glb", ["idle"]],
  ["walking.glb", ["Armature|walking_man|baselayer"]],
  ["running.glb", ["Armature|running|baselayer"]],
  ["sitting.glb", ["sit"]],
  ["emotes.glb", ["wave", "dance"]],
]);
for (const [file, expectedNames] of expectedAnimations) {
  const clip = parseGlb(path.join(PUBLIC_DIR, file));
  const names = (clip.json.animations ?? []).map((animation) => animation.name);
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
    fail(`${file} 애니메이션 이름 불일치: ${names.join(", ")}`);
  }
  for (const animation of clip.json.animations) {
    const targets = new Set();
    for (const channel of animation.channels) {
      const nodeName = clip.json.nodes[channel.target.node]?.name;
      if (!nodeName || !runtimeNames.has(nodeName)) fail(`${file}의 대상 본 ${nodeName}이 base에 없음`);
      const key = `${nodeName}:${channel.target.path}`;
      if (targets.has(key)) fail(`${file}에 중복 트랙 ${key}`);
      targets.add(key);
    }
  }
}

console.log(
  `✅ 플레이어 검증 통과: 본 ${skin.joints.length}개, 정점 ${positionsInfo.accessor.count.toLocaleString()}개, 꼬리 강체 정점 ${tailVertices.toLocaleString()}개`,
);
