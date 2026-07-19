// AUTO-DERIVED FROM module-boundaries.json — DO NOT hand-edit the rules below.
// This file is a *mechanical* translation of the LLM-maintained module map into
// dependency-cruiser rules. To change what is allowed, edit `module-boundaries.json`
// and re-run `<pm> run boundaries`. Determinism lives here; semantics live in the map.
//
// The core rule is PUBLIC-ENTRY ONLY: a file outside module M may import M only
// through one of M's declared public entries — never a file inside M's internals.
// A module's own files import each other freely (that's staying within your domain).

/** @type {{ modules: Array<{name:string, path:string, publicEntry:string[], comment?:string}>, layers?: Record<string,string[]>, tsConfig?: string, exclude?: string, orphansAreWarnings?: boolean }} */
const map = require("./module-boundaries.json");

const modules = map.modules ?? [];

// 1) Public-entry-only: from OUTSIDE module M, into M's non-public files → error.
const publicEntryRules = modules.map((m) => ({
  name: `boundary-${m.name}`,
  comment:
    m.comment ??
    `Import "${m.name}" only through its public entry (${m.publicEntry.join(", ")}); its internals are private.`,
  severity: "error",
  from: { pathNot: m.path },
  to: { path: m.path, pathNot: m.publicEntry },
}));

// 2) Optional directional layering: forbid named cross-module edges entirely.
const byName = new Map(modules.map((m) => [m.name, m]));
const layerRules = Object.entries(map.layers ?? {})
  .filter(([name]) => name !== "_comment" && byName.has(name))
  .map(([name, forbids]) => {
    const from = byName.get(name);
    const targets = [].concat(forbids).map((n) => byName.get(n)).filter(Boolean);
    if (targets.length === 0) return null;
    return {
      name: `layer-${name}-must-not-import`,
      comment: `${name} must not depend on: ${[].concat(forbids).join(", ")}.`,
      severity: "error",
      from: { path: from.path },
      to: { path: targets.map((t) => `(${t.path})`).join("|") },
    };
  })
  .filter(Boolean);

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    ...publicEntryRules,
    ...layerRules,
    {
      name: "no-circular",
      comment: "Circular dependencies break modularity and load order.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      comment: "A module imported by nothing is usually dead code.",
      severity: map.orphansAreWarnings === false ? "error" : "warn",
      from: {
        orphan: true,
        pathNot: [
          "\\.d\\.ts$",
          "(^|/)(index|main|preload)\\.[jt]sx?$",
          "\\.(test|spec|stories)\\.[jt]sx?$",
          "(^|/)(vite|vitest|electron\\.vite|playwright|tailwind|postcss)\\.config\\.",
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: map.tsConfig ?? "tsconfig.json" },
    tsPreCompilationDeps: true,
    exclude: {
      path: map.exclude ?? "(^|/)(node_modules|dist|out|build|coverage)/",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      extensions: [".js", ".jsx", ".ts", ".tsx", ".d.ts"],
    },
  },
};
