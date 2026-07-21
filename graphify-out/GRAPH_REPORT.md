# Graph Report - argo  (2026-07-21)

## Corpus Check
- 217 files · ~117,719 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1052 nodes · 2105 edges · 78 communities (46 shown, 32 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ea296257`
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
- PanelSplitter.stories.tsx
- WorkspaceIdentity.tsx
- Text.tsx
- icons.stories.tsx
- drawerControls.tsx
- button.stories.tsx
- DeliveryLifecycle.stories.tsx
- DeliveryTabs.stories.tsx
- FindingCard.stories.tsx
- LifecycleNode.stories.tsx
- badge.stories.tsx
- BackgroundTasks.stories.tsx
- ContextGauge.tsx
- SectionHeader.tsx
- toggle-group.tsx
- checkbox.stories.tsx
- electron-vite
- happy-dom
- react
- react-dom

## God Nodes (most connected - your core abstractions)
1. `cn()` - 70 edges
2. `createIcon()` - 46 edges
3. `Text()` - 45 edges
4. `Button()` - 17 edges
5. `scripts` - 16 edges
6. `scripts` - 14 edges
7. `NodeDrawer()` - 12 edges
8. `CheckIcon` - 12 edges
9. `sessionFacts` - 12 edges
10. `NodeDrawerSession` - 11 edges

## Surprising Connections (you probably didn't know these)
- `created()` --calls--> `sessionFacts`  [EXTRACTED]
  apps/desktop/src/main/hub.test.ts → apps/desktop/src/shared/sessionFacts.ts
- `Window` --references--> `CockpitBridge`  [EXTRACTED]
  apps/desktop/src/preload/index.d.ts → apps/desktop/src/shared/channels.ts
- `PhaseGroup()` --calls--> `doneAgentCount()`  [EXTRACTED]
  apps/desktop/src/renderer/src/domains/activity/components/PhaseGroup.tsx → apps/desktop/src/renderer/src/domains/activity/components/agentState.ts
- `PhaseGroup()` --calls--> `cn()`  [EXTRACTED]
  apps/desktop/src/renderer/src/domains/activity/components/PhaseGroup.tsx → apps/desktop/src/renderer/src/lib/utils.ts
- `PhaseGroup()` --calls--> `useDisclosure()`  [EXTRACTED]
  apps/desktop/src/renderer/src/domains/activity/components/PhaseGroup.tsx → apps/desktop/src/renderer/src/shared/components/ui/useDisclosure.ts

## Import Cycles
- None detected.

## Communities (78 total, 32 thin omitted)

### Community 0 - "Biome Config"
Cohesion: 0.06
Nodes (33): source, assist, actions, enabled, css, parser, files, ignoreUnknown (+25 more)

### Community 1 - "Root Package Manifest"
Cohesion: 0.06
Nodes (33): @biomejs/biome, husky, lint-staged, bin, argo, devDependencies, @biomejs/biome, husky (+25 more)

### Community 2 - "Turbo Build Pipeline"
Cohesion: 0.07
Nodes (28): ^build, dist/**, out/**, storybook-static/**, dependsOn, outputs, outputs, cache (+20 more)

### Community 3 - "Desktop App Package"
Cohesion: 0.05
Nodes (41): dependencies, class-variance-authority, clsx, @electron-toolkit/preload, @electron-toolkit/utils, node-pty, @phosphor-icons/react, radix-ui (+33 more)

### Community 4 - "Session Row & Button"
Cohesion: 0.13
Nodes (20): DeliveryLifecycle(), TERMINAL_PRESENTATION, LifecycleNode(), NODE_LABEL, PrAnchor(), Default, Story, cn() (+12 more)

### Community 5 - "Runtime Dependencies"
Cohesion: 0.05
Nodes (50): LIFECYCLE_NODE_STATE, LifecycleNodeStatePresentation, ArrowBendDownRightIcon, ArrowClockwiseIcon, ArrowCounterClockwiseIcon, ArrowLineUpIcon, ArrowRightIcon, ArrowsClockwiseIcon (+42 more)

### Community 6 - "shadcn Components Config"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 7 - "Node TSConfig"
Cohesion: 0.12
Nodes (15): compilerOptions, composite, types, extends, include, src/shared/**/*, e2e/**/*, @electron-toolkit/tsconfig/tsconfig.node.json (+7 more)

### Community 8 - "Web TSConfig"
Cohesion: 0.12
Nodes (17): compilerOptions, baseUrl, composite, jsx, paths, extends, include, src/shared/**/* (+9 more)

### Community 10 - "Root TSConfig References"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 14 - "App Rail Shell"
Cohesion: 0.05
Nodes (43): App(), ADR-0005, Roster(), deliveryStates, Empty, everyState, oneSession, PR (+35 more)

### Community 15 - "Electron Toolkit TSConfig"
Cohesion: 0.22
Nodes (9): devDependencies, @chromatic-com/storybook, electron, @electron-toolkit/tsconfig, @vitest/browser-playwright, @chromatic-com/storybook, electron, @electron-toolkit/tsconfig (+1 more)

### Community 20 - "Vitest Browser Playwright"
Cohesion: 0.06
Nodes (51): AllFilesDiff(), AllFilesDiffFile, Default, Empty, FILES, Story, CommitGroup(), CommitGroupFile (+43 more)

### Community 23 - "Storybook Docs Addon"
Cohesion: 0.06
Nodes (46): captureLabel(), Console(), ConsoleProps, CAPTURE, CaptureActive, CaptureIdle, Default, Expanded (+38 more)

### Community 25 - "Electron Vite"
Cohesion: 0.10
Nodes (24): CiCard(), CiCardProps, Default, Story, WithoutTrailing, DeliveryLifecycleProps, CHANGES_VIEWS, DELIVERY_TABS (+16 more)

### Community 39 - "Session State Hub"
Cohesion: 0.05
Nodes (57): seedDemoSession(), createHub(), Hub, ProjectionListener, created(), ADR-0005, ADR-0005, ADR-0005 (+49 more)

### Community 40 - "Electron"
Cohesion: 0.18
Nodes (18): ConsoleChannelTab(), ConsoleChannelTabProps, Badge(), BadgeVariant, badgeVariants, Button(), ButtonVariant, buttonVariants (+10 more)

### Community 48 - "sessionFacts.ts"
Cohesion: 0.09
Nodes (21): CiFailingHead, CiRunning, CommitsGate, CommitsGateNotHead, CommitsNow, CommitsSync, CommitsWithCheckOutput, MergeAuto (+13 more)

### Community 49 - "index.ts"
Cohesion: 0.24
Nodes (16): ciBody(), NodeDrawer(), NodeDrawerSession, mergeBody(), prBody(), reviewBody(), reviewRoundLine(), closedBody() (+8 more)

### Community 50 - "Text.tsx"
Cohesion: 0.19
Nodes (16): AgentRowModel, actorKey(), BackgroundTasks(), BackgroundTasksProps, PhaseGroupProps, phaseOpensByDefault(), agentOf(), membersOfPhase() (+8 more)

### Community 51 - "PaneSplitter.stories.tsx"
Cohesion: 0.15
Nodes (16): PhaseGroup(), Collapsed, Controlled, deepReadMembers, Default, EveryState, MEMBERS_BY_STATE, Story (+8 more)

### Community 52 - "icons.stories.tsx"
Cohesion: 0.17
Nodes (14): AgentRow(), AgentRowProps, Default, EveryState, InformativeAgainstRollup, Story, SuppressedByRollup, WithoutDuration (+6 more)

### Community 53 - "badge.stories.tsx"
Cohesion: 0.18
Nodes (14): DeliveryTabs(), isChangesView(), isDeliveryTab(), AllTones, ChangesTone, Default, Story, TONES (+6 more)

### Community 54 - "button.stories.tsx"
Cohesion: 0.12
Nodes (16): RUN_SHAPES, RunMember, batchMembers, CollapsedBatch, CollapsedWorkflow, Controlled, Default, EmptyBatch (+8 more)

### Community 55 - "ContextGauge.tsx"
Cohesion: 0.16
Nodes (12): agentStateWordClass(), RosterRow(), RosterRowProps, ROW_CARETS, RowCaret, Default, EveryCaret, ReservedIsNeverAButton (+4 more)

### Community 56 - "SectionHeader.tsx"
Cohesion: 0.19
Nodes (11): CHECK_LABEL, CheckOutput(), CheckOutputProps, LOCAL_CHECKS, LocalCheck, Default, EveryCheck, MultilineFeed (+3 more)

### Community 58 - "PanelSplitter.stories.tsx"
Cohesion: 0.20
Nodes (11): clampPaneSize(), keyStepDelta(), PANE_ORIENTATIONS, PanelSplitter(), PanelSplitterProps, PaneOrientation, AllOrientations, Default (+3 more)

### Community 59 - "WorkspaceIdentity.tsx"
Cohesion: 0.22
Nodes (11): leaf(), AllVariants, Clean, Default, Story, syncLabel(), tagContent(), tagTitle() (+3 more)

### Community 60 - "Text.tsx"
Cohesion: 0.18
Nodes (11): TypeRole, AllVariants, Coloured, Default, SPECIMEN, Story, VARIANTS, TEXT_ELEMENTS (+3 more)

### Community 61 - "icons.stories.tsx"
Cohesion: 0.17
Nodes (12): AllGlyphs, boxOf(), Decorative, Default, glyph(), GLYPHS, InlineWithText, Labelled (+4 more)

### Community 62 - "drawerControls.tsx"
Cohesion: 0.33
Nodes (5): DelegatedRow(), GateAction(), GrowRow(), DisclosureProps, useDisclosure()

### Community 63 - "button.stories.tsx"
Cohesion: 0.18
Nodes (10): AllVariants, AsChild, Bare, Default, Disabled, Quiet, SIZES, Story (+2 more)

### Community 64 - "DeliveryLifecycle.stories.tsx"
Cohesion: 0.20
Nodes (9): Absent, BeforePr, Closed, Default, DeliveryLifecycleProps, IN_REVIEW, Merged, PR (+1 more)

### Community 65 - "DeliveryTabs.stories.tsx"
Cohesion: 0.20
Nodes (9): ArtifactsSelected, Default, onBack, ReviewOutstanding, Scoped, Story, Stub, unscopedArgs (+1 more)

### Community 66 - "FindingCard.stories.tsx"
Cohesion: 0.22
Nodes (8): FindingCard(), severityAccent(), Addressing, Advisory, Default, Fixed, Story, WalkFocused

### Community 67 - "LifecycleNode.stories.tsx"
Cohesion: 0.22
Nodes (8): Default, EveryNode, EveryState, HeadPulsing, NotClickable, Open, Story, WithSub

### Community 68 - "badge.stories.tsx"
Cohesion: 0.22
Nodes (8): AllVariants, AsChild, Default, SHAPES, Story, VARIANTS, VERDICT_VARIANTS, WithIcon

### Community 69 - "BackgroundTasks.stories.tsx"
Cohesion: 0.25
Nodes (7): RosterActor, Default, Empty, retryAudit, reviewAgent, Story, testSweep

### Community 70 - "ContextGauge.tsx"
Cohesion: 0.43
Nodes (4): clampPercentage(), ContextGauge(), Default, Story

### Community 71 - "SectionHeader.tsx"
Cohesion: 0.40
Nodes (4): SectionHeader(), Default, Story, WithoutCount

### Community 72 - "toggle-group.tsx"
Cohesion: 0.47
Nodes (4): Default, Story, ToggleGroup(), ToggleGroupItem()

### Community 73 - "checkbox.stories.tsx"
Cohesion: 0.40
Nodes (4): Checked, Default, Disabled, Story

## Knowledge Gaps
- **473 isolated node(s):** `*.css`, `projectRoot`, `config`, `project`, `$schema` (+468 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Session Row & Button` to `Runtime Dependencies`, `App Rail Shell`, `Vitest Browser Playwright`, `Storybook Docs Addon`, `Electron Vite`, `Electron`, `index.ts`, `Text.tsx`, `PaneSplitter.stories.tsx`, `icons.stories.tsx`, `badge.stories.tsx`, `ContextGauge.tsx`, `PanelSplitter.stories.tsx`, `WorkspaceIdentity.tsx`, `Text.tsx`, `FindingCard.stories.tsx`, `ContextGauge.tsx`, `SectionHeader.tsx`, `toggle-group.tsx`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `Text()` connect `Session Row & Button` to `App Rail Shell`, `Vitest Browser Playwright`, `Storybook Docs Addon`, `Electron Vite`, `Electron`, `index.ts`, `Text.tsx`, `PaneSplitter.stories.tsx`, `icons.stories.tsx`, `badge.stories.tsx`, `ContextGauge.tsx`, `SectionHeader.tsx`, `PanelSplitter.stories.tsx`, `WorkspaceIdentity.tsx`, `Text.tsx`, `drawerControls.tsx`, `button.stories.tsx`, `badge.stories.tsx`, `ContextGauge.tsx`, `SectionHeader.tsx`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `NodeDrawer()` connect `index.ts` to `Session Row & Button`, `sessionFacts.ts`, `Vitest Browser Playwright`, `SectionHeader.tsx`, `Electron Vite`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `*.css`, `projectRoot`, `config` to the rest of the system?**
  _473 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Biome Config` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `Root Package Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `Turbo Build Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.07389162561576355 - nodes in this community are weakly interconnected._