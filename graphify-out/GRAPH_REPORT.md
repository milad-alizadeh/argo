# Graph Report - argo  (2026-07-19)

## Corpus Check
- 92 files · ~33,396 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 579 nodes · 517 edges · 102 communities (39 shown, 63 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f881db03`
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
- Design System
- Voice concierge architecture — on-device audio-to-audio + delegated reasoning
- tsconfig.json
- Engineering Principles
- Setup Graphify
- Design System
- Engineering Principles
- Agent skills
- UI Component Rules
- Issue tracker: GitHub
- @argo/desktop — Argo Cockpit
- Comment Discipline
- Domain Docs
- Comment Discipline
- UI Component Rules
- argo
- main.ts
- Argo
- h
- launch.spec.ts
- tailwindcss
- @types/react-dom
- playwright.config.ts
- index.ts
- index.d.ts
- env.d.ts
- preview.tsx
- vitest.config.ts
- dependencies.md
- 0001-greenfield-not-salvage.md
- 0002-electron-desktop-runtime.md
- 0003-monorepo-app-beside-skills.md
- 0004-main-process-backend.md
- 0005-state-in-main-renderer-projection.md
- 0006-app-toolchain.md
- 0007-voice-concierge-delegated-reasoning.md
- 0008-persistence-files-only-derived-layer.md
- triage-labels.md
- applypatch-msg
- commit-msg
- husky.sh
- post-applypatch
- post-checkout
- post-commit
- post-merge
- post-rewrite
- pre-applypatch
- pre-auto-gc
- pre-commit
- pre-merge-commit
- pre-push
- pre-rebase
- prepare-commit-msg
- graphify-precommit-block.sh
- dependencies.md

## God Nodes (most connected - your core abstractions)
1. `scripts` - 16 edges
2. `scripts` - 11 edges
3. `tasks` - 10 edges
4. `TypeScript Style Rules` - 9 edges
5. `TypeScript Style Rules` - 9 edges
6. `include` - 8 edges
7. `Design System` - 8 edges
8. `Voice concierge architecture — on-device audio-to-audio + delegated reasoning` - 8 edges
9. `Setup Module Boundaries` - 8 edges
10. `Setup Rules` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Button()` --calls--> `cn()`  [EXTRACTED]
  apps/desktop/src/renderer/src/components/ui/button.tsx → apps/desktop/src/renderer/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (102 total, 63 thin omitted)

### Community 0 - "scripts"
Cohesion: 0.09
Nodes (22): description, main, name, private, scripts, boundaries, build, build-storybook (+14 more)

### Community 1 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, class-variance-authority, clsx, @electron-toolkit/preload, @electron-toolkit/utils, node-pty, @phosphor-icons/react, radix-ui (+11 more)

### Community 2 - "package.json"
Cohesion: 0.07
Nodes (26): husky, lint-staged, bin, argo, devDependencies, husky, lint-staged, turbo (+18 more)

### Community 3 - "scripts"
Cohesion: 0.06
Nodes (30): Argo's own skills, argo-skills, Project-agnostic by design — set up per project, The manifest — `bundle.json`, Use it in a project, What it is, 1. Scout the frontier (inline, in the main session — cheap), 2. Confirm with the user (explicit opt-in + cost) (+22 more)

### Community 4 - "module-boundaries.json"
Cohesion: 0.18
Nodes (10): _comment, exclude, layers, _comment, example-core, modules, orphansAreWarnings, $schema (+2 more)

### Community 5 - "Setup Module Boundaries"
Cohesion: 0.22
Nodes (8): 1. Detect the project shape, 2. Build the module map (the LLM step — this is the whole point), 3. Materialize the checker, 4. Baseline against reality — fix or grandfather, never loosen, 5. Wire CI, 6. Maintain the map (the "LLM maintains it" contract), 7. Report, Setup Module Boundaries

### Community 7 - "@biomejs/biome"
Cohesion: 0.22
Nodes (9): devDependencies, @biomejs/biome, dependency-cruiser, electron-builder, @vitest/browser-playwright, @biomejs/biome, dependency-cruiser, electron-builder (+1 more)

### Community 8 - "dependency-cruiser"
Cohesion: 0.07
Nodes (28): source, assist, actions, enabled, css, parser, files, ignoreUnknown (+20 more)

### Community 10 - "electron-builder"
Cohesion: 0.08
Nodes (26): ^build, dist/**, out/**, storybook-static/**, dependsOn, outputs, outputs, cache (+18 more)

### Community 31 - "@vitest/browser-playwright"
Cohesion: 0.13
Nodes (14): App(), EmptyWindow, Story, Button(), buttonVariants, Default, Destructive, Disabled (+6 more)

### Community 34 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 35 - "include"
Cohesion: 0.14
Nodes (15): compilerOptions, baseUrl, composite, jsx, paths, extends, include, src/renderer/src/**/* (+7 more)

### Community 36 - "include"
Cohesion: 0.13
Nodes (14): compilerOptions, composite, types, extends, include, e2e/**/*, @electron-toolkit/tsconfig/tsconfig.node.json, electron.vite.config.* (+6 more)

### Community 37 - "package.json"
Cohesion: 0.13
Nodes (14): bin, argo-skills, description, files, name, scripts, lint, start (+6 more)

### Community 38 - "scaffold.mjs"
Cohesion: 0.15
Nodes (10): argv, buildArgs(), dryRun, entries, failed, globalOverride, { path, cfg }, projectOverride (+2 more)

### Community 39 - "Folder-split hygiene — extract before you dump"
Cohesion: 0.18
Nodes (10): Apply this rule uniformly, Enforce mechanically where you can, File Structure Rules, Folder-split hygiene — extract before you dump, Group by domain, not by file type, Keep subfolders shallow, Module boundaries — ports and adapters, Public entry per module (barrels) (+2 more)

### Community 40 - "Folder-split hygiene — extract before you dump"
Cohesion: 0.18
Nodes (10): Apply this rule uniformly, Enforce mechanically where you can, File Structure Rules, Folder-split hygiene — extract before you dump, Group by domain, not by file type, Keep subfolders shallow, Module boundaries — ports and adapters, Public entry per module (barrels) (+2 more)

### Community 41 - "TypeScript Style Rules"
Cohesion: 0.20
Nodes (9): Barrels are index.ts, File naming — cased by what the file exports, No comments on obvious code, No dead code, No nested ternaries, One unit per file, Path aliases over deep relative imports, switch over if/else (+1 more)

### Community 42 - "TypeScript Style Rules"
Cohesion: 0.20
Nodes (9): Barrels are index.ts, File naming — cased by what the file exports, No comments on obvious code, No dead code, No nested ternaries, One unit per file, Path aliases over deep relative imports, switch over if/else (+1 more)

### Community 43 - "Design System"
Cohesion: 0.22
Nodes (8): Checklist before you finish styling work, Design System, Escape hatches (the ONLY allowed inline styles), Figma canvas work, Non-token surfaces, Rule 1 — Tokens only, never magic numbers, Rule 2 — Classes/utilities, never inline styles, Token architecture (ADR-0006)

### Community 44 - "Voice concierge architecture — on-device audio-to-audio + delegated reasoning"
Cohesion: 0.22
Nodes (8): Caveats, Disqualified for this requirement, Key sources, Native-full-duplex fallbacks (research-stage, no mature Mac runtime yet), Open questions the spike must answer, Recommendation, The honest trade-offs, Voice concierge architecture — on-device audio-to-audio + delegated reasoning

### Community 45 - "tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, baseUrl, paths, files, src/renderer/src/*, @/*, references

### Community 46 - "Engineering Principles"
Cohesion: 0.25
Nodes (7): Add by adding, not editing (Open/Closed), Depend on the abstraction, not the concretion (DIP), Engineering Principles, One source of truth (DRY + SSOT), One unit, one job (SRP), Self-check before you finish, Simple, and only what's needed (KISS + YAGNI)

### Community 47 - "Setup Graphify"
Cohesion: 0.25
Nodes (7): 1. Install / upgrade graphify, 2. Install the graphify skill + agent integration (official channels), 3. Replace graphify's stock hooks with ours, 4. Keep the graph light in git, 5. Seed the graph once, 6. Report, Setup Graphify

### Community 48 - "Design System"
Cohesion: 0.25
Nodes (7): Checklist before you finish styling work, Design System, Escape hatches (the ONLY allowed inline styles), Figma canvas work, Non-token surfaces, Rule 1 — Tokens only, never magic numbers, Rule 2 — Classes/utilities, never inline styles

### Community 49 - "Engineering Principles"
Cohesion: 0.25
Nodes (7): Add by adding, not editing (Open/Closed), Depend on the abstraction, not the concretion (DIP), Engineering Principles, One source of truth (DRY + SSOT), One unit, one job (SRP), Self-check before you finish, Simple, and only what's needed (KISS + YAGNI)

### Community 50 - "Agent skills"
Cohesion: 0.29
Nodes (6): Agent skills, Argo, Domain docs, Issue tracker, Rules, Triage labels

### Community 51 - "UI Component Rules"
Cohesion: 0.29
Nodes (6): Atomic design — always (atoms → molecules → organisms), Icons — one icon component per file, Reuse before you build, Screens — container/View split, Storybook stories, UI Component Rules

### Community 52 - "Issue tracker: GitHub"
Cohesion: 0.29
Nodes (6): Conventions, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 53 - "@argo/desktop — Argo Cockpit"
Cohesion: 0.33
Nodes (5): @argo/desktop — Argo Cockpit, Commands, Notes, Stack (ADR-0006), Testing seams

### Community 54 - "Comment Discipline"
Cohesion: 0.33
Nodes (5): Comment Discipline, Forbidden in code, Self-check, The one exception: the interface surface, The one sanctioned comment: WHY the code cannot say

### Community 55 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 56 - "Comment Discipline"
Cohesion: 0.33
Nodes (5): Comment Discipline, Forbidden in code, Self-check, The one exception: the interface surface, The one sanctioned comment: WHY the code cannot say

### Community 57 - "UI Component Rules"
Cohesion: 0.33
Nodes (5): Atomic design — always (atoms → molecules → organisms), Icons — one icon component per file, Reuse before you build, Screens — container/View split, UI Component Rules

### Community 58 - "argo"
Cohesion: 0.33
Nodes (5): argo, Dev, Dogfooding, Layout, Scaffold a project — one command, no install

## Knowledge Gaps
- **342 isolated node(s):** `husky.sh script`, `*.css`, `projectRoot`, `config`, `preview` (+337 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **63 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `@biomejs/biome` to `scripts`, `devDependencies`, `electron`, `@electron-toolkit/tsconfig`, `electron-vite`, `playwright`, `@playwright/test`, `react`, `react-dom`, `storybook`, `@storybook/addon-a11y`, `@storybook/addon-docs`, `@storybook/addon-mcp`, `@storybook/addon-vitest`, `@storybook/react-vite`, `@tailwindcss/vite`, `tw-animate-css`, `@types/node`, `@types/react`, `typescript`, `vite`, `@vitejs/plugin-react`, `vitest`, `@vitest/coverage-v8`, `tailwindcss`, `@types/react-dom`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `scripts`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `husky.sh script`, `*.css`, `projectRoot` to the rest of the system?**
  _342 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._