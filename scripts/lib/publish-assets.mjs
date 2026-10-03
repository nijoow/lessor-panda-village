import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { readGlb } from "./glb.mjs";

/** Validate the complete set first; retain a recovery backup if rollback fails. */
export function publishAssetSet(outputRoot, outputs, rename = renameSync) {
  const targets = outputs.map(({ source, url }) => {
    if (!url.startsWith("/") || url.split("/").includes(".."))
      throw new Error("Invalid asset URL");
    if (!existsSync(source) || statSync(source).size === 0)
      throw new Error(`Missing staged asset: ${source}`);
    readGlb(source);
    return { source, target: join(outputRoot, url.slice(1)) };
  });
  if (new Set(targets.map((entry) => entry.target)).size !== targets.length)
    throw new Error("Duplicate publication target");
  mkdirSync(dirname(outputRoot), { recursive: true });
  const backup = mkdtempSync(join(dirname(outputRoot), ".asset-backup-"));
  const applied = [];
  let retainBackup = false;
  try {
    // Build tools may use /tmp on another mount. Copy the complete validated set
    // onto the destination filesystem before any rename changes published data.
    const prepared = targets.map(({ source }, index) => {
      const path = join(backup, `new-${index}`);
      copyFileSync(source, path);
      return path;
    });
    for (const [index, { target }] of targets.entries()) {
      mkdirSync(dirname(target), { recursive: true });
      const entry = {
        target,
        backup: join(backup, String(index)),
        saved: false,
        published: false,
      };
      applied.push(entry);
      if (existsSync(target)) {
        rename(target, entry.backup);
        entry.saved = true;
      }
      rename(prepared[index], target);
      entry.published = true;
    }
  } catch (error) {
    const failures = [];
    for (const entry of applied.reverse()) {
      try {
        if (entry.published) rmSync(entry.target);
        if (entry.saved) rename(entry.backup, entry.target);
      } catch (failure) {
        failures.push(failure);
      }
    }
    if (failures.length) {
      retainBackup = true;
      throw new AggregateError(
        [error, ...failures],
        `Publication/rollback failed; recovery files retained at ${backup}`,
      );
    }
    throw error;
  } finally {
    if (!retainBackup) rmSync(backup, { recursive: true, force: true });
  }
}

/** Workers write under a temporary public root; published files are untouched until validation. */
export function buildAssetSet({
  outputRoot,
  urls,
  build,
  validate,
  checkOnly = false,
}) {
  mkdirSync(dirname(outputRoot), { recursive: true });
  const stage = mkdtempSync(join(dirname(outputRoot), ".asset-stage-"));
  const stagedRoot = resolve(stage, "public");
  mkdirSync(stagedRoot);
  const env = { ...process.env, PANDA_ASSET_OUTPUT_ROOT: stagedRoot };
  try {
    build({ stagedRoot, env });
    validate({ stagedRoot, env });
    const outputs = urls.map((url) => ({
      source: join(stagedRoot, url.slice(1)),
      url,
    }));
    for (const { source } of outputs) readGlb(source);
    if (!checkOnly) publishAssetSet(outputRoot, outputs);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}
