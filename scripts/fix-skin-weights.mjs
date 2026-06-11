/**
 * base.glb 스킨 웨이트 정리: 머리 정점에 번진 팔·어깨 본 가중치 제거.
 *
 * Meshy 자동 리깅이 목 없는 체형에서 거리 기반 가중치를 얼굴·귀까지
 * 퍼뜨려서(귀 끝 정점의 어깨 가중치 최대 0.5), 팔을 들면 얼굴이
 * 끌려가며 찌그러지는 문제가 있었습니다.
 *
 * 정책 (두 기준 중 강한 쪽 적용):
 * 1. 가중치 기준 — 머리 본(Head/head_end/headfront) 합 wHead ≥ 0.5면 전부
 *    제거, 0.25~0.5는 선형 테이퍼
 * 2. 높이 기준 — 바인드 포즈에서 팔은 아래로 내려가 있어 y 1.65m 위에
 *    팔 살점이 없으므로 y ≥ 1.65는 전부 제거, 1.45~1.65는 선형 테이퍼
 *    (얼굴 정점인데 머리 가중치가 0.5 미만이라 1번 기준을 빠져나가는
 *    정점들을 잡아냄 — 어깨 본이 얼굴 높이까지 0.5씩 번져 있었음)
 * - 제거 후 남은 가중치를 합 1로 재정규화
 *
 * WEIGHTS_0 버퍼를 GLB 안에서 제자리 패치하므로 다른 데이터는 바이트
 * 단위로 보존됩니다. 원본은 git 히스토리로 복구 가능.
 *
 * 사용법: node scripts/fix-skin-weights.mjs
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

const FULL_PURGE_HEAD_W = 0.5; // 머리 가중치가 이 이상이면 팔 가중치 전부 제거
const TAPER_START_HEAD_W = 0.25; // 여기서부터 선형 테이퍼 시작
const FULL_PURGE_Y = 1.65; // 이 높이(m) 위에는 팔 살점이 없음 — 전부 제거
const TAPER_START_Y = 1.45; // 여기서부터 선형 테이퍼 시작

const glb = fs.readFileSync(GLB_PATH);
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.slice(20, 20 + jsonLen).toString());
const binStart = 20 + jsonLen + 8;

const accessorRange = (i) => {
  const acc = json.accessors[i];
  const bv = json.bufferViews[acc.bufferView];
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
  return {
    offset: binStart + (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0),
    count: acc.count,
    n,
    componentType: acc.componentType,
  };
};

const mesh = json.meshes[0].primitives[0];
const jRange = accessorRange(mesh.attributes.JOINTS_0);
const wRange = accessorRange(mesh.attributes.WEIGHTS_0);
const pRange = accessorRange(mesh.attributes.POSITION);
if (wRange.componentType !== 5126)
  throw new Error("WEIGHTS_0가 float이 아닙니다");

const jointNames = json.skins[0].joints.map((j) => json.nodes[j].name);
const vertexCount = wRange.count;

// glb Buffer 위를 직접 읽고 쓰는 뷰 (제자리 패치)
const joints = new Uint8Array(glb.buffer, glb.byteOffset + jRange.offset, vertexCount * 4);
const weights = new Float32Array(glb.buffer, glb.byteOffset + wRange.offset, vertexCount * 4);
const positions = new Float32Array(glb.buffer, glb.byteOffset + pRange.offset, vertexCount * 3);

let touched = 0;
let purgedWeight = 0;
let maxArmBefore = 0;
const fullyPurged = new Set(); // 완전 제거(t=1) 대상 정점 — 사후 검증용

for (let v = 0; v < vertexCount; v++) {
  let wHead = 0;
  let wArm = 0;
  for (let k = 0; k < 4; k++) {
    const w = weights[v * 4 + k];
    if (!w) continue;
    const name = jointNames[joints[v * 4 + k]];
    if (HEAD_BONES.has(name)) wHead += w;
    else if (ARM_CHAIN.has(name)) wArm += w;
  }
  if (wArm === 0) continue;

  // 두 기준 중 강한 쪽 적용
  const tHead = Math.min(
    1,
    Math.max(
      0,
      (wHead - TAPER_START_HEAD_W) / (FULL_PURGE_HEAD_W - TAPER_START_HEAD_W),
    ),
  );
  const y = positions[v * 3 + 1];
  const tHeight = Math.min(
    1,
    Math.max(0, (y - TAPER_START_Y) / (FULL_PURGE_Y - TAPER_START_Y)),
  );
  const t = Math.max(tHead, tHeight);
  if (t === 0) continue;

  if (wArm > maxArmBefore) maxArmBefore = wArm;
  if (t === 1) fullyPurged.add(v);

  let removed = 0;
  for (let k = 0; k < 4; k++) {
    const w = weights[v * 4 + k];
    if (!w) continue;
    if (ARM_CHAIN.has(jointNames[joints[v * 4 + k]])) {
      const newW = w * (1 - t);
      removed += w - newW;
      weights[v * 4 + k] = newW;
    }
  }
  if (removed === 0) continue;

  // 남은 가중치 재정규화 (합 1)
  let sum = 0;
  for (let k = 0; k < 4; k++) sum += weights[v * 4 + k];
  if (sum > 1e-6) {
    for (let k = 0; k < 4; k++) weights[v * 4 + k] /= sum;
  }

  touched++;
  purgedWeight += removed;
}

fs.writeFileSync(GLB_PATH, glb);

console.log(`정점 ${vertexCount}개 중 ${touched}개 수정`);
console.log(`제거된 팔 가중치 총량: ${purgedWeight.toFixed(1)}, 수정 전 최대 팔 가중치: ${maxArmBefore.toFixed(3)}`);

// ── 사후 검증: 완전 제거 대상 정점의 잔여 팔 가중치 + 가중치 합 정규화 ──
let residualMax = 0;
let residualCount = 0;
for (let v = 0; v < vertexCount; v++) {
  let wArm = 0;
  let sum = 0;
  for (let k = 0; k < 4; k++) {
    const w = weights[v * 4 + k];
    sum += w;
    if (w && ARM_CHAIN.has(jointNames[joints[v * 4 + k]])) wArm += w;
  }
  if (Math.abs(sum - 1) > 1e-3) throw new Error(`정점 ${v} 가중치 합 ${sum}`);
  if (fullyPurged.has(v) && wArm > 1e-6) {
    residualCount++;
    if (wArm > residualMax) residualMax = wArm;
  }
}
if (residualCount > 0)
  throw new Error(
    `완전 제거 대상 ${residualCount}개 정점에 팔 가중치 잔존 (최대 ${residualMax})`,
  );
console.log("✅ 완전 제거 정점 잔여 0 + 가중치 합 정규화 검증 통과");
