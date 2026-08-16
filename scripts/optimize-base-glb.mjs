/**
 * base.glb 용량 최적화 (고품질 원본 약 6.5MB → 약 2.2MB).
 *
 * 소스 GLB에는 번짐을 정리한 2048² WebP가 이미 들어 있습니다.
 * 텍스처를 다시 축소/손실 압축하면 작은 UV 섬 사이에서 주황색이 번지므로
 * 그대로 보존하고 메시만 높은 정밀도로 Meshopt 압축합니다.
 *
 * meshopt — KHR_mesh_quantization + EXT_meshopt_compression
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
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "panda-glb-"));
const optimized = path.join(tmpDir, "base-meshopt.glb");

const run = (args) =>
  execFileSync("npx", ["gltf-transform", ...args], { stdio: "inherit" });

const mb = (p) => (fs.statSync(p).size / 1048576).toFixed(2) + "MB";

try {
  const before = mb(SRC);
  run([
    "meshopt",
    SRC,
    optimized,
    "--quantize-position",
    "16",
    "--quantize-normal",
    "12",
    "--quantize-texcoord",
    "14",
    "--quantize-weight",
    "12",
  ]);

  // 최소 구조 검증: 스킨·본·애니메이션이 살아 있어야 함
  const glb = fs.readFileSync(optimized);
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.slice(20, 20 + jsonLen).toString());
  const meshNode = json.nodes.find((n) => n.mesh !== undefined);
  if ((json.skins?.length ?? 0) < 1 || meshNode?.skin === undefined)
    throw new Error("최적화 후 스킨이 유실됨");
  if ((json.animations?.length ?? 0) < 1)
    throw new Error("최적화 후 애니메이션이 유실됨");
  if (!json.nodes.some((n) => n.name === "Hips"))
    throw new Error("최적화 후 본 계층이 유실됨");

  fs.copyFileSync(optimized, SRC);
  console.log(`✅ ${SRC}: ${before} → ${mb(SRC)}`);
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
