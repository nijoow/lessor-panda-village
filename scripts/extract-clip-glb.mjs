/**
 * 풀 GLB에서 본 계층 + 애니메이션만 담은 경량 클립 GLB를 추출합니다.
 *
 * walking.glb / running.glb(각 12.7MB)는 base.glb와 동일한 메시·텍스처를
 * 통째로 중복 포함하지만 실제 고유 데이터는 애니메이션 ~20KB뿐입니다.
 * PandaModel은 base의 메시에 여러 GLB의 클립을 합쳐 바인딩하므로
 * (sitting.glb/emotes.glb와 동일한 방식) 클립 전용 GLB로 충분합니다.
 *
 * 원본 키프레임 데이터(시간·값 버퍼)를 바이트 그대로 복사하며,
 * 본이 아닌 노드(메시 등)를 대상으로 한 채널은 제외합니다.
 *
 * 사용법: node scripts/extract-clip-glb.mjs <입력.glb> <출력.glb>
 * 예:     node scripts/extract-clip-glb.mjs public/models/player/walking.glb \
 *             public/models/player/walking.glb   (제자리 교체 가능)
 */
import fs from "node:fs";

const [srcPath, outPath] = process.argv.slice(2);
if (!srcPath || !outPath) {
  console.error("사용법: node scripts/extract-clip-glb.mjs <입력.glb> <출력.glb>");
  process.exit(1);
}

const glb = fs.readFileSync(srcPath);
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.slice(20, 20 + jsonLen).toString());
const binStart = 20 + jsonLen + 8;

// ---------- Armature 서브트리에서 본 노드 수집 (메시 노드 제외) ----------
const srcNodes = json.nodes;
const armatureIdx = srcNodes.findIndex((n) => n.name === "Armature");
if (armatureIdx < 0) throw new Error(`Armature 노드 없음: ${srcPath}`);

const boneSrcIndices = [];
const collect = (idx) => {
  const n = srcNodes[idx];
  if (n.mesh !== undefined) return;
  boneSrcIndices.push(idx);
  (n.children ?? []).forEach(collect);
};
collect(armatureIdx);

const outIndexBySrc = new Map(boneSrcIndices.map((srcIdx, i) => [srcIdx, i]));
const outNodes = boneSrcIndices.map((srcIdx) => {
  const src = srcNodes[srcIdx];
  const node = { name: src.name };
  if (src.translation) node.translation = src.translation;
  if (src.rotation) node.rotation = src.rotation;
  if (src.scale) node.scale = src.scale;
  const children = (src.children ?? [])
    .filter((c) => outIndexBySrc.has(c))
    .map((c) => outIndexBySrc.get(c));
  if (children.length) node.children = children;
  return node;
});

// ---------- 애니메이션 채널의 액세서 데이터 복사 ----------
const outAccessors = [];
const outBufferViews = [];
const binParts = [];
let binOffset = 0;

const copyAccessor = (srcAccIdx) => {
  const acc = json.accessors[srcAccIdx];
  const bv = json.bufferViews[acc.bufferView];
  const compBytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[
    acc.componentType
  ];
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[acc.type];
  const byteLen = acc.count * n * compBytes;
  const start = binStart + (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const data = glb.slice(start, start + byteLen);

  outBufferViews.push({ buffer: 0, byteOffset: binOffset, byteLength: byteLen });
  binParts.push(data);
  binOffset += (byteLen + 3) & ~3; // 4바이트 정렬
  if (byteLen % 4) binParts.push(Buffer.alloc(4 - (byteLen % 4)));

  const out = {
    bufferView: outBufferViews.length - 1,
    componentType: acc.componentType,
    count: acc.count,
    type: acc.type,
  };
  if (acc.normalized) out.normalized = true;
  if (acc.min) out.min = acc.min;
  if (acc.max) out.max = acc.max;
  outAccessors.push(out);
  return outAccessors.length - 1;
};

let dropped = 0;
const outAnimations = (json.animations ?? []).map((anim) => {
  const samplers = [];
  const channels = [];
  const samplerMap = new Map(); // 원본 샘플러 idx → 새 idx
  for (const ch of anim.channels) {
    if (!outIndexBySrc.has(ch.target.node)) {
      dropped++;
      continue;
    }
    if (!samplerMap.has(ch.sampler)) {
      const s = anim.samplers[ch.sampler];
      samplers.push({
        input: copyAccessor(s.input),
        interpolation: s.interpolation ?? "LINEAR",
        output: copyAccessor(s.output),
      });
      samplerMap.set(ch.sampler, samplers.length - 1);
    }
    channels.push({
      sampler: samplerMap.get(ch.sampler),
      target: {
        node: outIndexBySrc.get(ch.target.node),
        path: ch.target.path,
      },
    });
  }
  return { name: anim.name, samplers, channels };
});

// ---------- GLB 패킹 ----------
const gltf = {
  asset: { version: "2.0", generator: "panda-village clip extractor" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: outNodes,
  animations: outAnimations,
  buffers: [{ byteLength: binOffset }],
  bufferViews: outBufferViews,
  accessors: outAccessors,
};

const jsonBuf = Buffer.from(JSON.stringify(gltf));
const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
const jsonChunk = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]);
const binChunk = Buffer.concat(binParts);

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

console.log(
  `${srcPath} → ${outPath}: 본 ${outNodes.length}개, ` +
    `클립 ${outAnimations.map((a) => `${a.name}(채널 ${a.channels.length})`).join(", ")}, ` +
    `제외된 비본 채널 ${dropped}개, ${(binOffset / 1024).toFixed(1)}KB`,
);
