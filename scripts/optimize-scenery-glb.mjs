/**
 * 경관 GLB 최적화 파이프라인.
 *
 * assets/scenery/source의 원본을 보존하고 public/models에 배포용 GLB를 만든다.
 * 정점을 합친 뒤 오차 설정 0.001로 메시를 단순화한다.
 * Meshopt 압축을 적용하고 텍스처를 최대 1024로 조절해 WebP로 변환한다.
 * 메시 단순화는 기하량을, 압축은 다운로드할 파일 크기를 줄이기 위한 처리다.
 *
 * scenery:validate는 디코딩과 모델의 크기·위치를 확인한다.
 * 실루엣과 재질 품질은 실제 화면에서 별도로 확인한다.
 *
 * 사용: pnpm scenery:optimize
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  manifest,
  ROOT,
  sourcePath,
  outputRoot,
  gltfCli as CLI,
} from "./lib/assets.mjs";
import { buildAssetSet } from "./lib/publish-assets.mjs";
const TARGETS = Object.values(manifest.scenery);
const flags = process.argv.slice(2);
if (flags.some((flag) => flag !== "--check"))
  throw new Error("Usage: node scripts/optimize-scenery-glb.mjs [--check]");

const OPTIONS = [
  "--compress",
  "meshopt",
  "--meshopt-level",
  "high",
  "--texture-compress",
  "webp",
  "--texture-size",
  "1024",
  // weld가 선행되어야 simplify가 동작한다(원본은 정점이 쪼개져 있다).
  // optimize의 --weld 기본값이 true라 그대로 둔다.
  "--simplify",
  "true",
  "--simplify-error",
  "0.001",
];

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

let totalBefore = 0;
let totalAfter = 0;

buildAssetSet({
  outputRoot,
  urls: TARGETS.map((target) => target.url),
  checkOnly: flags.includes("--check"),
  build({ stagedRoot }) {
    for (const { source, url: output } of TARGETS) {
      const input = sourcePath(source);
      const outputPath = join(stagedRoot, output.slice(1));

      mkdirSync(dirname(outputPath), { recursive: true });

      const before = statSync(input).size;
      console.log(`\n▶ ${source} (${mb(before)})`);

      execFileSync(CLI, ["optimize", input, outputPath, ...OPTIONS], {
        stdio: "inherit",
      });

      const after = statSync(outputPath).size;
      totalBefore += before;
      totalAfter += after;

      const ratio = ((1 - after / before) * 100).toFixed(1);
      console.log(`✔ ${output} — ${mb(before)} → ${mb(after)} (-${ratio}%)`);
    }
  },
  validate({ env }) {
    execFileSync(
      process.execPath,
      [join(ROOT, "scripts/validate-scenery-glb.mjs")],
      { stdio: "inherit", cwd: ROOT, env },
    );
  },
});

const totalRatio = ((1 - totalAfter / totalBefore) * 100).toFixed(1);
console.log(`\n합계: ${mb(totalBefore)} → ${mb(totalAfter)} (-${totalRatio}%)`);
