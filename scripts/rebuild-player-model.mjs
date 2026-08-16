/**
 * 검증된 플레이어 원본에서 런타임 GLB 전체를 다시 생성합니다.
 * 소스 파일은 수정하지 않으며, 매 실행 결과가 같도록 항상 원본부터 복사합니다.
 *
 * 사용법: pnpm player:rebuild
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SOURCE_DIR = "assets/player/source";
const OUTPUT_DIR = "public/models/player";

const sourceFiles = {
  "base-rig-v3.glb": "base.glb",
  "walking-source.glb": "walking.glb",
  "running-source.glb": "running.glb",
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
for (const [source, output] of Object.entries(sourceFiles)) {
  const sourcePath = path.join(SOURCE_DIR, source);
  if (!fs.existsSync(sourcePath)) throw new Error(`플레이어 소스 없음: ${sourcePath}`);
  fs.copyFileSync(sourcePath, path.join(OUTPUT_DIR, output));
}

const run = (script) =>
  execFileSync(process.execPath, [script], { stdio: "inherit" });

run("scripts/refine-locomotion-clips.mjs");
run("scripts/generate-idle-clip.mjs");
run("scripts/generate-sit-clip.mjs");
run("scripts/generate-emote-clips.mjs");
run("scripts/optimize-base-glb.mjs");
run("scripts/validate-player-model.mjs");

console.log("\n✅ 플레이어 모델과 전체 애니메이션 재생성 완료");
