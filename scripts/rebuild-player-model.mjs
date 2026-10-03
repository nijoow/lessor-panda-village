/** Rebuild all runtime assets in isolation, validate, then publish with rollback. */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { manifest, ROOT, outputRoot, sourcePath } from "./lib/assets.mjs";
import { buildAssetSet } from "./lib/publish-assets.mjs";
const flags = process.argv.slice(2);
if (flags.some((flag) => flag !== "--check"))
  throw new Error("Usage: node scripts/rebuild-player-model.mjs [--check]");
const run = (script, env) =>
  execFileSync(process.execPath, [join(ROOT, "scripts", script)], {
    stdio: "inherit",
    cwd: ROOT,
    env,
  });

buildAssetSet({
  outputRoot,
  urls: Object.values(manifest.player.urls),
  checkOnly: flags.includes("--check"),
  build({ stagedRoot, env }) {
    for (const [name, source] of Object.entries(manifest.player.sources)) {
      const target = join(stagedRoot, manifest.player.urls[name].slice(1));
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(sourcePath(source), target);
    }
    for (const script of [
      "refine-locomotion-clips.mjs",
      "generate-idle-clip.mjs",
      "generate-sit-clip.mjs",
      "generate-emote-clips.mjs",
      "optimize-base-glb.mjs",
      "generate-player-lods.mjs",
    ])
      run(script, env);
  },
  validate({ env }) {
    run("validate-player-model.mjs", env);
  },
});
console.log(
  flags.includes("--check")
    ? "✅ 플레이어 전체 재생성·검증 통과 (게시 생략)"
    : "✅ 검증된 플레이어 에셋 전체 게시 완료",
);
