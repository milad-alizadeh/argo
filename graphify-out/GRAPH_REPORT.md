# Graph Report - argo  (2026-07-19)

## Corpus Check
- 40 files · ~6,458 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 334 nodes · 320 edges · 53 communities (19 shown, 34 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ba3eea8c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- scripts
- dependencies
- package.json
- scripts
- module-boundaries.json
- Setup Module Boundaries
- devDependencies
- @biomejs/biome
- dependency-cruiser
- electron
- electron-builder
- @electron-toolkit/tsconfig
- electron-vite
- playwright
- @playwright/test
- react
- react-dom
- storybook
- @storybook/addon-a11y
- @storybook/addon-docs
- @storybook/addon-mcp
- @storybook/addon-vitest
- @storybook/react-vite
- @tailwindcss/vite
- tw-animate-css
- @types/node
- @types/react
- typescript
- vite
- @vitejs/plugin-react
- vitest
- @vitest/browser-playwright
- @vitest/coverage-v8
- CLAUDE.md
- components.json
- include
- include
- package.json
- scaffold.mjs
- Folder-split hygiene — extract before you dump
- Folder-split hygiene — extract before you dump
- TypeScript Style Rules
- TypeScript Style Rules
- Voice concierge architecture — on-device audio-to-audio + delegated reasoning
- tsconfig.json
- Engineering Principles
- Setup Graphify
- Design System
- Engineering Principles

## God Nodes (most connected - your core abstractions)
1. `scripts` - 16 edges
2. `scripts` - 11 edges
3. `tasks` - 10 edges
4. `include` - 8 edges
5. `tailwind` - 6 edges
6. `aliases` - 6 edges
7. `include` - 6 edges
8. `formatter` - 5 edges
9. `Button()` - 5 edges
10. `compilerOptions` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Button()` --calls--> `cn()`  [EXTRACTED]
  apps/desktop/src/renderer/src/components/ui/button.tsx → apps/desktop/src/renderer/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (53 total, 34 thin omitted)

### Community 0 - "scripts"
Cohesion: 0.07
Nodes (28): source, assist, actions, enabled, css, parser, files, ignoreUnknown (+20 more)

### Community 1 - "dependencies"
Cohesion: 0.07
Nodes (26): husky, lint-staged, bin, argo, devDependencies, husky, lint-staged, turbo (+18 more)

### Community 2 - "package.json"
Cohesion: 0.08
Nodes (26): ^build, dist/**, out/**, storybook-static/**, dependsOn, outputs, outputs, cache (+18 more)

### Community 3 - "scripts"
Cohesion: 0.09
Nodes (22): description, main, name, private, scripts, boundaries, build, build-storybook (+14 more)

### Community 4 - "module-boundaries.json"
Cohesion: 0.13
Nodes (14): App(), EmptyWindow, Story, Button(), buttonVariants, Default, Destructive, Disabled (+6 more)

### Community 5 - "Setup Module Boundaries"
Cohesion: 0.11
Nodes (19): dependencies, class-variance-authority, clsx, @electron-toolkit/preload, @electron-toolkit/utils, node-pty, @phosphor-icons/react, radix-ui (+11 more)

### Community 6 - "devDependencies"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 7 - "@biomejs/biome"
Cohesion: 0.12
Nodes (14): byName, layerRules, map, publicEntryRules, _comment, exclude, layers, _comment (+6 more)

### Community 8 - "dependency-cruiser"
Cohesion: 0.13
Nodes (14): compilerOptions, composite, types, extends, include, e2e/**/*, @electron-toolkit/tsconfig/tsconfig.node.json, electron.vite.config.* (+6 more)

### Community 9 - "electron"
Cohesion: 0.13
Nodes (14): bin, argo-skills, description, files, name, scripts, lint, start (+6 more)

### Community 10 - "electron-builder"
Cohesion: 0.14
Nodes (14): compilerOptions, baseUrl, composite, jsx, paths, extends, include, @renderer/* (+6 more)

### Community 11 - "@electron-toolkit/tsconfig"
Cohesion: 0.15
Nodes (10): argv, buildArgs(), dryRun, entries, failed, globalOverride, { path, cfg }, projectOverride (+2 more)

### Community 12 - "electron-vite"
Cohesion: 0.22
Nodes (9): devDependencies, dependency-cruiser, electron-builder, playwright, @vitest/browser-playwright, dependency-cruiser, electron-builder, playwright (+1 more)

### Community 13 - "playwright"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 14 - "@playwright/test"
Cohesion: 0.40
Nodes (4): byName, layerRules, map, publicEntryRules

## Knowledge Gaps
- **199 isolated node(s):** `*.css`, `projectRoot`, `config`, `preview`, `$schema` (+194 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `electron-vite` to `scripts`, `storybook`, `@storybook/addon-a11y`, `@storybook/addon-docs`, `@storybook/addon-mcp`, `@storybook/addon-vitest`, `@storybook/react-vite`, `@tailwindcss/vite`, `tw-animate-css`, `@types/node`, `@types/react`, `typescript`, `vite`, `@vitejs/plugin-react`, `vitest`, `@vitest/browser-playwright`, `@vitest/coverage-v8`, `CLAUDE.md`, `components.json`, `include`, `include`, `package.json`, `scaffold.mjs`, `Folder-split hygiene — extract before you dump`, `Folder-split hygiene — extract before you dump`, `TypeScript Style Rules`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Setup Module Boundaries` to `scripts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `*.css`, `projectRoot`, `config` to the rest of the system?**
  _199 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07977207977207977 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._