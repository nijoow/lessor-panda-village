import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import manifest from "../../src/constants/assets.json" with { type: "json" };
export { manifest };
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const publicRoot = resolve(ROOT, "public");
export const outputRoot = process.env.PANDA_ASSET_OUTPUT_ROOT
  ? resolve(process.env.PANDA_ASSET_OUTPUT_ROOT)
  : publicRoot;
export const sourcePath = (relative) => resolve(ROOT, relative);
export const assetPath = (url) => join(outputRoot, url.replace(/^\//, ""));
export const playerPath = (name) => assetPath(manifest.player.urls[name]);
export const gltfCli = join(ROOT, "node_modules/.bin/gltf-transform");
