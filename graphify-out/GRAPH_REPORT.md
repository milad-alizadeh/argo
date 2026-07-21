# Graph Report - argo  (2026-07-21)

## Corpus Check
- 227 files · ~63,671 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1118 nodes · 2275 edges · 86 communities (55 shown, 31 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.62)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3096e726`
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
- projection.ts
- sessionStore.ts
- sessionFacts.ts
- terminalBridge.ts
- channels.ts
- Roster.stories.tsx
- SessionRow.tsx
- deliveryState

## God Nodes (most connected - your core abstractions)
1. `cn()` - 75 edges
2. `Text()` - 47 edges
3. `createIcon()` - 46 edges
4. `Button()` - 18 edges
5. `scripts` - 17 edges
6. `scripts` - 14 edges
7. `NodeDrawerSession` - 13 edges
8. `NodeDrawer()` - 12 edges
9. `CheckIcon` - 12 edges
10. `sessionFacts` - 12 edges

## Surprising Connections (you probably didn't know these)
- `SessionPanel()` --calls--> `cn()`  [EXTRACTED]
  apps/desktop/src/renderer/src/SessionScreen.tsx → apps/desktop/src/renderer/src/lib/utils.ts
- `EmptySessionPanel()` --calls--> `cn()`  [EXTRACTED]
  apps/desktop/src/renderer/src/SessionScreen.tsx → apps/desktop/src/renderer/src/lib/utils.ts
- `ConsoleData` --references--> `ConsoleCapture`  [EXTRACTED]
  apps/desktop/src/renderer/src/sessionScreenModel.ts → apps/desktop/src/renderer/src/domains/console/components/consoleChannels.ts
- `sessionFrom()` --calls--> `stateMatrixInput()`  [EXTRACTED]
  apps/desktop/src/renderer/src/sessionScreenModel.test.ts → apps/desktop/src/renderer/src/shared/delivery/stateMatrix.ts
- `seedDemoSession()` --calls--> `sessionFacts`  [EXTRACTED]
  apps/desktop/src/main/demoSeed.ts → apps/desktop/src/shared/sessionFacts.ts

## Import Cycles
- None detected.

## Communities (86 total, 31 thin omitted)

### Community 0 - "Biome Config"
Cohesion: 0.06
Nodes (33): source, assist, actions, enabled, css, parser, files, ignoreUnknown (+25 more)

### Community 1 - "Root Package Manifest"
Cohesion: 0.05
Nodes (36): @biomejs/biome, husky, lint-staged, bin, argo, devDependencies, @biomejs/biome, husky (+28 more)

### Community 2 - "Turbo Build Pipeline"
Cohesion: 0.07
Nodes (28): ^build, dist/**, out/**, storybook-static/**, dependsOn, outputs, outputs, cache (+20 more)

### Community 3 - "Desktop App Package"
Cohesion: 0.05
Nodes (43): dependencies, class-variance-authority, clsx, @electron-toolkit/preload, @electron-toolkit/utils, node-pty, @phosphor-icons/react, radix-ui (+35 more)

### Community 4 - "Session Row & Button"
Cohesion: 0.12
Nodes (22): NowLine(), Idle, Live, Story, DeliveryLifecycle(), TERMINAL_PRESENTATION, LifecycleNode(), NODE_LABEL (+14 more)

### Community 5 - "Runtime Dependencies"
Cohesion: 0.05
Nodes (49): LIFECYCLE_NODE_STATE, LifecycleNodeStatePresentation, ArrowClockwiseIcon, ArrowCounterClockwiseIcon, ArrowLineUpIcon, ArrowRightIcon, ArrowsClockwiseIcon, ArrowsLeftRightIcon (+41 more)

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
Cohesion: 0.06
Nodes (38): Roster(), deliveryStates, Empty, everyState, oneSession, PR, SingleSession, Story (+30 more)

### Community 15 - "Electron Toolkit TSConfig"
Cohesion: 0.22
Nodes (9): devDependencies, dependency-cruiser, @electron-toolkit/tsconfig, react, react-dom, dependency-cruiser, @electron-toolkit/tsconfig, react (+1 more)

### Community 19 - "Dependency Cruiser"
Cohesion: 0.14
Nodes (13): AUTH, ConsoleExpanded, DEFAULT_LAYOUT, DEFAULT_UI, EmptyRoster, EXPANDED_LAYOUT, NOOP_HANDLERS, NoSelection (+5 more)

### Community 20 - "Vitest Browser Playwright"
Cohesion: 0.07
Nodes (46): AllFilesDiffFile, CommitGroup(), CommitGroupFile, Default, FILES, Story, Uncommitted, DiffFinding (+38 more)

### Community 23 - "Storybook Docs Addon"
Cohesion: 0.07
Nodes (38): captureLabel(), Console(), ConsoleProps, CAPTURE, CaptureActive, CaptureIdle, Default, Expanded (+30 more)

### Community 25 - "Electron Vite"
Cohesion: 0.21
Nodes (11): RosterActor, DeliveryCommitGroup, ActivityModel, ConsoleData, DeliveryData, EMPTY_DRAWER_SESSION, NowLineModel, RichSessionData (+3 more)

### Community 39 - "Session State Hub"
Cohesion: 0.18
Nodes (17): ciState(), commitsState(), LIFECYCLE_KEYS, lifecycleModel, LifecycleNodeKey, LifecycleNodes, LifecycleNodeState, mergeState() (+9 more)

### Community 40 - "Electron"
Cohesion: 0.32
Nodes (8): ConsoleChannelTab(), ConsoleChannelTabProps, Badge(), BadgeVariant, badgeVariants, Button(), ButtonVariant, buttonVariants

### Community 48 - "sessionFacts.ts"
Cohesion: 0.09
Nodes (21): CiFailingHead, CiRunning, CommitsGate, CommitsGateNotHead, CommitsNow, CommitsSync, CommitsWithCheckOutput, MergeAuto (+13 more)

### Community 49 - "index.ts"
Cohesion: 0.06
Nodes (58): CHECK_LABEL, CheckOutput(), CheckOutputProps, LOCAL_CHECKS, LocalCheck, Default, EveryCheck, MultilineFeed (+50 more)

### Community 50 - "Text.tsx"
Cohesion: 0.19
Nodes (17): AgentRowModel, actorKey(), BackgroundTasks(), BackgroundTasksProps, PhaseState, agentOf(), membersOfPhase(), RUN_SHAPES (+9 more)

### Community 51 - "PaneSplitter.stories.tsx"
Cohesion: 0.18
Nodes (10): Collapsed, Controlled, deepReadMembers, Default, EveryState, MEMBERS_BY_STATE, Story, surveyMembers (+2 more)

### Community 52 - "icons.stories.tsx"
Cohesion: 0.19
Nodes (12): AgentRow(), AgentRowProps, Default, EveryState, InformativeAgainstRollup, Story, SuppressedByRollup, WithoutDuration (+4 more)

### Community 53 - "badge.stories.tsx"
Cohesion: 0.18
Nodes (14): DeliveryTabs(), isChangesView(), isDeliveryTab(), AllTones, ChangesTone, Default, Story, TONES (+6 more)

### Community 54 - "button.stories.tsx"
Cohesion: 0.13
Nodes (14): batchMembers, CollapsedBatch, CollapsedWorkflow, Controlled, Default, EmptyBatch, EveryState, Story (+6 more)

### Community 55 - "ContextGauge.tsx"
Cohesion: 0.16
Nodes (12): agentStateWordClass(), RosterRow(), RosterRowProps, ROW_CARETS, RowCaret, Default, EveryCaret, ReservedIsNeverAButton (+4 more)

### Community 56 - "SectionHeader.tsx"
Cohesion: 0.15
Nodes (12): Delivery(), ALL_FILES, ArtifactsTab, ByCommit, COMMIT_GROUPS, IN_REVIEW, InReview, Merged (+4 more)

### Community 58 - "PanelSplitter.stories.tsx"
Cohesion: 0.20
Nodes (11): clampPanelSize(), keyStepDelta(), PANEL_ORIENTATIONS, PanelOrientation, PanelSplitter(), PanelSplitterProps, AllOrientations, Default (+3 more)

### Community 59 - "WorkspaceIdentity.tsx"
Cohesion: 0.24
Nodes (10): leaf(), AllVariants, Clean, Default, Story, syncLabel(), tagContent(), tagTitle() (+2 more)

### Community 60 - "Text.tsx"
Cohesion: 0.14
Nodes (15): AllVariants, Coloured, Default, SPECIMEN, Story, VARIANTS, TEXT_ELEMENTS, TextElement (+7 more)

### Community 61 - "icons.stories.tsx"
Cohesion: 0.17
Nodes (12): AllGlyphs, boxOf(), Decorative, Default, glyph(), GLYPHS, InlineWithText, Labelled (+4 more)

### Community 62 - "drawerControls.tsx"
Cohesion: 0.24
Nodes (8): SessionHeader(), SessionHeaderProps, HonestEmpty, Story, ToggleSolo, WORKSPACE, WorkspacePresent, SessionHeaderModel

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
Cohesion: 0.25
Nodes (6): buildSessionPanel(), DEFAULT_UI, sessionFrom(), SessionStore, ADR-0005, useSessionStore

### Community 67 - "LifecycleNode.stories.tsx"
Cohesion: 0.22
Nodes (8): Default, EveryNode, EveryState, HeadPulsing, NotClickable, Open, Story, WithSub

### Community 68 - "badge.stories.tsx"
Cohesion: 0.22
Nodes (8): AllVariants, AsChild, Default, SHAPES, Story, VARIANTS, VERDICT_VARIANTS, WithIcon

### Community 69 - "BackgroundTasks.stories.tsx"
Cohesion: 0.26
Nodes (11): CONTENT_LABEL, DeliveryProps, ChangesView, DeliveryTab, EmptySessionPanel(), SessionPanel(), SessionScreenHandlers, SessionScreenProps (+3 more)

### Community 70 - "ContextGauge.tsx"
Cohesion: 0.39
Nodes (4): clampPercentage(), ContextGauge(), Default, Story

### Community 71 - "SectionHeader.tsx"
Cohesion: 0.40
Nodes (4): SectionHeader(), Default, Story, WithoutCount

### Community 72 - "toggle-group.tsx"
Cohesion: 0.21
Nodes (8): seedDemoSession(), createHub(), Hub, ProjectionListener, ADR-0005, ADR-0005, ADR-0005, CockpitState

### Community 73 - "checkbox.stories.tsx"
Cohesion: 0.33
Nodes (5): Checkbox(), Checked, Default, Disabled, Story

### Community 74 - "electron-vite"
Cohesion: 0.27
Nodes (9): doneAgentCount(), PhaseGroup(), PhaseGroupProps, PHASE_PRESENTATION, PHASE_ROLLUP_STATE, phaseOpensByDefault(), PhasePresentation, phaseStatusText() (+1 more)

### Community 76 - "react"
Cohesion: 0.29
Nodes (6): Default, Empty, retryAudit, reviewAgent, Story, testSweep

### Community 77 - "react-dom"
Cohesion: 0.33
Nodes (5): AllFilesDiff(), Default, Empty, FILES, Story

### Community 78 - "projection.ts"
Cohesion: 0.26
Nodes (13): created(), addSession(), applyDelta(), applyEvent(), assertNever(), Cli, emptyState(), HubEvent (+5 more)

### Community 79 - "sessionStore.ts"
Cohesion: 0.23
Nodes (12): App(), DEFAULT_PANEL_UI, ADR-0005, root, SessionScreen(), applyResize(), applySnap(), isConsoleExpanded() (+4 more)

### Community 80 - "sessionFacts.ts"
Cohesion: 0.15
Nodes (12): CiFacts, CiStatus, GatePolicy, PrFacts, PrLifecycle, ReviewRound, ReviewVerdict, SESSION_STATES (+4 more)

### Community 81 - "terminalBridge.ts"
Cohesion: 0.22
Nodes (5): wireProjection(), shellCommand(), ADR-0005, wireTerminal(), TerminalSession

### Community 82 - "channels.ts"
Cohesion: 0.21
Nodes (7): cockpit, Window, ADR-0005, CockpitBridge, TerminalSize, ADR-0005, ProjectionDelta

## Knowledge Gaps
- **493 isolated node(s):** `*.css`, `projectRoot`, `config`, `project`, `$schema` (+488 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Session Row & Button` to `BackgroundTasks.stories.tsx`, `ContextGauge.tsx`, `Runtime Dependencies`, `Electron`, `checkbox.stories.tsx`, `electron-vite`, `SectionHeader.tsx`, `index.ts`, `Text.tsx`, `Vitest Browser Playwright`, `ContextGauge.tsx`, `badge.stories.tsx`, `Storybook Docs Addon`, `SectionHeader.tsx`, `PanelSplitter.stories.tsx`, `WorkspaceIdentity.tsx`, `Text.tsx`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `Text()` connect `Session Row & Button` to `App Rail Shell`, `Vitest Browser Playwright`, `Storybook Docs Addon`, `Electron`, `index.ts`, `Text.tsx`, `icons.stories.tsx`, `badge.stories.tsx`, `ContextGauge.tsx`, `PanelSplitter.stories.tsx`, `WorkspaceIdentity.tsx`, `Text.tsx`, `drawerControls.tsx`, `button.stories.tsx`, `badge.stories.tsx`, `BackgroundTasks.stories.tsx`, `ContextGauge.tsx`, `SectionHeader.tsx`, `electron-vite`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `NodeDrawer()` connect `index.ts` to `sessionFacts.ts`, `Session Row & Button`, `BackgroundTasks.stories.tsx`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `*.css`, `projectRoot`, `config` to the rest of the system?**
  _493 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Biome Config` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `Root Package Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._
- **Should `Turbo Build Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.07389162561576355 - nodes in this community are weakly interconnected._