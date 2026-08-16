/**
 * 경관 GLB 최적화 파이프라인.
 *
 * assets/scenery/source의 원본을 읽어 public/models로 런타임 버전을 굽는다.
 * 원본은 저장소에 그대로 두고, 배포되는 파일만 압축한다.
 *
 * 방침: 품질을 낮추지 않는다.
 * - simplify(지오메트리 간소화)는 끈다. 실루엣이 뭉개지면 저폴리로
 *   내려가는 것과 같아진다.
 * - meshopt 양자화·압축으로 지오메트리 용량만 줄인다. drei의 useGLTF가
 *   three-stdlib의 MeshoptDecoder를 기본으로 물고 있어 CDN이 필요 없다
 *   (Draco를 쓰면 외부 디코더를 받아와야 한다).
 * - 텍스처는 1024로 리사이즈하고 webp로 바꾼다. 등각 카메라가 20~40 유닛
 *   떨어져 있어 2048은 화면에서 확인되지 않으면서 텍스처당 22MB의 VRAM을
 *   쓴다. 노멀맵·러프니스맵은 그대로 유지한다.
 *
 * 사용: pnpm scenery:optimize
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "node_modules/.bin/gltf-transform");

const TARGETS = [
  {
    source: "assets/scenery/source/panda_house.glb",
    output: "public/models/house/panda_house.glb",
  },
  {
    source: "assets/scenery/source/cherry_blossom_tree.glb",
    output: "public/models/tree/cherry_blossom_tree.glb",
  },
];

const OPTIONS = [
  "--compress",
  "meshopt",
  "--meshopt-level",
  "high",
  "--texture-compress",
  "webp",
  "--texture-size",
  "1024",
  // 지오메트리는 손대지 않는다
  "--simplify",
  "false",
];

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

let totalBefore = 0;
let totalAfter = 0;

for (const { source, output } of TARGETS) {
  const sourcePath = join(ROOT, source);
  const outputPath = join(ROOT, output);

  if (!existsSync(sourcePath)) {
    throw new Error(`원본을 찾을 수 없습니다: ${source}`);
  }

  mkdirSync(dirname(outputPath), { recursive: true });

  const before = statSync(sourcePath).size;
  console.log(`\n▶ ${source} (${mb(before)})`);

  execFileSync(CLI, ["optimize", sourcePath, outputPath, ...OPTIONS], {
    stdio: "inherit",
  });

  const after = statSync(outputPath).size;
  totalBefore += before;
  totalAfter += after;

  const ratio = ((1 - after / before) * 100).toFixed(1);
  console.log(`✔ ${output} — ${mb(before)} → ${mb(after)} (-${ratio}%)`);
}

const totalRatio = ((1 - totalAfter / totalBefore) * 100).toFixed(1);
console.log(
  `\n합계: ${mb(totalBefore)} → ${mb(totalAfter)} (-${totalRatio}%)`,
);
