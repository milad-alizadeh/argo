# Graph Report - .  (2026-07-20)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 360 nodes · 427 edges · 48 communities (17 shown, 31 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 30,249 input · 602 output

## Graph Freshness
- Built from commit: `751c1064`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Biome Config
- Root Package Manifest
- Turbo Build Pipeline
- Desktop App Package
- Session Row & Button
- Runtime Dependencies
- shadcn Components Config
- Node TSConfig
- Web TSConfig
- Electron & React Deps
- Root TSConfig References
- Storybook Main Config
- Launch E2E Spec
- Storybook Vitest Addon
- App Rail Shell
- Electron Toolkit TSConfig
- Playwright
- Rail E2E Spec
- Playwright Test
- Dependency Cruiser
- Vitest Browser Playwright
- Storybook
- Storybook A11y Addon
- Storybook Docs Addon
- Chromatic Storybook
- Electron Vite
- Storybook React Vite
- Tailwind CSS
- Tailwind Vite Plugin
- TW Animate CSS
- Node Types
- React Types
- React DOM Types
- TypeScript
- Vite
- Vite React Plugin
- Vitest
- Vitest Coverage V8
- Playwright Config
- Session State Hub
- Electron
- Renderer Env Types
- Storybook Preview
- Vitest Config

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

### Community 0 - "Biome Config"
Cohesion: 0.06
Nodes (32): source, assist, actions, enabled, css, parser, files, ignoreUnknown (+24 more)

### Community 1 - "Root Package Manifest"
Cohesion: 0.06
Nodes (30): @biomejs/biome, husky, lint-staged, bin, argo, devDependencies, @biomejs/biome, husky (+22 more)

### Community 2 - "Turbo Build Pipeline"
Cohesion: 0.07
Nodes (28): ^build, dist/**, out/**, storybook-static/**, dependsOn, outputs, outputs, cache (+20 more)

### Community 3 - "Desktop App Package"
Cohesion: 0.10
Nodes (20): description, main, name, private, scripts, boundaries, build, build-storybook (+12 more)

### Community 4 - "Session Row & Button"
Cohesion: 0.12
Nodes (18): Button(), buttonVariants, Default, Destructive, Disabled, Ghost, Outline, Small (+10 more)

### Community 5 - "Runtime Dependencies"
Cohesion: 0.10
Nodes (21): dependencies, class-variance-authority, clsx, @electron-toolkit/preload, @electron-toolkit/utils, node-pty, @phosphor-icons/react, radix-ui (+13 more)

### Community 6 - "shadcn Components Config"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 7 - "Node TSConfig"
Cohesion: 0.12
Nodes (15): compilerOptions, composite, types, extends, include, src/shared/**/*, e2e/**/*, @electron-toolkit/tsconfig/tsconfig.node.json (+7 more)

### Community 8 - "Web TSConfig"
Cohesion: 0.13
Nodes (15): compilerOptions, baseUrl, composite, jsx, paths, extends, include, src/shared/**/* (+7 more)

### Community 9 - "Electron & React Deps"
Cohesion: 0.22
Nodes (9): devDependencies, electron-builder, react, react-dom, @storybook/addon-mcp, electron-builder, react, react-dom (+1 more)

### Community 10 - "Root TSConfig References"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 14 - "App Rail Shell"
Cohesion: 0.15
Nodes (13): App(), ADR-0005, EmptyRail(), Rail(), Empty, oneSession, SingleSession, Story (+5 more)

### Community 39 - "Session State Hub"
Cohesion: 0.09
Nodes (25): seedDemoSession(), createHub(), Hub, ProjectionListener, ADR-0005, ADR-0005, ADR-0005, wireProjection() (+17 more)

## Knowledge Gaps
- **187 isolated node(s):** `*.css`, `projectRoot`, `config`, `preview`, `$schema` (+182 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `Electron & React Deps` to `Desktop App Package`, `Storybook Vitest Addon`, `Electron Toolkit TSConfig`, `Playwright`, `Playwright Test`, `Dependency Cruiser`, `Vitest Browser Playwright`, `Storybook`, `Storybook A11y Addon`, `Storybook Docs Addon`, `Chromatic Storybook`, `Electron Vite`, `Storybook React Vite`, `Tailwind CSS`, `Tailwind Vite Plugin`, `TW Animate CSS`, `Node Types`, `React Types`, `React DOM Types`, `TypeScript`, `Vite`, `Vite React Plugin`, `Vitest`, `Vitest Coverage V8`, `Electron`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Runtime Dependencies` to `Desktop App Package`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `*.css`, `projectRoot`, `config` to the rest of the system?**
  _187 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Biome Config` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Should `Root Package Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `Turbo Build Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.07389162561576355 - nodes in this community are weakly interconnected._
- **Should `Desktop App Package` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._