/**
 * base.glb의 스켈레톤에 네이티브로 맞는 "sit" 애니메이션 클립 GLB를 생성합니다.
 *
 * 외부 클립 리타게팅은 본 이름·휴식 포즈 불일치로 몸이 일그러지므로,
 * 이 스크립트는 base.glb의 휴식 포즈를 읽어 월드 프레임 델타 회전을
 * FK로 로컬 쿼터니언에 역산하는 방식으로 키프레임을 직접 작성합니다.
 *
 * 사용법: node scripts/generate-sit-clip.mjs
 * 출력:   public/models/player/sitting.glb (본 계층 + 애니메이션만, 메시 없음)
 */
import fs from "node:fs";
import path from "node:path";

const BASE_PATH = "public/models/player/base.glb";
const OUT_PATH = "public/models/player/sitting.glb";
const CLIP_NAME = "sit";
const DURATION = 3.2; // 호흡 루프 주기 (초)
const KEY_COUNT = 9; // 루프 보간용 키프레임 수 (첫/끝 동일)

// ---------- 쿼터니언/벡터 유틸 ([x, y, z, w]) ----------
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
const qnorm = (q) => {
  const l = Math.hypot(...q);
  return q.map((v) => v / l);
};
const axisAngle = (axis, deg) => {
  const half = (deg * Math.PI) / 360;
  const s = Math.sin(half);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
};
const X = [1, 0, 0];
const Z = [0, 0, 1];
const IDENTITY = [0, 0, 0, 1];

// ---------- base.glb에서 본 계층·휴식 포즈 읽기 ----------
const glb = fs.readFileSync(BASE_PATH);
const jsonLen = glb.readUInt32LE(12);
const baseJson = JSON.parse(glb.slice(20, 20 + jsonLen).toString());

const srcNodes = baseJson.nodes;
const childSet = new Set();
srcNodes.forEach((n) => (n.children ?? []).forEach((c) => childSet.add(c)));
const armatureIdx = srcNodes.findIndex((n) => n.name === "Armature");
if (armatureIdx < 0) throw new Error("Armature 노드를 찾을 수 없습니다");

// Armature 서브트리에서 메시 노드(char1)를 제외한 본만 수집
const bones = []; // { name, parent(이름), t, r, s }
const collect = (idx, parentName) => {
  const n = srcNodes[idx];
  if (n.mesh !== undefined) return;
  bones.push({
    name: n.name,
    parent: parentName,
    t: n.translation ?? [0, 0, 0],
    r: n.rotation ?? [0, 0, 0, 1],
    s: n.scale ?? [1, 1, 1],
  });
  (n.children ?? []).forEach((c) => collect(c, n.name));
};
collect(armatureIdx, null);

const boneByName = new Map(bones.map((b) => [b.name, b]));

// 휴식 포즈의 월드 회전 (FK)
const restWorld = new Map();
for (const b of bones) {
  const parentQ = b.parent ? restWorld.get(b.parent) : IDENTITY;
  restWorld.set(b.name, qnorm(qmul(parentQ, b.r)));
}

// ---------- 앉기 포즈 정의 (월드 프레임 델타, 캐릭터는 +Z를 바라봄) ----------
// 월드 X축 음수 회전 = 해당 부위가 앞(+Z)으로 접힘
const SIT_POSE = {
  Hips: axisAngle(X, -8), // 골반 살짝 뒤로 기울여 기대는 느낌
  LeftUpLeg: axisAngle(X, -86), // 허벅지를 앞으로 접기
  RightUpLeg: axisAngle(X, -86),
  LeftLeg: axisAngle(X, -12), // 정강이는 거의 수직, 살짝 앞으로 대롱
  RightLeg: axisAngle(X, -12),
  Spine02: axisAngle(X, 7), // 척추는 앞으로 살짝 말아 편안한 슬라우치
  Spine01: axisAngle(X, 5),
  Spine: axisAngle(X, 3),
  neck: axisAngle(X, -6), // 고개는 들어서 정면 유지
  Head: axisAngle(X, -9),
  LeftArm: axisAngle(Z, -34), // 팔을 몸쪽으로 내림
  RightArm: axisAngle(Z, 34),
  LeftForeArm: qmul(axisAngle(X, -48), axisAngle(Z, -10)), // 손을 무릎 위로
  RightForeArm: qmul(axisAngle(X, -48), axisAngle(Z, 10)),
};

// 앉은 높이: 엉덩이를 휴식 높이에서 살짝 내려 좌석에 밀착 (cm 단위)
const HIPS_SIT_Y_OFFSET = -7;

// ---------- 호흡 모션 (시간에 따른 추가 월드 델타) ----------
// phase: 0~1 루프 진행도. 진폭이 작아 슬러프 보간으로 자연스럽게 이어짐
const breathDelta = (boneName, phase) => {
  const breath = Math.sin(phase * Math.PI * 2);
  switch (boneName) {
    case "Spine02":
      return axisAngle(X, breath * 2.2);
    case "Spine":
      return axisAngle(X, breath * 1.2);
    case "Head":
      // 호흡과 살짝 어긋난 위상으로 고개가 미세하게 끄덕임
      return axisAngle(X, Math.sin(phase * Math.PI * 2 - 0.6) * 2.0);
    case "LeftArm":
      return axisAngle(Z, breath * -1.5);
    case "RightArm":
      return axisAngle(Z, breath * 1.5);
    default:
      return null;
  }
};

// ---------- 키프레임별 로컬 쿼터니언 계산 ----------
// desiredWorld = delta ⊗ restWorld 를 위에서부터 내려가며
// posedLocal = inv(parentDesiredWorld) ⊗ desiredWorld 로 역산
const times = Array.from(
  { length: KEY_COUNT },
  (_, i) => (i / (KEY_COUNT - 1)) * DURATION,
);

/** boneName -> Float 배열(키프레임 × 4) */
const rotationTracks = new Map(bones.map((b) => [b.name, []]));
/** Hips 위치 트랙 (키프레임 × 3) */
const hipsTranslations = [];

for (let k = 0; k < KEY_COUNT; k++) {
  // 첫/끝 키 동일 보장을 위해 phase는 0~1 순환
  const phase = k / (KEY_COUNT - 1);
  const desiredWorld = new Map();

  for (const b of bones) {
    let delta = SIT_POSE[b.name] ?? IDENTITY;
    const breath = breathDelta(b.name, phase);
    if (breath) delta = qmul(breath, delta);

    const world = qnorm(qmul(delta, restWorld.get(b.name)));
    desiredWorld.set(b.name, world);

    const parentWorld = b.parent ? desiredWorld.get(b.parent) : IDENTITY;
    const local = qnorm(qmul(qconj(parentWorld), world));
    rotationTracks.get(b.name).push(...local);
  }

  const hips = boneByName.get("Hips");
  hipsTranslations.push(hips.t[0], hips.t[1] + HIPS_SIT_Y_OFFSET, hips.t[2]);
}

// ---------- 검증: 첫 키프레임 포즈를 FK로 월드 좌표 출력 ----------
{
  const posedLocalAt0 = new Map(
    bones.map((b) => [b.name, rotationTracks.get(b.name).slice(0, 4)]),
  );
  const qrot = (q, v) => {
    const u = [q[0], q[1], q[2]];
    const w = q[3];
    const dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
    const cross = (a, c) => [
      a[1] * c[2] - a[2] * c[1],
      a[2] * c[0] - a[0] * c[2],
      a[0] * c[1] - a[1] * c[0],
    ];
    const t1 = u.map((c) => c * 2 * dot(u, v));
    const t2 = v.map((c) => c * (w * w - dot(u, u)));
    const t3 = cross(u, v).map((c) => c * 2 * w);
    return [t1[0] + t2[0] + t3[0], t1[1] + t2[1] + t3[1], t1[2] + t2[2] + t3[2]];
  };
  const worldPos = new Map();
  const worldQ = new Map();
  const worldS = new Map();
  for (const b of bones) {
    const pPos = b.parent ? worldPos.get(b.parent) : [0, 0, 0];
    const pQ = b.parent ? worldQ.get(b.parent) : IDENTITY;
    const pS = b.parent ? worldS.get(b.parent) : [1, 1, 1];
    const t =
      b.name === "Hips"
        ? [b.t[0], b.t[1] + HIPS_SIT_Y_OFFSET, b.t[2]]
        : b.t;
    const scaled = t.map((v, i) => v * pS[i]);
    const rotated = qrot(pQ, scaled);
    worldPos.set(b.name, rotated.map((v, i) => pPos[i] + v));
    worldQ.set(b.name, qnorm(qmul(pQ, posedLocalAt0.get(b.name))));
    worldS.set(b.name, b.s.map((v, i) => v * pS[i]));
  }
  console.log("── 앉기 포즈 월드 좌표 검증 (단위: m) ──");
  for (const name of [
    "Hips",
    "LeftUpLeg",
    "LeftLeg",
    "LeftFoot",
    "LeftToeBase",
    "Spine",
    "Head",
    "LeftHand",
    "RightHand",
  ]) {
    const p = worldPos.get(name);
    console.log(
      name.padEnd(12),
      p.map((v) => v.toFixed(2)).join(", "),
    );
  }
}

// ---------- GLB 조립 (본 계층 + 애니메이션, 메시 없음) ----------
const binParts = [];
let binOffset = 0;
const accessors = [];
const bufferViews = [];

const pushAccessor = (data, type, { min, max } = {}) => {
  const arr = new Float32Array(data);
  const buf = Buffer.from(arr.buffer);
  bufferViews.push({ buffer: 0, byteOffset: binOffset, byteLength: buf.length });
  binParts.push(buf);
  binOffset += buf.length;
  const acc = {
    bufferView: bufferViews.length - 1,
    componentType: 5126, // FLOAT
    count: type === "SCALAR" ? data.length : data.length / (type === "VEC3" ? 3 : 4),
    type,
  };
  if (min) acc.min = min;
  if (max) acc.max = max;
  accessors.push(acc);
  return accessors.length - 1;
};

const timeAccessor = pushAccessor(times, "SCALAR", {
  min: [0],
  max: [DURATION],
});

// 출력용 노드 배열 (본만, 인덱스 재매핑)
const outNodes = bones.map((b) => {
  const node = { name: b.name };
  const src = srcNodes[srcNodes.findIndex((n) => n.name === b.name)];
  if (src.translation) node.translation = src.translation;
  if (src.rotation) node.rotation = src.rotation;
  if (src.scale) node.scale = src.scale;
  return node;
});
const outIndex = new Map(bones.map((b, i) => [b.name, i]));
bones.forEach((b, i) => {
  if (b.parent === null) return;
  const p = outNodes[outIndex.get(b.parent)];
  (p.children ??= []).push(i);
});

const samplers = [];
const channels = [];
for (const b of bones) {
  const out = pushAccessor(rotationTracks.get(b.name), "VEC4");
  samplers.push({ input: timeAccessor, interpolation: "LINEAR", output: out });
  channels.push({
    sampler: samplers.length - 1,
    target: { node: outIndex.get(b.name), path: "rotation" },
  });
}
{
  const out = pushAccessor(hipsTranslations, "VEC3");
  samplers.push({ input: timeAccessor, interpolation: "LINEAR", output: out });
  channels.push({
    sampler: samplers.length - 1,
    target: { node: outIndex.get("Hips"), path: "translation" },
  });
}

const gltf = {
  asset: { version: "2.0", generator: "panda-village sit-clip generator" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: outNodes,
  animations: [{ name: CLIP_NAME, samplers, channels }],
  buffers: [{ byteLength: binOffset }],
  bufferViews,
  accessors,
};

// GLB 패킹 (JSON/BIN 청크 4바이트 정렬)
const jsonBuf = Buffer.from(JSON.stringify(gltf));
const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
const jsonChunk = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]);
const binBuf = Buffer.concat(binParts);
const binPad = (4 - (binBuf.length % 4)) % 4;
const binChunk = Buffer.concat([binBuf, Buffer.alloc(binPad)]);

const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); // glTF
header.writeUInt32LE(2, 4);
header.writeUInt32LE(
  12 + 8 + jsonChunk.length + 8 + binChunk.length,
  8,
);
const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonChunk.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4); // JSON
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(binChunk.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4); // BIN

fs.writeFileSync(
  OUT_PATH,
  Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]),
);
console.log(
  `\n✅ ${path.basename(OUT_PATH)} 생성 완료 (${bones.length}개 본, ${KEY_COUNT}키, ${DURATION}s 루프)`,
);
