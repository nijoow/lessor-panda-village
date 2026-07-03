/**
 * base.glb에 꼬리 본 체인(Tail1~4)을 추가하고 꼬리를 리스키닝합니다.
 *
 * Meshy 스켈레톤에는 꼬리 본이 없어 꼬리(약 1.9만 정점, z<-0.12)가
 * 높이 기반으로 척추 체인에 나뉘어 묶여 있었습니다. 그 결과 걷기 등
 * 척추가 움직이는 동작마다 꼬리가 층별로 찢어지고, 앉기 포즈에서
 * 꼬리를 움직일 방법 자체가 없었습니다.
 *
 * 작업:
 * 1. 꼬리 중심선(z 슬라이스별 y 무게중심)을 따라 Tail1~4 본을 배치
 *    (Tail1은 Hips의 자식, 월드 회전은 항등 — X회전=상하, Y회전=좌우)
 * 2. 꼬리 정점을 z 파라미터 기준 인접 본 선형 블렌딩으로 리스키닝.
 *    뿌리(z -0.12~-0.30)는 기존 척추 블렌딩과 교차 페이드해 몸통
 *    경계에 이음새가 생기지 않게 함
 * 3. skin.joints·IBM 확장 (새 IBM 영역을 BIN 끝에 추가 — 옛 영역은
 *    이후 gltf-transform prune이 정리)
 *
 * 사용법: node scripts/add-tail-rig.mjs   (비압축 base.glb 전제)
 */
import fs from "node:fs";

const GLB_PATH = "public/models/player/base.glb";

const TAIL_Z_START = -0.12; // 이보다 뒤(z<)는 꼬리
const ROOT_BLEND_Z = -0.3; // -0.12~-0.30 구간은 몸통 가중치와 교차 페이드
const TAIL_BONES = ["Tail1", "Tail2", "Tail3", "Tail4"];
const TAIL_BONE_Z = [-0.15, -0.55, -0.95, -1.25]; // 본 배치 z (중심선 위)

// 척추 체인 (fix-fallback-weights.mjs와 동일한 y 블렌딩용)
const SPINE_CHAIN = [
  { name: "Hips", y: 0.611 },
  { name: "Spine02", y: 0.822 },
  { name: "Spine01", y: 1.034 },
  { name: "Spine", y: 1.245 },
];

// ---------- GLB 파싱 ----------
const glb = fs.readFileSync(GLB_PATH);
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.slice(20, 20 + jsonLen).toString());
const binLen = glb.readUInt32LE(20 + jsonLen);
const binStart = 20 + jsonLen + 8;
const bin = Buffer.from(glb.slice(binStart, binStart + binLen)); // 사본 (수정 대상)

const accessorRange = (i) => {
  const acc = json.accessors[i];
  const bv = json.bufferViews[acc.bufferView];
  return {
    offset: (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0),
    count: acc.count,
    componentType: acc.componentType,
  };
};

const prim = json.meshes[0].primitives[0];
const jR = accessorRange(prim.attributes.JOINTS_0);
const wR = accessorRange(prim.attributes.WEIGHTS_0);
const pR = accessorRange(prim.attributes.POSITION);
if (wR.componentType !== 5126) throw new Error("WEIGHTS_0가 float이 아님 (압축본?)");
if (jR.componentType !== 5121) throw new Error("JOINTS_0가 uint8이 아님");

const vCount = pR.count;
const joints = new Uint8Array(bin.buffer, bin.byteOffset + jR.offset, vCount * 4);
const weights = new Float32Array(bin.buffer, bin.byteOffset + wR.offset, vCount * 4);
const positions = new Float32Array(bin.buffer, bin.byteOffset + pR.offset, vCount * 3);

// ---------- 쿼터니언/행렬 유틸 ----------
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
const qrot = (q, v) => {
  const u = [q[0], q[1], q[2]];
  const w = q[3];
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const uu = u[0] ** 2 + u[1] ** 2 + u[2] ** 2;
  const cr = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  return [
    2 * dot * u[0] + (w * w - uu) * v[0] + 2 * w * cr[0],
    2 * dot * u[1] + (w * w - uu) * v[1] + 2 * w * cr[1],
    2 * dot * u[2] + (w * w - uu) * v[2] + 2 * w * cr[2],
  ];
};

// ---------- Hips 월드 트랜스폼 (위치·회전·누적 스케일) ----------
const nodes = json.nodes;
const parentOf = new Map();
nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parentOf.set(c, i)));
const hipsIdx = nodes.findIndex((n) => n.name === "Hips");

const worldOf = (idx) => {
  // 균등 스케일 가정 (Armature 0.01 외 스케일 없음 — 검증됨)
  let chain = [];
  for (let cur = idx; cur !== undefined; cur = parentOf.get(cur)) chain.unshift(cur);
  let pos = [0, 0, 0], rot = [0, 0, 0, 1], scl = 1;
  for (const i of chain) {
    const n = nodes[i];
    const t = n.translation ?? [0, 0, 0];
    const r = n.rotation ?? [0, 0, 0, 1];
    const s = (n.scale ?? [1, 1, 1])[0];
    const scaled = t.map((v) => v * scl);
    const rotated = qrot(rot, scaled);
    pos = pos.map((v, k) => v + rotated[k]);
    rot = qmul(rot, r);
    const l = Math.hypot(...rot);
    rot = rot.map((v) => v / l);
    scl *= s;
  }
  return { pos, rot, scl };
};
// ---------- 1. 꼬리 중심선에서 본 월드 위치 산출 ----------
const centroidY = (zTarget) => {
  let sum = 0, n = 0;
  for (let v = 0; v < vCount; v++) {
    const z = positions[v * 3 + 2];
    if (Math.abs(z - zTarget) > 0.12) continue;
    if (z >= TAIL_Z_START) continue;
    sum += positions[v * 3 + 1];
    n++;
  }
  return n ? sum / n : 0.8;
};
const tailWorldPos = TAIL_BONE_Z.map((z) => [0, centroidY(z), z]);
console.log("꼬리 본 월드 배치:");
tailWorldPos.forEach((p, i) =>
  console.log(`  ${TAIL_BONES[i]}: (${p.map((v) => v.toFixed(2)).join(", ")})`),
);

// ---------- 2. 노드 추가 (Tail1은 Hips 자식, 이후 체인) ----------
// 월드 회전 = 항등이 되도록 로컬 회전 = 부모 월드 회전의 켤레
const newNodeIndices = [];
let parentIdx = hipsIdx;
for (let i = 0; i < TAIL_BONES.length; i++) {
  const pw = worldOf(parentIdx);
  const targetW = tailWorldPos[i];
  const dp = targetW.map((v, k) => v - pw.pos[k]);
  const localT = qrot(qconj(pw.rot), dp).map((v) => v / pw.scl);
  const localR = qconj(pw.rot); // 부모 회전 상쇄 → 월드 항등 (부모가 항등이면 항등)
  const idx = nodes.length;
  nodes.push({ name: TAIL_BONES[i], translation: localT, rotation: localR });
  (nodes[parentIdx].children ??= []).push(idx);
  parentOf.set(idx, parentIdx);
  newNodeIndices.push(idx);
  parentIdx = idx;
}

// ---------- 3. skin.joints 확장 + 새 IBM 영역 ----------
const skin = json.skins[0];
const oldJointCount = skin.joints.length;
skin.joints.push(...newNodeIndices);
const jointCount = skin.joints.length;

// 기존 IBM 읽기
const ibmR = accessorRange(skin.inverseBindMatrices);
const oldIbm = new Float32Array(bin.buffer, bin.byteOffset + ibmR.offset, oldJointCount * 16);

// 새 IBM = 각 조인트 월드 행렬의 역 (균등 스케일 rigid)
const ibmOf = (idx) => {
  const w = worldOf(idx);
  const s = 1 / w.scl;
  const r = qconj(w.rot);
  // M⁻¹ = S⁻¹ R⁻¹ T⁻¹  (열 우선 4x4)
  const rp = qrot(r, w.pos.map((v) => -v)).map((v) => v * s);
  const x = qrot(r, [1, 0, 0]).map((v) => v * s);
  const y = qrot(r, [0, 1, 0]).map((v) => v * s);
  const z = qrot(r, [0, 0, 1]).map((v) => v * s);
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, rp[0], rp[1], rp[2], 1];
};

const newIbm = new Float32Array(jointCount * 16);
newIbm.set(oldIbm, 0);
newNodeIndices.forEach((nodeIdx, i) => {
  newIbm.set(ibmOf(nodeIdx), (oldJointCount + i) * 16);
});

// BIN 끝에 IBM 추가 (4바이트 정렬)
const pad = (4 - (bin.length % 4)) % 4;
const ibmBuf = Buffer.from(newIbm.buffer);
const newBin = Buffer.concat([bin, Buffer.alloc(pad), ibmBuf]);
json.bufferViews.push({
  buffer: 0,
  byteOffset: bin.length + pad,
  byteLength: ibmBuf.length,
});
json.accessors.push({
  bufferView: json.bufferViews.length - 1,
  componentType: 5126,
  count: jointCount,
  type: "MAT4",
});
skin.inverseBindMatrices = json.accessors.length - 1;
json.buffers[0].byteLength = newBin.length;

// ---------- 4. 꼬리 리스키닝 ----------
const jointIndexByName = new Map(skin.joints.map((j, i) => [nodes[j].name, i]));
const spineBlend = (y) => {
  if (y <= SPINE_CHAIN[0].y) return [[jointIndexByName.get(SPINE_CHAIN[0].name), 1]];
  for (let i = 0; i < SPINE_CHAIN.length - 1; i++) {
    const lo = SPINE_CHAIN[i], hi = SPINE_CHAIN[i + 1];
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
const tailBlend = (z) => {
  if (z >= TAIL_BONE_Z[0]) return [[jointIndexByName.get(TAIL_BONES[0]), 1]];
  for (let i = 0; i < TAIL_BONE_Z.length - 1; i++) {
    const lo = TAIL_BONE_Z[i], hi = TAIL_BONE_Z[i + 1];
    if (z >= hi) {
      const t = (z - lo) / (hi - lo);
      return [
        [jointIndexByName.get(TAIL_BONES[i]), 1 - t],
        [jointIndexByName.get(TAIL_BONES[i + 1]), t],
      ];
    }
  }
  return [[jointIndexByName.get(TAIL_BONES.at(-1)), 1]];
};

let reskinned = 0;
for (let v = 0; v < vCount; v++) {
  const y = positions[v * 3 + 1];
  const z = positions[v * 3 + 2];
  if (z >= TAIL_Z_START) continue;

  // 뿌리 교차 페이드: z -0.12(몸통 100%) → -0.30(꼬리 100%)
  const tTail = Math.min(1, (TAIL_Z_START - z) / (TAIL_Z_START - ROOT_BLEND_Z));
  const entries = [];
  for (const [ji, w] of tailBlend(z)) entries.push([ji, w * tTail]);
  if (tTail < 1) {
    for (const [ji, w] of spineBlend(y)) entries.push([ji, w * (1 - tTail)]);
  }
  entries.sort((a, b) => b[1] - a[1]);
  for (let k = 0; k < 4; k++) {
    joints[v * 4 + k] = entries[k]?.[0] ?? 0;
    weights[v * 4 + k] = entries[k]?.[1] ?? 0;
  }
  reskinned++;
}
console.log(`꼬리 리스키닝: ${reskinned}개 정점`);

// ---------- GLB 재조립 ----------
const jsonBuf = Buffer.from(JSON.stringify(json));
const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
const jsonChunk = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]);
const binPad = (4 - (newBin.length % 4)) % 4;
const binChunk = Buffer.concat([newBin, Buffer.alloc(binPad)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonChunk.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(binChunk.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(
  GLB_PATH,
  Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]),
);

// ---------- 검증 ----------
// 1. 가중치 합  2. 꼬리 깊은 곳(z<-0.4)은 꼬리 본만  3. IBM 정합성
for (let v = 0; v < vCount; v++) {
  let sum = 0;
  for (let k = 0; k < 4; k++) sum += weights[v * 4 + k];
  if (Math.abs(sum - 1) > 1e-3) throw new Error(`정점 ${v} 가중치 합 ${sum}`);
}
const tailSet = new Set(TAIL_BONES.map((n) => jointIndexByName.get(n)));
for (let v = 0; v < vCount; v++) {
  if (positions[v * 3 + 2] >= -0.4) continue;
  for (let k = 0; k < 4; k++) {
    if (weights[v * 4 + k] > 1e-4 && !tailSet.has(joints[v * 4 + k]))
      throw new Error(`z<-0.4 정점 ${v}에 비꼬리 본 잔존`);
  }
}
const mat4Mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
const mat4FromWorld = ({ pos, rot, scl }) => {
  const x = qrot(rot, [scl, 0, 0]);
  const y = qrot(rot, [0, scl, 0]);
  const z = qrot(rot, [0, 0, scl]);
  return [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, pos[0], pos[1], pos[2], 1];
};
let worstErr = 0;
let worstBone = "";
skin.joints.forEach((nodeIdx, ji) => {
  const m = mat4FromWorld(worldOf(nodeIdx));
  const ibm = Array.from(newIbm.slice(ji * 16, ji * 16 + 16));
  const prod = mat4Mul(m, ibm);
  let err = 0;
  for (let k = 0; k < 16; k++)
    err = Math.max(err, Math.abs(prod[k] - (k % 5 === 0 ? 1 : 0)));
  if (err > worstErr) {
    worstErr = err;
    worstBone = nodes[nodeIdx].name;
  }
});
if (worstErr > 1e-3)
  throw new Error(`IBM 정합 오차 ${worstErr} (${worstBone})`);
console.log(
  `✅ 본 ${jointCount}개(꼬리 4 추가), 가중치 정규화·꼬리 격리·IBM 정합 검증 통과`,
);
