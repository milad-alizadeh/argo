# Domain isolation in a frontend monorepo: what enforces a boundary, and what only describes one

**Date:** 2026-09-22 · **For:** making `apps/desktop`'s facet-boundary pattern into a reusable,
project-agnostic setup (a skill or a documented recipe) · **Status:** primary sources read at
source; every tool below was checked against its own docs or its own code, not a summary

## The answer

**Argo already has the two hard parts of this pattern and is missing the third.** It has directional
layer rules, and it has the one trick that makes those rules work in a specifier-matching linter: a
ban on cross-directory relative imports, which forces every boundary crossing into a canonical
`@/…` string the linter can actually see. What it does not have is **any enforcement that a facet
is reached through its `port.ts`**. Ten `port.ts` files exist; the tree deep-imports past them
roughly four to one.

The smallest portable version of the whole pattern is **three Biome rules and one convention**, all
Biome-native at 2.5.4, no new dependency:

1. `noRestrictedImports`, one `overrides` block per layer, directional.
2. `noRestrictedImports` with a `group` of `["../*", "./*/*"]` — the relative-import ban that makes
   rule 1 sound rather than decorative.
3. `noPrivateImports` — the missing port enforcement, via `@package` / `@private` JSDoc, with
   `noImportCycles` optional beside it.

Convention: one path alias (`@/*`), and layer names that are directory names.

Everything below is the evidence, including the tools that do this better than Biome and the reasons
Argo should still not adopt them.

## Inventory

| Tool / pattern | What it does | Source | Verdict for a portable Argo recipe |
|---|---|---|---|
| **Biome `noRestrictedImports`** | Bans import **specifier strings** by gitignore-style glob, with `!` negation; per-path messages; `importNames` / `allowImportNames` | [docs](https://biomejs.dev/linter/rules/no-restricted-imports/), [`no_restricted_imports.rs`](https://raw.githubusercontent.com/biomejs/biome/main/crates/biome_js_analyze/src/lint/style/no_restricted_imports.rs) | **Adopt.** What Argo already runs. Matches the literal specifier, never a resolved path — see *The load-bearing trick* |
| **Biome `noPrivateImports`** | `@public` / `@package` / `@private` JSDoc visibility on exports; `@package` = importable from the same folder and its subfolders only; `defaultVisibility` configurable | [docs](https://biomejs.dev/linter/rules/no-private-imports/) | **Adopt.** This is the `port.ts` rule Argo is missing, and it is already in the linter Argo runs |
| **Biome `noImportCycles`** | Detects direct and indirect import cycles; `ignoreTypes` on by default | [docs](https://biomejs.dev/linter/rules/no-import-cycles/) | **Optional.** Docs call it "computationally expensive"; it is the barrel-file safety net |
| **Biome `project` domain / Scanner** | Both rules above need it: "Biome will scan the entire project. The scanning phase will have a performance impact on the linting process." | [domains](https://biomejs.dev/linter/domains/) | The price of rules 2 and 3. Measure before committing |
| **Biome GritQL plugins** | Match code patterns, report diagnostics, suggest fixes, scoped by glob | [plugins](https://biomejs.dev/linter/plugins/) | **Dead end for boundaries.** Docs never document access to the linted file's path, so a plugin cannot express "this file may import that file". Argo's own plugins (`design-values-js.grit`, `i18n.grit`) are content rules, not path rules |
| **VS Code `code-layering`** | 60 lines of ESLint rule; config is a flat `{ layer: [allowed layers] }` map keyed on **directory name anywhere in the path** | [`code-layering.ts`](https://raw.githubusercontent.com/microsoft/vscode/main/.eslint-plugin-local/code-layering.ts), [`eslint.config.js` L116](https://raw.githubusercontent.com/microsoft/vscode/main/eslint.config.js) | **Steal the shape, not the code.** The cheapest correct boundary rule anyone has written |
| **VS Code `code-no-deep-import-of-internal`** | Modules whose path segment matches `.*Internal` may be imported only by files under their direct parent directory | [`code-no-deep-import-of-internal.ts`](https://raw.githubusercontent.com/microsoft/vscode/main/.eslint-plugin-local/code-no-deep-import-of-internal.ts) | **Steal the idea.** Encapsulation keyed on a *name convention*, needing zero per-module config |
| **VS Code `code-import-patterns`** | `{ target, layer, restrictions, when }` — the full allowlist, per directory, with conditional patterns gated on `hasBrowser` / `hasNode` / `hasElectron` / `test` | [`code-import-patterns.ts`](https://github.com/microsoft/vscode/blob/main/.eslint-plugin-local/code-import-patterns.ts), `eslint.config.js` L1547 and L2307 | **Dead end.** ~1,400 lines of hand-maintained allowlist in one config. This is the maintenance cost Argo is trying not to buy |
| **Nx `@nx/enforce-module-boundaries`** | Project **tags** + `depConstraints` (`sourceTag`, `onlyDependOnLibsWithTags`, `notDependOnLibsWithTags`, `allowedExternalImports`, `bannedExternalImports`); blocks deep imports past a library's root `index.ts`; flags cycles | [feature docs](https://nx.dev/docs/features/enforce-module-boundaries) | **Dead end here.** Portable only into an Nx workspace. Argo is Bun workspaces, not Nx |
| **`eslint-plugin-boundaries` / JS Boundaries** | `boundaries/elements` classify files by path pattern into types; `dependencies` rule allows/denies type→type; `entry-point` forces `allow: "index.js"`; `no-private` blocks reaching into a nested element, `allowUncles` default `false` | [README](https://raw.githubusercontent.com/javierbrea/eslint-plugin-boundaries/master/README.md), [entry-point](https://www.jsboundaries.dev/docs/rules/entry-point), [no-private](https://www.jsboundaries.dev/docs/rules/no-private) | **The closest match to Argo's model, and the strongest fallback.** Costs ESLint alongside Biome |
| **`@softarc/sheriff`** | TS-native. `index.ts` **is** the public API, deep imports blocked by default; tags auto-derived from directory patterns; `sheriff.config.ts`; CLI *and* ESLint plugin; zero deps beyond TypeScript | [README](https://raw.githubusercontent.com/softarc-consulting/sheriff/main/README.md) | **The best single-purpose tool found.** `npx sheriff init` is genuinely drop-in. Costs a new dependency and a second lint pass |
| **`import/no-restricted-paths`** | `zones: [{ target, from, except, message }]`, `basePath`. Matches **the resolved file path**, not the written specifier | [rule doc](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md) | **Dead end.** Strictly better matching than Biome, but `from` cannot mix directories and globs, `except` cannot backtrack, and it brings ESLint + a resolver |
| **`dependency-cruiser`** | `forbidden` / `allowed` / `required` rules over `from`/`to` with **regexes and capture groups**, plus `circular`, `orphan`, `reachable`, `moreUnstable` | [rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md) | **Dead end as the primary gate, useful as a second opinion.** Capture groups express "folder X may not reach sibling folder Y" in one rule; no dedicated entry-point feature |
| **TypeScript project references** | `composite` forces `declaration` and complete `include`; a referenced project is consumed as its emitted `.d.ts` | [handbook](https://www.typescriptlang.org/docs/handbook/project-references.html) | **Dead end as a boundary.** It controls *what is visible*, not *who may see it*. No directional rules, and one `tsconfig` per facet × per domain is a lot of files |
| **`package.json` `exports`** | Real runtime encapsulation: an undeclared subpath throws `ERR_PACKAGE_PATH_NOT_EXPORTED`; `"./internal/*": null` blocks a subtree; `imports` + `#` gives package-private specifiers | [Node packages docs](https://nodejs.org/api/packages.html) | **The only non-advisory option, and out of reach.** Requires each domain to be a real workspace package |

## The load-bearing trick, and why it is the finding

Biome's `noRestrictedImports` **matches the literal import specifier string**. The rule reads
`import_source` straight off the module-name token and globs it; it never resolves anything to a
file. `import/no-restricted-paths` says the opposite about itself in as many words — *"The `from`
attribute is NOT matched literally against the import path string as it appears in the code.
Instead, it's matched against the path to the imported file after it's been resolved."*

That difference normally makes a specifier-matching linter useless for architecture, because
`../../domains/sessions/main/port` and `@/domains/sessions/main/port` are the same file and only the
second is matchable. Argo closes the hole with one extra pattern, repeated in all four layer blocks
(`biome.jsonc` L274, L325, L362, L404):

```jsonc
{
  "group": ["../*", "./*/*"],
  "message": "./ imports stay in the current directory. Use @/ for parent or cross-directory source imports."
}
```

With `../*` and `./*/*` banned, **every crossing of a directory boundary is spelled `@/…`**, and a
glob over `@/…` is therefore complete. This converts a string matcher into a sound path matcher
without a resolver, a scanner, or a second lint tool. It is the highest-leverage line in the config
and nothing in the repo says why it is there.

Two live consequences, both worth writing down before this is packaged:

- The trick is **load-bearing, not stylistic**. Relaxing that one pattern silently voids all four
  layer rules. It belongs in the recipe as a rule, not as a formatting preference.
- Biome's own [`useConsistentImportPaths`](https://github.com/biomejs/biome/issues/5936) is still
  open, so today the ban is the only way to get the invariant.

## Layers: what everybody actually does

VS Code's `code-layering` is the whole idea in 60 lines and it is worth reading before writing
anything. It walks the linting file's directory parts from the right, takes the **first segment that
appears as a key** in the config, builds `allowed = {that key} ∪ config[key]` and
`disallowed = every other key`, then walks the imported path's parts from the right and reports on
the first disallowed segment it meets. The entire configuration is:

```js
'common': [],
'node': ['common'],
'browser': ['common'],
'electron-browser': ['common', 'browser'],
'electron-utility': ['common', 'node'],
'electron-main': ['common', 'node', 'electron-utility'],
```

Argo's four blocks say the same thing in about 180 lines of JSON, because Biome has no rule
primitive for "layer" and every relation must be expanded into an explicit deny-glob. That is a fair
trade for not running a second linter, but it is why a *portable* version needs a generator rather
than a copied config: the JSON is quadratic in the number of layers.

Two honest notes about the VS Code precedent, since it is the one most likely to be cited:

- **`code-layering` and `code-import-patterns` are both `'warn'`, not `'error'`.** The layer
  discipline of the most-cited layered TypeScript codebase in existence is advisory in its own lint
  config. Argo's equivalents are `"level": "error"`. **Argo is ahead here.**
- `code-import-patterns` carries the real weight and it is enormous — two blocks at `eslint.config.js`
  L1547 and L2307, hundreds of `{ target, restrictions }` entries, down to an allowlist of Node
  built-ins with `// 'path', NOT allowed: use src/vs/base/common/path.ts instead` written inline.
  It works, and no small project should copy it.

## Reaching a facet only through its port

This is the part Argo has as a convention and does not have as a gate. Four mechanisms exist; three
are real and one is a convention doing the work of config.

**1. Nx tags — forced `index.ts`.** Nx's rule ensures that import statements going across projects
only import from the public API in a project's root `index.ts`, and errors on a deep import into a
library. Real enforcement, but it is a property of an Nx workspace graph, so it is not portable to a
non-Nx repo at all.

**2. `boundaries/entry-point` — explicit allowlist per element type.** The config is exactly the
shape Argo wants:

```js
"boundaries/entry-point": [2, {
  default: "disallow",
  policies: [{ target: { type: ["component", "module"] }, allow: "index.js" }]
}]
```

Paired with `boundaries/no-private` — *"An element becomes private when it is nested under another
element"*, with `allowUncles` defaulting to `false` — this is a complete public-API model. Note both
rules are now **deprecated in favour of the newer `boundaries/dependencies` rule**, which is a
reason to read the current docs before adopting, not a reason to avoid the plugin.

**3. Sheriff — `index.ts` is the API, by construction.** *"Enforcing module boundaries by defining
public APIs through `index.ts` files"*, tags derived from directory patterns, `npx sheriff init`,
zero dependencies beyond TypeScript, and it ships both a CLI and an ESLint plugin so it can gate
without ESLint owning the whole lint pass. For a drop-in, project-agnostic recipe this is the
strongest single artefact found.

**4. Biome `noPrivateImports` — the one Argo can have today.** Visibility is declared on the export
itself, in JSDoc:

- `@public` (the default, and `defaultVisibility` is configurable) — no restriction.
- `@package` — *"visible within the same 'package', which means that any module that resides in the
  same folder, or one of its subfolders, is allowed to import the symbol."*
- `@private` — *"a symbol may not be imported from other modules."*

Mark a facet's internals `@package` and leave only `port.ts`'s re-exports `@public`, and a deep
import from another domain fails the build. This is the closest Biome gets to an entry-point rule,
and it is genuinely close. Its documented limits: JS/TS imports only (asset imports exempt), no
`import()` or `require()`, `node_modules` out of scope — none of which matters for `apps/desktop`.

**And the cheapest of the lot: VS Code's `code-no-deep-import-of-internal`.** Configured as
`['error', { '.*Internal': true, 'searchExtTypesInternal': false }]`, it needs no per-module setup at
all: any path segment matching `.*Internal` may only be imported by files under that segment's parent
directory. *"No deep import of internal modules allowed! Use a re-export from a non-internal module
instead."* The convention **is** the config. It is the pattern a `port.ts` recipe should consider
inverting: rather than naming what is public, name what is internal.

## What Argo's config actually enforces today, measured

Read at `biome.jsonc` L254–434 and counted across `apps/desktop/src`.

**Layer isolation: real, and strict.** Contract and shared are the tightest — they ban `electron`,
`node-pty`, `react`, every `node:*` specifier, and every `main` / `preload` / `renderer` / `providers`
/ `core` path, so `contract` is genuinely runtime-neutral. The renderer block additionally bans
`electron`, `node-pty` and `node:*` by path *and* by pattern. `main` cannot see `preload` or
`renderer`. All four are `"level": "error"`.

**Port isolation: absent.** Nothing in any block distinguishes *this* domain's facet from *another*
domain's facet. The renderer block bans `@/domains/*/main/**` but permits `@/domains/*/renderer/**`
for every value of `*`, so `tickets/renderer` may reach any file under `sessions/renderer`. The tree
does exactly that:

| Specifier | Occurrences |
|---|---|
| `@/domains/sessions/contract/model/models` | 114 |
| `@/domains/sessions/contract/model/transcript` | 95 |
| `@/domains/sessions/renderer/types` | 93 |
| `@/domains/sessions/main/observation/reader` | 65 |
| `@/domains/sessions/main/port` | **23** |
| `@/domains/accounts/renderer/port` | **13** |
| `@/domains/projects/renderer/port` | **12** |
| `@/domains/tickets/main/port` | **12** |

Ten `port.ts` files exist (`sessions`, `projects`, `tickets`, `accounts` × `main`/`renderer`,
`connections/main`, `platform/main`). The four most-imported specifiers in the app are all deep
paths. The port files are documentation.

**Facet coverage is uneven and unchecked.** `atlas` has only `renderer`; `connections` has only
`main`; neither has a `contract`. Nothing requires a domain to have any particular facet, which is
fine, but a recipe should say so rather than imply a four-facet grid.

**Where Argo is ahead of common practice:** errors not warnings; a runtime-neutrality rule on
`contract` that VS Code approximates only through its `when: hasNode` conditional allowlists; and
the relative-import ban, which is the correct and non-obvious fix for a specifier-matching linter.

**Where Argo is behind:** no port enforcement, no cycle rule (`noImportCycles` is off), no
cross-domain rule at all, and — as `apps/desktop/AGENTS.md` shows on a grep for "facet" — **the
whole scheme is written down only in `biome.jsonc` itself.**

## The honest downside list

- **Barrels cost load time, and the cost is documented by the people who had to fix it.** Next.js
  ships `experimental.optimizePackageImports` precisely because *"Some packages can export hundreds
  or thousands of modules, which can cause performance issues in development and production"*, and
  the flag exists to *"only load the modules you are actually using"*. A `port.ts` per facet is a
  barrel. In a bundled Electron renderer this is a dev-server and cold-start cost, not a download
  cost, but it is not zero.
- **Barrels invite cycles.** Two facets that each import the other's `port.ts` form a cycle through
  files that would not otherwise touch. Biome's `noImportCycles` is the mitigation and its own docs
  warn it is *"computationally expensive"*.
- **Lint-only enforcement is advisory.** Nothing here changes what the module system will load. The
  only mechanism in the inventory with runtime teeth is `package.json` `exports` —
  `ERR_PACKAGE_PATH_NOT_EXPORTED` — and it requires each domain to be a real package. Everything
  else can be bypassed by a `biome-ignore`, and this repo's house rules already ban inline
  suppression for exactly that reason.
- **The config grows quadratically in layers.** Argo's four layers cost ~180 lines of JSON. Six
  layers would cost roughly double. This is the strongest argument for generating the config rather
  than shipping a static template.
- **The `project` domain makes lint slower.** `noPrivateImports` and `noImportCycles` both turn on
  the Scanner, and Biome's own docs say the scan *"will have a performance impact on the linting
  process."* Argo's selling point over ESLint is speed; spending it should be a measured decision.
- **VS Code, at scale, ended up with a 1,400-line allowlist.** That is the honest long-run shape of
  a per-directory `restrictions` model. Convention-keyed rules (`code-layering`,
  `code-no-deep-import-of-internal`, `noPrivateImports`) do not grow that way, which is the real
  argument for them.

## Recommendation: what Argo should build

**Build a `setup-domain-boundaries` skill, in the shape of the existing `setup-quality-gates`
skill: a generator plus two conventions, not a copied config.**

The portable core, in order of what earns its place:

1. **One convention the recipe asks for, and only one: a path alias.** `@/*` → `src/*` in
   `tsconfig`, matching Argo's existing setup. Everything else follows from it.
2. **The relative-import ban, always, first.** `{ "group": ["../*", "./*/*"] }`. Without it the
   layer rules are decoration. This is the finding the skill exists to carry.
3. **A generated layer matrix.** The skill takes a layer map in `code-layering`'s shape —
   `{ contract: [], main: ["contract"], preload: ["contract"], renderer: ["contract"] }` — plus a
   directory template (`src/domains/<domain>/<layer>/`), and emits the `overrides` blocks. Layer
   names stay the repo's own; the skill never hardcodes `main`/`preload`/`renderer`.
4. **Port enforcement via `noPrivateImports`, not via a new tool.** The recipe is a convention:
   `port.ts` exports `@public`, everything else in the facet is `@package`. No dependency, no second
   lint pass, and it is the gate Argo is missing today. Turn it on for `apps/desktop` first and
   measure the Scanner cost before it goes in the template.
5. **`noImportCycles` as an opt-in flag**, off by default, documented as the barrel safety net.

**What not to build.** Do not write a GritQL plugin for this — Biome's plugin docs document no
access to the linted file's path, so a plugin cannot express a path-to-path rule. Do not adopt Nx
for the rule alone. Do not add ESLint beside Biome for `eslint-plugin-boundaries` unless
`noPrivateImports` fails in practice; if it does, **Sheriff is the fallback to reach for first**,
because its CLI can gate without ESLint owning the lint pass, and `index.ts`-as-API is its default
rather than a configuration.

**One thing to fix in `apps/desktop` regardless of the skill.** The facet scheme is written down
only in `biome.jsonc`. Either `apps/desktop/AGENTS.md` names the facets, the directional rules and
the `port.ts` convention, or the next agent to add a domain will deep-import past three ports and
the gate will let it through — as it has some 300 times already.

## Unverified

- **The Scanner's real cost on `apps/desktop`.** Biome's docs say the `project` domain scans the
  whole project and warns twice about the impact. No number is published and none was measured here.
- **Whether `noPrivateImports` reads JSDoc on a re-export.** The `port.ts` pattern depends on
  `export { x } from "./internal"` in `port.ts` being `@public` while the original declaration is
  `@package`. The docs describe visibility on *exports* and mention that a `@private` symbol stays
  reachable from submodules in the same folder through index files, which implies this works, but it
  was not run.
- **Nx's rule options list.** Both rule-page URLs returned **404** to the fetcher; the option names
  (`allowedExternalImports`, `bannedExternalImports`, `depConstraints`, `sourceTag`,
  `allSourceTags`, `onlyDependOnLibsWithTags`) come from the feature page and from search-result
  extracts of the rule page, not from the rule page itself. Treat them as correct in spirit and
  re-check before quoting.
- **`boundaries/dependencies`.** `entry-point` and `no-private` both carry deprecation notices
  pointing at it, and its own page was not read. If the plugin is ever adopted, read that page
  first — the inventory's description of the plugin is one release behind.
- **dependency-cruiser's entry-point story.** The rules reference has no dedicated feature for it;
  the claim that path rules and reachability constraints can approximate one is the fetcher's
  reading, not a documented capability.
- **`code-import-patterns`' exact line count.** Two config blocks were located (L1547, L2307) and
  sampled; the ~1,400-line figure is an estimate from the file's 3,012 total lines, not a count.

## Primary sources

**In this repository, read directly:** `biome.jsonc` L254–434 (the four facet blocks) ·
`apps/desktop/tsconfig.json` (`@/*` → `./src/*`) · `apps/desktop/tsconfig.web.json` ·
`apps/desktop/src/domains/` (6 domains, 10 `port.ts` files) · `apps/desktop/AGENTS.md` (no mention
of facets, ports or contracts) · `package.json` (`@biomejs/biome` **2.5.4**)

**Fetched 2026-09-22 — Biome:** [noRestrictedImports](https://biomejs.dev/linter/rules/no-restricted-imports/) ·
[noPrivateImports](https://biomejs.dev/linter/rules/no-private-imports/) ·
[noImportCycles](https://biomejs.dev/linter/rules/no-import-cycles/) ·
[linter domains](https://biomejs.dev/linter/domains/) · [linter plugins](https://biomejs.dev/linter/plugins/) ·
[`no_restricted_imports.rs`](https://raw.githubusercontent.com/biomejs/biome/main/crates/biome_js_analyze/src/lint/style/no_restricted_imports.rs) ·
[biomejs/biome#5936 `useConsistentImportPaths`](https://github.com/biomejs/biome/issues/5936) (open)

**Fetched 2026-09-22 — microsoft/vscode, `main`:**
[`.eslint-plugin-local/code-layering.ts`](https://raw.githubusercontent.com/microsoft/vscode/main/.eslint-plugin-local/code-layering.ts) ·
[`code-no-deep-import-of-internal.ts`](https://raw.githubusercontent.com/microsoft/vscode/main/.eslint-plugin-local/code-no-deep-import-of-internal.ts) ·
[`code-import-patterns.ts`](https://github.com/microsoft/vscode/blob/main/.eslint-plugin-local/code-import-patterns.ts) ·
[`eslint.config.js`](https://raw.githubusercontent.com/microsoft/vscode/main/eslint.config.js) (3,012 lines;
layering at L116, import-patterns at L1547 and L2307) · `.eslint-plugin-local/` directory listing
(56 local rules) · `build/checker/layersChecker.ts` (located; the type-level companion, not read)

**Fetched 2026-09-22 — the other tools:**
[Nx enforce module boundaries](https://nx.dev/docs/features/enforce-module-boundaries) ·
[eslint-plugin-boundaries README](https://raw.githubusercontent.com/javierbrea/eslint-plugin-boundaries/master/README.md) ·
[JS Boundaries `entry-point`](https://www.jsboundaries.dev/docs/rules/entry-point) ·
[JS Boundaries `no-private`](https://www.jsboundaries.dev/docs/rules/no-private) ·
[Sheriff README](https://raw.githubusercontent.com/softarc-consulting/sheriff/main/README.md) ·
[`import/no-restricted-paths`](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-restricted-paths.md) ·
[dependency-cruiser rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md) ·
[TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html) ·
[Node.js packages / `exports` / `imports`](https://nodejs.org/api/packages.html) ·
[Next.js `optimizePackageImports`](https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports)

**Failed fetches, recorded as findings:**
`nx.dev/docs/technologies/eslint/eslint-plugin/guides/enforce-module-boundaries` **404** ·
`nx.dev/docs/concepts/decisions/project-dependency-rules` **404** ·
`raw.githubusercontent.com/microsoft/vscode/main/build/lib/layersChecker.ts` **404** (the file is at
`build/checker/layersChecker.ts`) ·
`eslint-plugin-boundaries` `docs/rules/*.md` in the repo are migration stubs pointing at
jsboundaries.dev.
