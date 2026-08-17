/**
 * base.glb 스킨 웨이트 정리 3차: 얼굴에 남은 어깨·팔 가중치 완전 제거.
 *
 * 이전 정리(fix-skin-weights.mjs)는 머리 가중치 0.5 이상 또는 y 1.65
 * 이상만 퍼지해서, 볼·턱처럼 머리 가중치 0.05~0.5인 경계 정점 약
 * 7,500개에 어깨 가중치(최대 0.74)가 남아 있었습니다. 걷기·달리기
 * 클립이 어깨를 크게 내리면 얼굴이 통째로 딸려 내려가는 원인.
 *
 * 정책: 머리 본(Head/head_end/headfront) 가중치 합이 0.05를 넘거나,
 * 얼굴 전면 영역(z>0.5, y>1.15)에 있으면 어깨·팔 체인 가중치를 전부
 * 제거하고 재정규화 — 남은 가중치(Head/neck/Spine)가 자리를 이어받음.
 * 어깨는 해부학적으로 머리 경계를 넘을 이유가 없다.
 *
 * 사용법: node scripts/fix-face-weights.mjs   (비압축 base.glb 전제)
 */
import fs from "node:fs";

const GLB_PATH = "public/models/player/base.glb";

const ARM_CHAIN = new Set([
  "LeftShoulder",
  "RightShoulder",
  "LeftArm",
  "RightArm",
  "LeftForeArm",
  "RightForeArm",
  "LeftHand",
  "RightHand",
]);
const HEAD_BONES = new Set(["Head", "head_end", "headfront"]);
const HEAD_W_THRESHOLD = 0.05;
const FACE_Z = 0.5;
const FACE_Y = 1.15;

const glb = fs.readFileSync(GLB_PATH);
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.slice(20, 20 + jsonLen).toString());
const binStart = 20 + jsonLen + 8;

const accessorRange = (i) => {
  const acc = json.accessors[i];
  const bv = json.bufferViews[acc.bufferView];
  return {
    offset: binStart + (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0),
    count: acc.count,
    componentType: acc.componentType,
  };
};

const prim = json.meshes[0].primitives[0];
const jR = accessorRange(prim.attributes.JOINTS_0);
const wR = accessorRange(prim.attributes.WEIGHTS_0);
const pR = accessorRange(prim.attributes.POSITION);
if (wR.componentType !== 5126) throw new Error("WEIGHTS_0가 float이 아님");

const jointNames = json.skins[0].joints.map((j) => json.nodes[j].name);
const vCount = wR.count;
const joints = new Uint8Array(glb.buffer, glb.byteOffset + jR.offset, vCount * 4);
const weights = new Float32Array(glb.buffer, glb.byteOffset + wR.offset, vCount * 4);
const positions = new Float32Array(glb.buffer, glb.byteOffset + pR.offset, vCount * 3);

let purged = 0;
for (let v = 0; v < vCount; v++) {
  let wHead = 0;
  let wArm = 0;
  for (let k = 0; k < 4; k++) {
    const w = weights[v * 4 + k];
    if (!w) continue;
    const nm = jointNames[joints[v * 4 + k]];
    if (HEAD_BONES.has(nm)) wHead += w;
    else if (ARM_CHAIN.has(nm)) wArm += w;
  }
  if (wArm === 0) continue;

  const y = positions[v * 3 + 1];
  const z = positions[v * 3 + 2];
  const isFace = z > FACE_Z && y > FACE_Y;
  if (wHead < HEAD_W_THRESHOLD && !isFace) continue;

  let sum = 0;
  for (let k = 0; k < 4; k++) {
    if (ARM_CHAIN.has(jointNames[joints[v * 4 + k]])) weights[v * 4 + k] = 0;
    sum += weights[v * 4 + k];
  }
  if (sum > 1e-6) {
    for (let k = 0; k < 4; k++) weights[v * 4 + k] /= sum;
  } else {
    // 어깨에만 묶여 있던 정점 — 머리에 귀속
    const headIdx = jointNames.indexOf("Head");
    joints[v * 4] = headIdx;
    weights[v * 4] = 1;
    for (let k = 1; k < 4; k++) weights[v * 4 + k] = 0;
  }
  purged++;
}

fs.writeFileSync(GLB_PATH, glb);
console.log(`얼굴/머리 경계 정점 ${purged}개에서 어깨·팔 가중치 제거`);

// 검증: 조건 대상에 팔 체인 잔존 없음 + 합 정규화
for (let v = 0; v < vCount; v++) {
  let wHead = 0, wArm = 0, sum = 0;
  for (let k = 0; k < 4; k++) {
    const w = weights[v * 4 + k];
    sum += w;
    if (!w) continue;
    const nm = jointNames[joints[v * 4 + k]];
    if (HEAD_BONES.has(nm)) wHead += w;
    else if (ARM_CHAIN.has(nm)) wArm += w;
  }
  if (Math.abs(sum - 1) > 1e-3) throw new Error(`정점 ${v} 가중치 합 ${sum}`);
  const y = positions[v * 3 + 1];
  const z = positions[v * 3 + 2];
  if ((wHead >= HEAD_W_THRESHOLD || (z > FACE_Z && y > FACE_Y)) && wArm > 1e-6)
    throw new Error(`정점 ${v}에 팔 체인 잔존 (wArm ${wArm})`);
}
console.log("✅ 얼굴 어깨 격리 + 가중치 정규화 검증 통과");
