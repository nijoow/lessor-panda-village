/**
 * base.glb 용량 최적화 (13.3MB → 약 1.5MB).
 *
 * gltf-transform CLI(devDependency)를 3단계로 체이닝합니다:
 * 1. resize — 텍스처 2048² → 1024² (인게임 캐릭터 크기에 충분)
 * 2. webp — PNG → WebP (three GLTFLoader가 EXT_texture_webp 기본 지원)
 * 3. meshopt — KHR_mesh_quantization + EXT_meshopt_compression
 *    (drei useGLTF가 MeshoptDecoder를 기본 활성화하므로 코드 변경 불필요)
 *
 * ⚠ 실행 순서 주의: 스킨 가중치 수정 스크립트(fix-skin-weights.mjs,
 * fix-fallback-weights.mjs)는 float 가중치를 전제하므로, 재생성이
 * 필요하면 git 히스토리의 원본 base.glb에 수정 스크립트를 먼저 적용한
 * 뒤 이 스크립트를 실행해야 합니다.
 *
 * 사용법: node scripts/optimize-base-glb.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SRC = "public/models/player/base.glb";
const TEXTURE_SIZE = "1024";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "panda-glb-"));
const step1 = path.join(tmpDir, "1-resized.glb");
const step2 = path.join(tmpDir, "2-webp.glb");
const step3 = path.join(tmpDir, "3-meshopt.glb");

const run = (args) =>
  execFileSync("npx", ["gltf-transform", ...args], { stdio: "inherit" });

const mb = (p) => (fs.statSync(p).size / 1048576).toFixed(2) + "MB";

try {
  const before = mb(SRC);
  run(["resize", "--width", TEXTURE_SIZE, "--height", TEXTURE_SIZE, SRC, step1]);
  run(["webp", step1, step2]);
  run(["meshopt", step2, step3]);

  // 최소 구조 검증: 스킨·본·애니메이션이 살아 있어야 함
  const glb = fs.readFileSync(step3);
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.slice(20, 20 + jsonLen).toString());
  const meshNode = json.nodes.find((n) => n.mesh !== undefined);
  if ((json.skins?.length ?? 0) < 1 || meshNode?.skin === undefined)
    throw new Error("최적화 후 스킨이 유실됨");
  if ((json.animations?.length ?? 0) < 1)
    throw new Error("최적화 후 애니메이션이 유실됨");
  if (!json.nodes.some((n) => n.name === "Hips"))
    throw new Error("최적화 후 본 계층이 유실됨");

  fs.copyFileSync(step3, SRC);
  console.log(`✅ ${SRC}: ${before} → ${mb(SRC)}`);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
