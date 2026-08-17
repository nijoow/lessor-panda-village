/**
 * 경관 GLB 검증.
 *
 * optimize-scenery-glb.mjs가 구운 파일이 런타임과 같은 경로로 실제
 * 디코드되는지 확인한다. 빌드가 통과해도 GLB 로딩은 검증되지 않으므로,
 * three의 GLTFLoader에 three-stdlib MeshoptDecoder를 물려 앱과 동일한
 * 조합으로 파싱한다.
 *
 * 확인 항목:
 * - EXT_meshopt_compression / KHR_mesh_quantization 디코드
 * - 간소화 비율이 의도한 범위 안인지 (설정 실수로 형상이 무너지지 않았는지)
 * - 노드 변환까지 적용한 월드 bbox가 원본과 같은지 — 폴리곤을 줄여도
 *   실루엣과 크기는 유지되어야 한다. 충돌 박스가 이 크기에 맞춰져 있다.
 *   (양자화는 정점을 정규화하고 노드 스케일로 복원하므로, 지오메트리만
 *    꺼내 쓰면 크기가 틀어진다. 렌더 코드가 씬을 통째로 쓰는지 잡아낸다.)
 *
 * Node에는 DOM이 없어 텍스처 디코딩 경로는 최소한으로 흉내낸다.
 * 검증 대상은 지오메트리다.
 *
 * 사용: pnpm scenery:validate
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ---------- 브라우저 API 최소 흉내 ----------
// three의 WebP 지원 감지는 1x1 이미지를 로드해 height === 1인지 본다.
class StubImage {
  height = 1;
  width = 1;
  addEventListener(type, handler) {
    if (type === "load") this.onload = handler;
  }
  removeEventListener() {}
  set src(value) {
    this._src = value;
    setTimeout(() => this.onload?.({ target: this }), 0);
  }
  get src() {
    return this._src ?? "";
  }
}

globalThis.self = globalThis;
globalThis.Image = StubImage;
globalThis.document = {
  createElementNS: () => new StubImage(),
  createElement: () => ({ style: {} }),
};
globalThis.URL.createObjectURL = () => "blob:stub";
globalThis.URL.revokeObjectURL = () => {};

const { GLTFLoader, MeshoptDecoder } = await import("three-stdlib");

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

// 양자화는 위치를 정규화 범위로 굽고 노드 스케일로 되돌리므로
// 부동소수 오차가 남는다. 모델 크기 대비 이 정도는 허용한다.
const BBOX_TOLERANCE = 0.01;

// 간소화 결과가 이 범위를 벗어나면 파이프라인 설정이 잘못된 것으로 본다.
// (오차 0.001에서 집 9.4% · 고목 11.3% 수준을 유지한다)
const MIN_KEPT_RATIO = 0.03;
const MAX_KEPT_RATIO = 0.9;

const parse = (path) =>
  new Promise((res, rej) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(
      typeof MeshoptDecoder === "function" ? MeshoptDecoder() : MeshoptDecoder,
    );
    const buf = readFileSync(path);
    loader.parse(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      "",
      res,
      rej,
    );
  });

const measure = async (path) => {
  const gltf = await parse(path);
  gltf.scene.updateMatrixWorld(true);

  let meshes = 0;
  let vertices = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  gltf.scene.traverse((node) => {
    if (!node.isMesh) return;
    meshes++;
    vertices += node.geometry.attributes.position.count;
    node.geometry.computeBoundingBox();
    const box = node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld);
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], box.min.getComponent(i));
      max[i] = Math.max(max[i], box.max.getComponent(i));
    }
  });

  return { meshes, vertices, min, max };
};

const fmt = (v) => v.map((n) => n.toFixed(3)).join(", ");

let failed = 0;

for (const { source, output } of TARGETS) {
  const name = output.split("/").pop();
  try {
    const before = await measure(join(ROOT, source));
    const after = await measure(join(ROOT, output));

    const problems = [];

    if (after.meshes !== before.meshes) {
      problems.push(`메시 수 ${before.meshes} → ${after.meshes}`);
    }
    // 간소화는 의도된 것이므로 정점 수가 같기를 요구하지 않는다. 다만
    // 형상이 통째로 무너지는 사고(가령 오차 인자를 잘못 넣어 1%만 남는 것)는
    // 잡아야 하므로 하한을 둔다. 실루엣 자체는 아래 bbox 비교가 검증한다.
    const kept = after.vertices / before.vertices;
    if (kept > MAX_KEPT_RATIO) {
      problems.push(
        `간소화가 적용되지 않음 (정점 ${(kept * 100).toFixed(1)}% 유지)`,
      );
    }
    if (kept < MIN_KEPT_RATIO) {
      problems.push(
        `과도한 간소화 (정점 ${before.vertices.toLocaleString()} → ` +
          `${after.vertices.toLocaleString()}, ${(kept * 100).toFixed(1)}%만 남음)`,
      );
    }
    for (let i = 0; i < 3; i++) {
      if (
        Math.abs(after.min[i] - before.min[i]) > BBOX_TOLERANCE ||
        Math.abs(after.max[i] - before.max[i]) > BBOX_TOLERANCE
      ) {
        problems.push(
          `bbox 축 ${"xyz"[i]}: [${before.min[i].toFixed(3)}, ${before.max[i].toFixed(3)}]` +
            ` → [${after.min[i].toFixed(3)}, ${after.max[i].toFixed(3)}]`,
        );
        break;
      }
    }

    if (problems.length > 0) {
      failed++;
      console.log(`✖ ${name}`);
      problems.forEach((p) => console.log(`    ${p}`));
    } else {
      console.log(`✔ ${name}`);
      console.log(
        `    메시 ${after.meshes} · 정점 ${after.vertices.toLocaleString()}`,
      );
      console.log(`    bbox ${fmt(after.min)} → ${fmt(after.max)}`);
    }
  } catch (error) {
    failed++;
    console.log(`✖ ${name} — 로딩 실패: ${error?.message ?? error}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed}개 파일에서 문제가 발견되었습니다.`);
  process.exit(1);
}

console.log("\n모든 경관 GLB가 런타임 경로로 정상 디코드됩니다.");
