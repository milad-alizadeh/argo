# Graph Report - argo  (2026-07-20)

## Corpus Check
- 127 files · ~36,688 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 610 nodes · 997 edges · 58 communities (27 shown, 31 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `02e3e7ab`
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
- sessionFacts.ts
- index.ts
- Text.tsx
- PaneSplitter.stories.tsx
- icons.stories.tsx
- badge.stories.tsx
- button.stories.tsx
- ContextGauge.tsx
- SectionHeader.tsx
- @storybook/addon-mcp

## God Nodes (most connected - your core abstractions)
1. `createIcon()` - 43 edges
2. `cn()` - 23 edges
3. `Text()` - 16 edges
4. `scripts` - 14 edges
5. `scripts` - 14 edges
6. `sessionFacts` - 12 edges
7. `tasks` - 11 edges
8. `ribbonModel` - 10 edges
9. `include` - 9 edges
10. `shipState` - 8 edges

## Surprising Connections (you probably didn't know these)
- `created()` --calls--> `sessionFacts`  [EXTRACTED]
  apps/desktop/src/main/hub.test.ts → apps/desktop/src/shared/sessionFacts.ts
- `Window` --references--> `CockpitBridge`  [EXTRACTED]
  apps/desktop/src/preload/index.d.ts → apps/desktop/src/shared/channels.ts
- `ContextGauge()` --calls--> `cn()`  [EXTRACTED]
  apps/desktop/src/renderer/src/components/ui/ContextGauge.tsx → apps/desktop/src/renderer/src/lib/utils.ts
- `PaneSplitter()` --calls--> `cn()`  [EXTRACTED]
  apps/desktop/src/renderer/src/components/ui/PaneSplitter.tsx → apps/desktop/src/renderer/src/lib/utils.ts
- `SectionHeader()` --calls--> `cn()`  [EXTRACTED]
  apps/desktop/src/renderer/src/components/ui/SectionHeader.tsx → apps/desktop/src/renderer/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (58 total, 31 thin omitted)

### Community 0 - "Biome Config"
Cohesion: 0.06
Nodes (32): source, assist, actions, enabled, css, parser, files, ignoreUnknown (+24 more)

### Community 1 - "Root Package Manifest"
Cohesion: 0.06
Nodes (31): @biomejs/biome, husky, lint-staged, bin, argo, devDependencies, @biomejs/biome, husky (+23 more)

### Community 2 - "Turbo Build Pipeline"
Cohesion: 0.07
Nodes (28): ^build, dist/**, out/**, storybook-static/**, dependsOn, outputs, outputs, cache (+20 more)

### Community 3 - "Desktop App Package"
Cohesion: 0.05
Nodes (41): dependencies, class-variance-authority, clsx, @electron-toolkit/preload, @electron-toolkit/utils, node-pty, @phosphor-icons/react, radix-ui (+33 more)

### Community 4 - "Session Row & Button"
Cohesion: 0.36
Nodes (6): Button(), buttonVariants, cn(), twMerge, TYPE_ROLES, TypeRole

### Community 5 - "Runtime Dependencies"
Cohesion: 0.06
Nodes (45): ArrowBendDownRightIcon, ArrowClockwiseIcon, ArrowCounterClockwiseIcon, ArrowLineUpIcon, ArrowsClockwiseIcon, ArrowsMergeIcon, ArrowSquareOutIcon, BinocularsIcon (+37 more)

### Community 6 - "shadcn Components Config"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 7 - "Node TSConfig"
Cohesion: 0.12
Nodes (15): compilerOptions, composite, types, extends, include, src/shared/**/*, e2e/**/*, @electron-toolkit/tsconfig/tsconfig.node.json (+7 more)

### Community 8 - "Web TSConfig"
Cohesion: 0.12
Nodes (17): compilerOptions, baseUrl, composite, jsx, paths, extends, include, src/shared/**/* (+9 more)

### Community 9 - "Electron & React Deps"
Cohesion: 0.22
Nodes (9): devDependencies, electron-builder, electron-vite, react, react-dom, electron-builder, electron-vite, react (+1 more)

### Community 10 - "Root TSConfig References"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 14 - "App Rail Shell"
Cohesion: 0.11
Nodes (18): App(), ADR-0005, EmptyRail(), Default, Story, Rail(), Empty, everyState (+10 more)

### Community 25 - "Electron Vite"
Cohesion: 0.08
Nodes (31): SessionRow(), Default, EveryState, Story, RAIL_ICON, StatusIcon(), AllIcons, Default (+23 more)

### Community 39 - "Session State Hub"
Cohesion: 0.10
Nodes (28): seedDemoSession(), createHub(), Hub, ProjectionListener, created(), ADR-0005, ADR-0005, ADR-0005 (+20 more)

### Community 48 - "sessionFacts.ts"
Cohesion: 0.09
Nodes (29): ciState(), commitsState(), mergeState(), prState(), reviewState(), RIBBON_KEYS, ribbonModel, RibbonNodeKey (+21 more)

### Community 49 - "index.ts"
Cohesion: 0.27
Nodes (11): Badge(), BadgeVariant, badgeVariants, ButtonVariant, FINDING_STATE_ACTION, FINDING_STATE_REPORT, FINDING_STATES, FindingAction (+3 more)

### Community 50 - "Text.tsx"
Cohesion: 0.18
Nodes (13): defaultElement(), AllVariants, Coloured, Default, SPECIMEN, Story, VARIANTS, Text() (+5 more)

### Community 51 - "PaneSplitter.stories.tsx"
Cohesion: 0.20
Nodes (11): clampPaneSize(), keyStepDelta(), PANE_ORIENTATIONS, PaneOrientation, PaneSplitter(), PaneSplitterProps, AllOrientations, Default (+3 more)

### Community 52 - "icons.stories.tsx"
Cohesion: 0.17
Nodes (12): AllGlyphs, boxOf(), Decorative, Default, glyph(), GLYPHS, InlineWithText, Labelled (+4 more)

### Community 53 - "badge.stories.tsx"
Cohesion: 0.22
Nodes (8): AllVariants, AsChild, Default, SHAPES, Story, VARIANTS, VERDICT_VARIANTS, WithIcon

### Community 54 - "button.stories.tsx"
Cohesion: 0.22
Nodes (8): AllVariants, AsChild, Default, Disabled, SIZES, Story, VARIANTS, WithIcon

### Community 55 - "ContextGauge.tsx"
Cohesion: 0.43
Nodes (4): clampPercentage(), ContextGauge(), Default, Story

### Community 56 - "SectionHeader.tsx"
Cohesion: 0.40
Nodes (4): SectionHeader(), Default, Story, WithoutCount

## Knowledge Gaps
- **266 isolated node(s):** `*.css`, `projectRoot`, `config`, `project`, `$schema` (+261 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `Electron & React Deps` to `Desktop App Package`, `Storybook Vitest Addon`, `Electron Toolkit TSConfig`, `Playwright`, `Playwright Test`, `Dependency Cruiser`, `Vitest Browser Playwright`, `Storybook`, `Storybook A11y Addon`, `Storybook Docs Addon`, `Chromatic Storybook`, `Storybook React Vite`, `Tailwind CSS`, `Tailwind Vite Plugin`, `TW Animate CSS`, `Node Types`, `React Types`, `React DOM Types`, `TypeScript`, `Vite`, `Vite React Plugin`, `Vitest`, `Vitest Coverage V8`, `Electron`, `@storybook/addon-mcp`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `Text()` connect `Text.tsx` to `Session Row & Button`, `App Rail Shell`, `index.ts`, `PaneSplitter.stories.tsx`, `badge.stories.tsx`, `button.stories.tsx`, `ContextGauge.tsx`, `SectionHeader.tsx`, `Electron Vite`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `cn()` connect `Session Row & Button` to `Runtime Dependencies`, `index.ts`, `Text.tsx`, `PaneSplitter.stories.tsx`, `ContextGauge.tsx`, `SectionHeader.tsx`, `Electron Vite`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `*.css`, `projectRoot`, `config` to the rest of the system?**
  _266 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Biome Config` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Should `Root Package Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Turbo Build Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.07389162561576355 - nodes in this community are weakly interconnected._