/**
 * 걷기/달리기 클립 리파인:
 * 1. 상체 회전 감쇠 — Meshy 리타게팅 클립이 어깨와 머리를 과하게 내려
 *    얼굴까지 끌려가므로, 휴식 포즈 기준으로 본별 진폭을 줄입니다.
 * 2. 꼬리 스웨이 합성 — 새 꼬리 본(Tail1~4)용 흔들림 트랙을 추가합니다.
 *    걷기: 몸 스웨이에 맞춘 좌우 흔들기(체인 아래로 진폭·위상 증가),
 *    달리기: 상하 바운스 위주로 꼬리가 흐르는 느낌.
 *    (클립에 꼬리 트랙이 없으면 이전 클립의 마지막 포즈에 얼어붙으므로
 *    상시 구동 목적도 겸함)
 *
 * 사용법: node scripts/refine-locomotion-clips.mjs
 *   (add-tail-rig.mjs 적용된 base.glb + 클립 전용 walking/running.glb 전제)
 */
import fs from "node:fs";
import { loadRig, qmul, qnorm, axisAngle, X, Y } from "./lib/clip-gen.mjs";

const BONE_FACTORS = new Map([
  ["LeftShoulder", 0.08],
  ["RightShoulder", 0.08],
  ["LeftArm", 0.55],
  ["RightArm", 0.55],
  ["LeftForeArm", 0.7],
  ["RightForeArm", 0.7],
  ["Spine02", 0.35],
  ["Spine01", 0.35],
  ["Spine", 0.35],
  ["neck", 0.25],
  ["Head", 0.2],
]);
const TAIL_KEYS = 17;

// 꼬리 본 rest TRS는 base.glb에서 가져옴
const baseRig = loadRig("public/models/player/base.glb");
const TAIL_BONES = ["Tail1", "Tail2", "Tail3", "Tail4"];
for (const t of TAIL_BONES)
  if (!baseRig.boneByName.has(t))
    throw new Error(`base.glb에 ${t} 없음 — add-tail-rig.mjs 먼저 실행`);

// ---------- 클립 GLB 로드 ----------
const loadClipGlb = (path) => {
  const glb = fs.readFileSync(path);
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.slice(20, 20 + jsonLen).toString());
  const binStart = 20 + jsonLen + 8;
  const acc = (i) => {
    const a = json.accessors[i];
    const bv = json.bufferViews[a.bufferView];
    const off = binStart + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
    return Array.from(
      new Float32Array(glb.buffer, glb.byteOffset + off, a.count * n),
    );
  };
  const nodes = json.nodes.map((n) => ({ ...n }));
  const anim = json.animations[0];
  const tracks = anim.channels.map((ch) => {
    const s = anim.samplers[ch.sampler];
    return {
      node: json.nodes[ch.target.node].name,
      path: ch.target.path,
      interpolation: s.interpolation ?? "LINEAR",
      times: acc(s.input),
      values: acc(s.output),
    };
  });
  return { name: anim.name, nodes, tracks };
};

// ---------- 클립 GLB 저장 (extract-clip-glb와 동일 포맷) ----------
const saveClipGlb = (path, clip) => {
  const outNodes = clip.nodes.map((n) => {
    const node = { name: n.name };
    if (n.translation) node.translation = n.translation;
    if (n.rotation) node.rotation = n.rotation;
    if (n.scale) node.scale = n.scale;
    return node;
  });
  const idxByName = new Map(clip.nodes.map((n, i) => [n.name, i]));
  clip.nodes.forEach((n, i) => {
    if (n.parent === undefined) return;
    const p = outNodes[idxByName.get(n.parent)];
    (p.children ??= []).push(i);
  });
  // 원본 children 보존 (parent 필드가 없던 기존 노드)
  clip.nodes.forEach((n, i) => {
    if (n.children) outNodes[i].children = [...(outNodes[i].children ?? []), ...n.children];
  });

  const binParts = [];
  let binOffset = 0;
  const accessors = [];
  const bufferViews = [];
  const pushAccessor = (data, type) => {
    const buf = Buffer.from(new Float32Array(data).buffer);
    bufferViews.push({ buffer: 0, byteOffset: binOffset, byteLength: buf.length });
    binParts.push(buf);
    binOffset += buf.length;
    const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type];
    const a = { bufferView: bufferViews.length - 1, componentType: 5126, count: data.length / n, type };
    if (type === "SCALAR") {
      a.min = [Math.min(...data)];
      a.max = [Math.max(...data)];
    }
    accessors.push(a);
    return accessors.length - 1;
  };

  const samplers = [];
  const channels = [];
  for (const t of clip.tracks) {
    const input = pushAccessor(t.times, "SCALAR");
    const output = pushAccessor(t.values, t.path === "rotation" ? "VEC4" : "VEC3");
    samplers.push({ input, interpolation: t.interpolation, output });
    channels.push({
      sampler: samplers.length - 1,
      target: { node: idxByName.get(t.node), path: t.path },
    });
  }

  const gltf = {
    asset: { version: "2.0", generator: "panda-village locomotion refiner" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: outNodes,
    animations: [{ name: clip.name, samplers, channels }],
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
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(path, Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]));
};

// ---------- nlerp (소각도 감쇠용) ----------
const nlerp = (a, b, t) => {
  let dot = 0;
  for (let i = 0; i < 4; i++) dot += a[i] * b[i];
  const s = dot < 0 ? -1 : 1;
  return qnorm(a.map((v, i) => v * (1 - t) + b[i] * s * t));
};

// ---------- 처리 ----------
const refine = (path, spec) => {
  const clip = loadClipGlb(path);
  const duration = Math.max(...clip.tracks.map((t) => t.times.at(-1)));

  // 1. 상체 감쇠
  let attenuated = 0;
  for (const t of clip.tracks) {
    if (t.path !== "rotation" || !BONE_FACTORS.has(t.node)) continue;
    const rest = baseRig.boneByName.get(t.node).r;
    const factor = BONE_FACTORS.get(t.node);
    const keyCount = t.values.length / 4;
    for (let k = 0; k < keyCount; k++) {
      const q = t.values.slice(k * 4, k * 4 + 4);
      const out = nlerp(rest, q, factor);
      for (let i = 0; i < 4; i++) t.values[k * 4 + i] = out[i];
    }
    attenuated++;
  }

  // 2. 꼬리 노드 + 스웨이 트랙 추가
  for (const name of TAIL_BONES) {
    const b = baseRig.boneByName.get(name);
    clip.nodes.push({ name, translation: b.t, rotation: b.r, parent: b.parent });
  }
  const times = Array.from(
    { length: TAIL_KEYS },
    (_, i) => (i / (TAIL_KEYS - 1)) * duration,
  );
  TAIL_BONES.forEach((name, bi) => {
    const rest = baseRig.boneByName.get(name).r;
    const values = [];
    for (let k = 0; k < TAIL_KEYS; k++) {
      const phase = k / (TAIL_KEYS - 1);
      const lag = bi * spec.phaseLag;
      const yaw = Math.sin(phase * Math.PI * 2 - lag) * spec.yawAmp * (bi + 1);
      const pitch =
        Math.sin(phase * Math.PI * 4 - lag) * spec.pitchAmp * (bi + 1);
      const delta = qmul(axisAngle(Y, yaw), axisAngle(X, pitch));
      values.push(...qnorm(qmul(rest, delta)));
    }
    clip.tracks.push({
      node: name,
      path: "rotation",
      interpolation: "LINEAR",
      times,
      values,
    });
  });

  saveClipGlb(path, clip);
  console.log(
    `✅ ${path}: 상체 트랙 ${attenuated}개 본별 감쇠, 꼬리 스웨이 4트랙 추가 (duration ${duration.toFixed(2)}s)`,
  );
};

// 걷기: 좌우 스웨이 위주 / 달리기: 상하 바운스 위주
refine("public/models/player/walking.glb", {
  yawAmp: 2.5,
  pitchAmp: 1.2,
  phaseLag: 0.5,
});
refine("public/models/player/running.glb", {
  yawAmp: 1.5,
  pitchAmp: 2.2,
  phaseLag: 0.6,
});
