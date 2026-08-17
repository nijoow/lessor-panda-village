/**
 * base.glb 스킨 웨이트 정리 2차: 등 뒤 오브젝트의 폴백 가중치 재할당.
 *
 * Meshy 자동 리깅이 등 뒤의 큰 부착물(약 2만 정점)과 엉덩이·허리 뒷면
 * 밴드(약 3천 정점)를 리깅하지 못하고 Hips/LeftLeg/RightLeg/Spine02에
 * 0.25씩 균등 분배하는 폴백을 적용해 두었습니다. LeftLeg/RightLeg는
 * 무릎 본이라, 걷기·앉기처럼 무릎이 굽는 동작마다 등 뒤 오브젝트가
 * 출렁이고 엉덩이가 무릎을 따라 무너집니다.
 *
 * 정책 (2단계):
 * 1. 폴백 재할당 — 폴백 시그니처 정점(위 4개 본이 모두 있고 각각
 *    0.15~0.35)을 찾아 — 양 무릎이 한 정점에 균등하게 들어가는 조합은
 *    유기적 스키닝에서 나올 수 없으므로 시그니처만으로 안전 판별 —
 *    다리 영향을 전부 제거하고, 바인드 포즈 높이(y) 기준으로 척추 체인
 *    Hips(0.611) → Spine02(0.822) → Spine01(1.034) → Spine(1.245)에
 *    구간 선형 블렌딩으로 재할당 (몸통 표면과 같은 방식의 그라디언트라
 *    몸과 맞닿는 경계에서 이질감이 없음)
 * 2. 무릎 높이 퍼지 — 폴백이 주변 정점으로 스무딩되며 번진 잔여물
 *    (상부 등판 y 0.8~1.4에 무릎 가중치 0.1~0.35 두 번째 봉우리)을
 *    높이 기준으로 제거. 무릎 본의 자연 영향은 y 0.7에서 소멸하므로
 *    y 0.65~0.80 선형 테이퍼, 0.80 이상 전부 제거 후 재정규화.
 *    (발/허벅지 본은 자연 분포만 존재해 건드리지 않음)
 * 3. 교차측 퍼지 — 반대쪽 다리 본 가중치(오른쪽 종아리 정점에 왼쪽
 *    무릎 w 최대 0.29 등 약 3,700건) 제거. 걷기에서 양다리가 반대
 *    위상으로 흔들릴 때 안쪽 다리 표면이 서로 끌려가는 원인.
 *    왼쪽 본은 x<0에서 x 0→-0.1 테이퍼, 오른쪽 본은 미러.
 *
 * JOINTS_0/WEIGHTS_0 버퍼를 GLB 안에서 제자리 패치하므로 다른 데이터는
 * 바이트 단위로 보존됩니다. 원본은 git 히스토리로 복구 가능.
 *
 * 사용법: node scripts/fix-fallback-weights.mjs
 */
import fs from "node:fs";

const GLB_PATH = "public/models/player/base.glb";

const FALLBACK_BONES = ["Hips", "LeftLeg", "RightLeg", "Spine02"];
const FALLBACK_W_MIN = 0.15;
const FALLBACK_W_MAX = 0.35;

// 재할당 대상 척추 체인 (아래에서 위 순서, y는 바인드 포즈 월드 높이 m)
const SPINE_CHAIN = [
  { name: "Hips", y: 0.611 },
  { name: "Spine02", y: 0.822 },
  { name: "Spine01", y: 1.034 },
  { name: "Spine", y: 1.245 },
];

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

const mesh = json.meshes[0].primitives[0];
const jRange = accessorRange(mesh.attributes.JOINTS_0);
const wRange = accessorRange(mesh.attributes.WEIGHTS_0);
const pRange = accessorRange(mesh.attributes.POSITION);
if (wRange.componentType !== 5126)
  throw new Error("WEIGHTS_0가 float이 아닙니다");
if (jRange.componentType !== 5121)
  throw new Error("JOINTS_0가 uint8이 아닙니다");

const jointNames = json.skins[0].joints.map((j) => json.nodes[j].name);
const jointIndexByName = new Map(jointNames.map((n, i) => [n, i]));
for (const b of SPINE_CHAIN)
  if (!jointIndexByName.has(b.name)) throw new Error(`본 없음: ${b.name}`);
const vertexCount = wRange.count;

const joints = new Uint8Array(glb.buffer, glb.byteOffset + jRange.offset, vertexCount * 4);
const weights = new Float32Array(glb.buffer, glb.byteOffset + wRange.offset, vertexCount * 4);
const positions = new Float32Array(glb.buffer, glb.byteOffset + pRange.offset, vertexCount * 3);

// y 높이 → 척추 체인 구간 선형 블렌딩 (본 인덱스·가중치 최대 2개 반환)
const spineBlend = (y) => {
  if (y <= SPINE_CHAIN[0].y)
    return [[jointIndexByName.get(SPINE_CHAIN[0].name), 1]];
  for (let i = 0; i < SPINE_CHAIN.length - 1; i++) {
    const lo = SPINE_CHAIN[i];
    const hi = SPINE_CHAIN[i + 1];
    if (y <= hi.y) {
      const t = (y - lo.y) / (hi.y - lo.y);
      return [
        [jointIndexByName.get(lo.name), 1 - t],
        [jointIndexByName.get(hi.name), t],
      ];
    }
  }
  return [[jointIndexByName.get(SPINE_CHAIN.at(-1).name), 1]];
};

const isFallback = (v) => {
  const found = new Set();
  for (let k = 0; k < 4; k++) {
    const w = weights[v * 4 + k];
    if (w < 1e-4) continue;
    const name = jointNames[joints[v * 4 + k]];
    if (!FALLBACK_BONES.includes(name)) return false;
    if (w < FALLBACK_W_MIN || w > FALLBACK_W_MAX) return false;
    found.add(name);
  }
  return found.size === 4;
};

let reassigned = 0;
for (let v = 0; v < vertexCount; v++) {
  if (!isFallback(v)) continue;
  const blend = spineBlend(positions[v * 3 + 1]);
  for (let k = 0; k < 4; k++) {
    joints[v * 4 + k] = blend[k]?.[0] ?? 0;
    weights[v * 4 + k] = blend[k]?.[1] ?? 0;
  }
  reassigned++;
}

// ── 2단계: 무릎 본 높이 퍼지 ──
const KNEE_BONES = new Set(["LeftLeg", "RightLeg"]);
const KNEE_TAPER_START_Y = 0.65;
const KNEE_FULL_PURGE_Y = 0.8;

let kneePurged = 0;
for (let v = 0; v < vertexCount; v++) {
  const y = positions[v * 3 + 1];
  const t = Math.min(
    1,
    Math.max(
      0,
      (y - KNEE_TAPER_START_Y) / (KNEE_FULL_PURGE_Y - KNEE_TAPER_START_Y),
    ),
  );
  if (t === 0) continue;

  let removed = 0;
  for (let k = 0; k < 4; k++) {
    const w = weights[v * 4 + k];
    if (!w) continue;
    if (KNEE_BONES.has(jointNames[joints[v * 4 + k]])) {
      const newW = w * (1 - t);
      removed += w - newW;
      weights[v * 4 + k] = newW;
    }
  }
  if (removed === 0) continue;

  let sum = 0;
  for (let k = 0; k < 4; k++) sum += weights[v * 4 + k];
  if (sum > 1e-6) {
    for (let k = 0; k < 4; k++) weights[v * 4 + k] /= sum;
  } else {
    // 무릎에만 묶여 있던 정점 — 척추 체인으로 재할당
    const blend = spineBlend(y);
    for (let k = 0; k < 4; k++) {
      joints[v * 4 + k] = blend[k]?.[0] ?? 0;
      weights[v * 4 + k] = blend[k]?.[1] ?? 0;
    }
  }
  kneePurged++;
}

// ── 3단계: 교차측 다리 본 퍼지 ──
// 왼쪽 다리 본이 몸 오른쪽(x<0) 정점에 주는 영향 제거 (미러 동일)
const CROSS_TAPER_X = 0.1; // |x| 0 → 0.1 선형 테이퍼, 그 너머 전부 제거
const sideOfBone = (name) =>
  name === "LeftLeg" || name === "LeftUpLeg"
    ? 1
    : name === "RightLeg" || name === "RightUpLeg"
      ? -1
      : 0;

let crossPurged = 0;
for (let v = 0; v < vertexCount; v++) {
  const x = positions[v * 3];

  let removed = 0;
  for (let k = 0; k < 4; k++) {
    const w = weights[v * 4 + k];
    if (!w) continue;
    const side = sideOfBone(jointNames[joints[v * 4 + k]]);
    if (side === 0) continue;
    const cross = -side * x; // 반대쪽으로 넘어간 거리 (>0이면 교차)
    const t = Math.min(1, Math.max(0, cross / CROSS_TAPER_X));
    if (t === 0) continue;
    const newW = w * (1 - t);
    removed += w - newW;
    weights[v * 4 + k] = newW;
  }
  if (removed === 0) continue;

  let sum = 0;
  for (let k = 0; k < 4; k++) sum += weights[v * 4 + k];
  if (sum > 1e-6) {
    for (let k = 0; k < 4; k++) weights[v * 4 + k] /= sum;
  } else {
    const blend = spineBlend(positions[v * 3 + 1]);
    for (let k = 0; k < 4; k++) {
      joints[v * 4 + k] = blend[k]?.[0] ?? 0;
      weights[v * 4 + k] = blend[k]?.[1] ?? 0;
    }
  }
  crossPurged++;
}

fs.writeFileSync(GLB_PATH, glb);
console.log(
  `정점 ${vertexCount}개 중 폴백 재할당 ${reassigned}개, 무릎 퍼지 ${kneePurged}개, 교차측 퍼지 ${crossPurged}개`,
);

// ── 사후 검증 ──
// 1. 모든 정점 가중치 합 1  2. 등 뒤(z<-0.4) 깊은 영역에 다리 가중치 잔존 없음
const LEG_BONES = new Set([
  "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase",
  "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase",
]);
let deepBackLeg = 0;
for (let v = 0; v < vertexCount; v++) {
  let sum = 0;
  for (let k = 0; k < 4; k++) sum += weights[v * 4 + k];
  if (Math.abs(sum - 1) > 1e-3) throw new Error(`정점 ${v} 가중치 합 ${sum}`);
  if (positions[v * 3 + 2] < -0.4) {
    for (let k = 0; k < 4; k++) {
      if (
        weights[v * 4 + k] > 1e-4 &&
        LEG_BONES.has(jointNames[joints[v * 4 + k]])
      )
        deepBackLeg++;
    }
  }
}
if (deepBackLeg > 0)
  throw new Error(`등 뒤 깊은 영역에 다리 가중치 잔존: ${deepBackLeg}건`);
let residualFallback = 0;
for (let v = 0; v < vertexCount; v++) if (isFallback(v)) residualFallback++;
if (residualFallback > 0)
  throw new Error(`폴백 시그니처 잔존: ${residualFallback}개 정점`);
let highKnee = 0;
for (let v = 0; v < vertexCount; v++) {
  if (positions[v * 3 + 1] < KNEE_FULL_PURGE_Y) continue;
  for (let k = 0; k < 4; k++) {
    if (
      weights[v * 4 + k] > 1e-4 &&
      KNEE_BONES.has(jointNames[joints[v * 4 + k]])
    )
      highKnee++;
  }
}
if (highKnee > 0)
  throw new Error(`y≥${KNEE_FULL_PURGE_Y} 무릎 가중치 잔존: ${highKnee}건`);
let crossResidual = 0;
for (let v = 0; v < vertexCount; v++) {
  const x = positions[v * 3];
  for (let k = 0; k < 4; k++) {
    if (weights[v * 4 + k] < 1e-4) continue;
    const side = sideOfBone(jointNames[joints[v * 4 + k]]);
    if (side !== 0 && -side * x >= CROSS_TAPER_X) crossResidual++;
  }
}
if (crossResidual > 0)
  throw new Error(`교차측 다리 가중치 잔존: ${crossResidual}건`);
console.log(
  "✅ 가중치 합 정규화 + 폴백 전무 + 상체 무릎 영향 전무 + 교차측 전무 검증 통과",
);
