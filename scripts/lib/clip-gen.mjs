/**
 * 판다 스켈레톤용 애니메이션 클립 생성 공통 모듈.
 *
 * 외부 클립 리타게팅은 본 이름·휴식 포즈 불일치로 몸이 일그러지므로,
 * base.glb의 휴식 포즈를 읽어 "월드 프레임 델타 회전"을 FK로 로컬
 * 쿼터니언에 역산하는 방식으로 키프레임을 직접 작성합니다.
 *
 * 사용처: generate-sit-clip.mjs, generate-emote-clips.mjs
 */
import fs from "node:fs";

// ---------- 쿼터니언/벡터 유틸 ([x, y, z, w]) ----------
export const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
export const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
export const qnorm = (q) => {
  const l = Math.hypot(...q);
  return q.map((v) => v / l);
};
export const qrot = (q, v) => {
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
export const axisAngle = (axis, deg) => {
  const half = (deg * Math.PI) / 360;
  const s = Math.sin(half);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
};
export const X = [1, 0, 0];
export const Y = [0, 1, 0];
export const Z = [0, 0, 1];
export const IDENTITY = [0, 0, 0, 1];

// ---------- 릭 로딩 ----------
/**
 * GLB에서 Armature 서브트리의 본 계층과 휴식 포즈를 읽습니다.
 * @returns {{ bones, boneByName, restWorld, srcNodes }}
 *   bones: { name, parent(이름|null), t, r, s }[] (메시 노드 제외)
 *   restWorld: Map<본이름, 휴식 포즈 월드 회전 쿼터니언>
 */
export const loadRig = (glbPath) => {
  const glb = fs.readFileSync(glbPath);
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.slice(20, 20 + jsonLen).toString());

  const srcNodes = json.nodes;
  const armatureIdx = srcNodes.findIndex((n) => n.name === "Armature");
  if (armatureIdx < 0) throw new Error(`Armature 노드 없음: ${glbPath}`);

  const bones = [];
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

  const restWorld = new Map();
  for (const b of bones) {
    const parentQ = b.parent ? restWorld.get(b.parent) : IDENTITY;
    restWorld.set(b.name, qnorm(qmul(parentQ, b.r)));
  }

  return { bones, boneByName: new Map(bones.map((b) => [b.name, b])), restWorld, srcNodes };
};

// ---------- 클립 솔버 ----------
/**
 * 월드 프레임 델타 정의로부터 키프레임별 로컬 쿼터니언 트랙을 계산합니다.
 *
 * 델타를 지정하지 않은 본은 휴식 로컬 회전을 유지해 부모를 그대로 따라갑니다.
 * (월드 방향을 고수하면 head_end·headfront·손 같은 리프 본이 부모와 반대로
 * 회전해 메시가 찌그러지므로, 미지정 본의 기본은 반드시 "부모 따라가기")
 *
 * @param rig loadRig 결과
 * @param spec {
 *   name: 클립 이름,
 *   duration: 루프 길이(초),
 *   keyCount: 키프레임 수 (첫/끝 phase 0/1 — 루프면 델타가 동일해야 함),
 *   delta: (boneName, phase) => 월드 프레임 델타 쿼터니언 | null(부모 따라가기),
 *   hipsTranslation?: (phase, restT) => [x, y, z] (cm, 생략 시 휴식 위치)
 * }
 * @returns { name, times, rotationTracks: Map<본, number[]>, hipsTranslations: number[] }
 */
export const solveClip = (rig, spec) => {
  const { bones, boneByName } = rig;
  const times = Array.from(
    { length: spec.keyCount },
    (_, i) => (i / (spec.keyCount - 1)) * spec.duration,
  );
  const rotationTracks = new Map(bones.map((b) => [b.name, []]));
  const hipsTranslations = [];
  const restHips = boneByName.get("Hips").t;

  for (let k = 0; k < spec.keyCount; k++) {
    const phase = k / (spec.keyCount - 1);
    const desiredWorld = new Map();

    for (const b of bones) {
      const delta = spec.delta(b.name, phase);
      const parentWorld = b.parent ? desiredWorld.get(b.parent) : IDENTITY;

      let local;
      if (delta) {
        // 지정된 본: 휴식 월드 방향 기준 델타를 적용하고 로컬로 역산
        const world = qnorm(qmul(delta, rig.restWorld.get(b.name)));
        local = qnorm(qmul(qconj(parentWorld), world));
      } else {
        // 미지정 본: 휴식 로컬 회전 유지 (부모 따라가기)
        local = b.r;
      }
      desiredWorld.set(b.name, qnorm(qmul(parentWorld, local)));
      rotationTracks.get(b.name).push(...local);
    }

    hipsTranslations.push(
      ...(spec.hipsTranslation?.(phase, restHips) ?? restHips),
    );
  }

  return { name: spec.name, times, rotationTracks, hipsTranslations };
};

// ---------- FK 검증 ----------
/** 클립의 특정 키프레임 포즈를 FK로 적용한 본별 월드 좌표(m)를 반환합니다. */
export const posedWorldPositions = (rig, clip, keyIndex = 0) => {
  const worldPos = new Map();
  const worldQ = new Map();
  const worldS = new Map();
  for (const b of rig.bones) {
    const pPos = b.parent ? worldPos.get(b.parent) : [0, 0, 0];
    const pQ = b.parent ? worldQ.get(b.parent) : IDENTITY;
    const pS = b.parent ? worldS.get(b.parent) : [1, 1, 1];
    const local = clip.rotationTracks
      .get(b.name)
      .slice(keyIndex * 4, keyIndex * 4 + 4);
    const t =
      b.name === "Hips"
        ? clip.hipsTranslations.slice(keyIndex * 3, keyIndex * 3 + 3)
        : b.t;
    const scaled = t.map((v, i) => v * pS[i]);
    const rotated = qrot(pQ, scaled);
    worldPos.set(b.name, rotated.map((v, i) => pPos[i] + v));
    worldQ.set(b.name, qnorm(qmul(pQ, local)));
    worldS.set(b.name, b.s.map((v, i) => v * pS[i]));
  }
  return worldPos;
};

export const printPose = (rig, clip, boneNames, keyIndex = 0) => {
  const pos = posedWorldPositions(rig, clip, keyIndex);
  console.log(`── [${clip.name}] 포즈 월드 좌표 검증 (단위: m) ──`);
  for (const name of boneNames) {
    console.log(
      name.padEnd(13),
      pos.get(name).map((v) => v.toFixed(2)).join(", "),
    );
  }
};

// ---------- GLB 패킹 (본 계층 + 애니메이션, 메시 없음) ----------
/** 여러 클립을 하나의 GLB로 출력합니다. */
export const writeClipGlb = (outPath, rig, clips) => {
  const { bones, srcNodes } = rig;

  const binParts = [];
  let binOffset = 0;
  const accessors = [];
  const bufferViews = [];

  const pushAccessor = (data, type, { min, max } = {}) => {
    const buf = Buffer.from(new Float32Array(data).buffer);
    bufferViews.push({ buffer: 0, byteOffset: binOffset, byteLength: buf.length });
    binParts.push(buf);
    binOffset += buf.length;
    const acc = {
      bufferView: bufferViews.length - 1,
      componentType: 5126, // FLOAT
      count:
        type === "SCALAR" ? data.length : data.length / (type === "VEC3" ? 3 : 4),
      type,
    };
    if (min) acc.min = min;
    if (max) acc.max = max;
    accessors.push(acc);
    return accessors.length - 1;
  };

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

  const animations = clips.map((clip) => {
    const timeAccessor = pushAccessor(clip.times, "SCALAR", {
      min: [0],
      max: [clip.times[clip.times.length - 1]],
    });
    const samplers = [];
    const channels = [];
    for (const b of bones) {
      const out = pushAccessor(clip.rotationTracks.get(b.name), "VEC4");
      samplers.push({ input: timeAccessor, interpolation: "LINEAR", output: out });
      channels.push({
        sampler: samplers.length - 1,
        target: { node: outIndex.get(b.name), path: "rotation" },
      });
    }
    const out = pushAccessor(clip.hipsTranslations, "VEC3");
    samplers.push({ input: timeAccessor, interpolation: "LINEAR", output: out });
    channels.push({
      sampler: samplers.length - 1,
      target: { node: outIndex.get("Hips"), path: "translation" },
    });
    return { name: clip.name, samplers, channels };
  });

  const gltf = {
    asset: { version: "2.0", generator: "panda-village clip generator" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: outNodes,
    animations,
    buffers: [{ byteLength: binOffset }],
    bufferViews,
    accessors,
  };

  const jsonBuf = Buffer.from(JSON.stringify(gltf));
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const jsonChunk = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]);
  const binBuf = Buffer.concat(binParts);
  const binPad = (4 - (binBuf.length % 4)) % 4;
  const binChunk = Buffer.concat([binBuf, Buffer.alloc(binPad)]);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // glTF magic
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4); // JSON
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4); // BIN

  fs.writeFileSync(
    outPath,
    Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]),
  );
};
