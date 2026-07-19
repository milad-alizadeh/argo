# Graph Report - argo  (2026-07-19)

## Corpus Check
- 52 files · ~7,318 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 360 nodes · 427 edges · 48 communities (17 shown, 31 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d2201b25`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- biome.json
- scripts
- tasks
- scripts
- button.stories.tsx
- dependencies
- components.json
- include
- include
- devDependencies
- tsconfig.json
- main.ts
- launch.spec.ts
- @chromatic-com/storybook
- electron
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
- tailwindcss
- @tailwindcss/vite
- tw-animate-css
- @types/node
- @types/react
- @types/react-dom
- typescript
- vite
- @vitejs/plugin-react
- vitest
- @vitest/coverage-v8
- playwright.config.ts
- index.ts
- index.ts
- env.d.ts
- preview.tsx
- vitest.config.ts

## God Nodes (most connected - your core abstractions)
1. `scripts` - 14 edges
2. `scripts` - 13 edges
3. `tasks` - 11 edges
4. `include` - 9 edges
5. `ProjectionDelta` - 8 edges
6. `emptyState()` - 7 edges
7. `include` - 7 edges
8. `tailwind` - 6 edges
9. `aliases` - 6 edges
10. `Hub` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Window` --references--> `CockpitBridge`  [EXTRACTED]
  apps/desktop/src/preload/index.d.ts → apps/desktop/src/shared/channels.ts
- `createHub()` --calls--> `emptyState()`  [EXTRACTED]
  apps/desktop/src/main/hub.ts → apps/desktop/src/shared/projection.ts
- `App()` --calls--> `useSessionStore`  [EXTRACTED]
  apps/desktop/src/renderer/src/App.tsx → apps/desktop/src/renderer/src/sessionStore.ts
- `StatusDot()` --calls--> `cn()`  [EXTRACTED]
  apps/desktop/src/renderer/src/components/ui/StatusDot.tsx → apps/desktop/src/renderer/src/lib/utils.ts
- `Button()` --calls--> `cn()`  [EXTRACTED]
  apps/desktop/src/renderer/src/components/ui/button.tsx → apps/desktop/src/renderer/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (48 total, 31 thin omitted)

### Community 0 - "biome.json"
Cohesion: 0.06
Nodes (32): source, assist, actions, enabled, css, parser, files, ignoreUnknown (+24 more)

### Community 1 - "scripts"
Cohesion: 0.06
Nodes (30): @biomejs/biome, husky, lint-staged, bin, argo, devDependencies, @biomejs/biome, husky (+22 more)

### Community 2 - "tasks"
Cohesion: 0.07
Nodes (28): ^build, dist/**, out/**, storybook-static/**, dependsOn, outputs, outputs, cache (+20 more)

### Community 3 - "scripts"
Cohesion: 0.10
Nodes (20): description, main, name, private, scripts, boundaries, build, build-storybook (+12 more)

### Community 4 - "button.stories.tsx"
Cohesion: 0.12
Nodes (18): Button(), buttonVariants, Default, Destructive, Disabled, Ghost, Outline, Small (+10 more)

### Community 5 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, class-variance-authority, clsx, @electron-toolkit/preload, @electron-toolkit/utils, node-pty, @phosphor-icons/react, radix-ui (+13 more)

### Community 6 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 7 - "include"
Cohesion: 0.12
Nodes (15): compilerOptions, composite, types, extends, include, src/shared/**/*, e2e/**/*, @electron-toolkit/tsconfig/tsconfig.node.json (+7 more)

### Community 8 - "include"
Cohesion: 0.13
Nodes (15): compilerOptions, baseUrl, composite, jsx, paths, extends, include, src/shared/**/* (+7 more)

### Community 9 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, electron-builder, electron-vite, react, react-dom, electron-builder, electron-vite, react (+1 more)

### Community 10 - "tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 14 - "electron"
Cohesion: 0.15
Nodes (13): App(), ADR-0005, EmptyRail(), Rail(), Empty, oneSession, SingleSession, Story (+5 more)

### Community 39 - "index.ts"
Cohesion: 0.09
Nodes (25): seedDemoSession(), createHub(), Hub, ProjectionListener, ADR-0005, ADR-0005, ADR-0005, wireProjection() (+17 more)

## Knowledge Gaps
- **187 isolated node(s):** `*.css`, `projectRoot`, `config`, `preview`, `$schema` (+182 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `scripts`, `@chromatic-com/storybook`, `@electron-toolkit/tsconfig`, `electron-vite`, `@playwright/test`, `react`, `react-dom`, `storybook`, `@storybook/addon-a11y`, `@storybook/addon-docs`, `@storybook/addon-mcp`, `@storybook/addon-vitest`, `@storybook/react-vite`, `tailwindcss`, `@tailwindcss/vite`, `tw-animate-css`, `@types/node`, `@types/react`, `@types/react-dom`, `typescript`, `vite`, `@vitejs/plugin-react`, `vitest`, `@vitest/coverage-v8`, `index.ts`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `scripts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `*.css`, `projectRoot`, `config` to the rest of the system?**
  _187 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `biome.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `tasks` be split into smaller, more focused modules?**
  _Cohesion score 0.07389162561576355 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._