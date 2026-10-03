import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

export function loadSource(path, dependencies = {}, globals = {}, cache = new Map()) {
  const url = new URL(`../../../${path}`, import.meta.url);
  if (cache.has(url.href)) return cache.get(url.href).exports;
  const require = createRequire(url);
  const code = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const sourceModule = { exports: {} };
  cache.set(url.href, sourceModule);
  vm.runInNewContext(code, {
    module: sourceModule, exports: sourceModule.exports, console, Date, AbortSignal, ...globals,
    require: (name) => {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      if (name.startsWith("@/") || name.startsWith(".")) {
        const base = name.startsWith("@/") ? new URL(`../../../src/${name.slice(2)}`, import.meta.url) : new URL(name, url);
        for (const extension of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
          const target = new URL(base.href + extension);
          if (existsSync(target)) {
            const relative = fileURLToPath(target).slice(fileURLToPath(new URL("../../../", import.meta.url)).length);
            return loadSource(relative, dependencies, globals, cache);
          }
        }
      }
      return require(name);
    },
  }, { filename: fileURLToPath(url) });
  return sourceModule.exports;
}
