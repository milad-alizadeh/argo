# Graph Report - argo  (2026-07-22)

## Corpus Check
- 247 files · ~132,943 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1219 nodes · 2502 edges · 100 communities (68 shown, 32 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `eb4ff551`
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
- deliveryState
- PrChecksList.tsx
- FileDiff.stories.tsx
- FindingCard.tsx
- lifecycleNodeState.ts
- PrChecksList.stories.tsx
- NowLine.stories.tsx
- SessionRow.stories.tsx
- SessionScreen.tsx
- useDisclosure
- @electron-toolkit/tsconfig
- react
- react-dom
- @types/three

## God Nodes (most connected - your core abstractions)
1. `cn()` - 83 edges
2. `Text()` - 50 edges
3. `createIcon()` - 46 edges
4. `Button()` - 18 edges
5. `scripts` - 17 edges
6. `OrbState` - 15 edges
7. `scripts` - 14 edges
8. `NodeDrawerSession` - 13 edges
9. `CheckIcon` - 13 edges
10. `deliveryState` - 13 edges

## Surprising Connections (you probably didn't know these)
- `SessionPanel()` --calls--> `cn()`  [EXTRACTED]
  apps/desktop/src/renderer/src/SessionScreen.tsx → apps/desktop/src/renderer/src/lib/utils.ts
- `ConsoleData` --references--> `ConsoleCapture`  [EXTRACTED]
  apps/desktop/src/renderer/src/sessionScreenModel.ts → apps/desktop/src/renderer/src/domains/console/components/consoleChannels.ts
- `seedDemoSession()` --calls--> `sessionFacts`  [EXTRACTED]
  apps/desktop/src/main/demoSeed.ts → apps/desktop/src/shared/sessionFacts.ts
- `created()` --calls--> `sessionFacts`  [EXTRACTED]
  apps/desktop/src/main/hub.test.ts → apps/desktop/src/shared/sessionFacts.ts
- `createHub()` --calls--> `emptyState()`  [EXTRACTED]
  apps/desktop/src/main/hub.ts → apps/desktop/src/shared/projection.ts

## Import Cycles
- None detected.

## Communities (100 total, 32 thin omitted)

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
Cohesion: 0.04
Nodes (45): dependencies, class-variance-authority, clsx, @electron-toolkit/preload, @electron-toolkit/utils, node-pty, @phosphor-icons/react, radix-ui (+37 more)

### Community 4 - "Session Row & Button"
Cohesion: 0.18
Nodes (13): NowLine(), TERMINAL_PRESENTATION, LifecycleNode(), NODE_LABEL, PrAnchor(), Default, Story, SessionRow() (+5 more)

### Community 5 - "Runtime Dependencies"
Cohesion: 0.08
Nodes (30): ArrowClockwiseIcon, ArrowCounterClockwiseIcon, ArrowRightIcon, ArrowsLeftRightIcon, ArrowsMergeIcon, ArrowSquareOutIcon, BinocularsIcon, BugIcon (+22 more)

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
Nodes (9): devDependencies, electron, electron-builder, electron-vite, @vitest/browser-playwright, electron, electron-builder, electron-vite (+1 more)

### Community 10 - "Root TSConfig References"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 14 - "App Rail Shell"
Cohesion: 0.11
Nodes (21): StatusIcon(), AllIcons, Default, Story, Default, EveryState, Pulsing, Story (+13 more)

### Community 19 - "Dependency Cruiser"
Cohesion: 0.14
Nodes (13): AUTH, ConsoleExpanded, DEFAULT_LAYOUT, DEFAULT_UI, EmptyRoster, EXPANDED_LAYOUT, NOOP_HANDLERS, NoSelection (+5 more)

### Community 20 - "Vitest Browser Playwright"
Cohesion: 0.20
Nodes (12): CommitGroup(), Default, FILES, Story, Uncommitted, FileDiff(), hunkLineTone(), kindGlyph() (+4 more)

### Community 23 - "Storybook Docs Addon"
Cohesion: 0.07
Nodes (38): captureLabel(), Console(), ConsoleProps, CAPTURE, CaptureActive, CaptureIdle, Default, Expanded (+30 more)

### Community 25 - "Electron Vite"
Cohesion: 0.21
Nodes (10): RosterActor, ActivityModel, ConsoleData, DeliveryData, EMPTY_DRAWER_SESSION, NowLineModel, RichSessionData, SpineVariant (+2 more)

### Community 39 - "Session State Hub"
Cohesion: 0.18
Nodes (17): ciState(), commitsState(), LIFECYCLE_KEYS, lifecycleModel, LifecycleNodeKey, LifecycleNodes, LifecycleNodeState, mergeState() (+9 more)

### Community 40 - "Electron"
Cohesion: 0.18
Nodes (13): ConsoleChannelTab(), ConsoleChannelTabProps, AccentCard(), AccentCardHeader(), AccentCardTone, accentCardVariants, Blocking, Landed (+5 more)

### Community 48 - "sessionFacts.ts"
Cohesion: 0.06
Nodes (36): ConciergeDock(), ConciergeDockProps, ErrorState, Idle, Inactive, Listening, ORB_STATES, Playground (+28 more)

### Community 49 - "index.ts"
Cohesion: 0.06
Nodes (53): CHECK_LABEL, CheckOutput(), CheckOutputProps, LOCAL_CHECKS, LocalCheck, Default, EveryCheck, MultilineFeed (+45 more)

### Community 50 - "Text.tsx"
Cohesion: 0.20
Nodes (15): AgentRowModel, actorKey(), BackgroundTasks(), BackgroundTasksProps, PhaseGroupProps, phaseOpensByDefault(), agentOf(), membersOfPhase() (+7 more)

### Community 51 - "PaneSplitter.stories.tsx"
Cohesion: 0.15
Nodes (16): PhaseGroup(), Collapsed, Controlled, deepReadMembers, Default, EveryState, MEMBERS_BY_STATE, Story (+8 more)

### Community 52 - "icons.stories.tsx"
Cohesion: 0.17
Nodes (14): AgentRow(), AgentRowProps, Default, EveryState, InformativeAgainstRollup, Story, SuppressedByRollup, WithoutDuration (+6 more)

### Community 53 - "badge.stories.tsx"
Cohesion: 0.12
Nodes (24): CHANGES_VIEWS, DELIVERY_TABS, DeliveryTabs(), isChangesView(), isDeliveryTab(), Badge(), BadgeVariant, badgeVariants (+16 more)

### Community 54 - "button.stories.tsx"
Cohesion: 0.12
Nodes (16): RUN_STATES, RunMember, batchMembers, CollapsedBatch, CollapsedWorkflow, Controlled, Default, EmptyBatch (+8 more)

### Community 55 - "ContextGauge.tsx"
Cohesion: 0.16
Nodes (12): agentStateWordClass(), RosterRow(), RosterRowProps, ROW_CARETS, RowCaret, Default, EveryCaret, ReservedIsNeverAButton (+4 more)

### Community 56 - "SectionHeader.tsx"
Cohesion: 0.17
Nodes (11): ALL_FILES, ArtifactsTab, ByCommit, COMMIT_GROUPS, IN_REVIEW, InReview, Merged, PR (+3 more)

### Community 58 - "PanelSplitter.stories.tsx"
Cohesion: 0.20
Nodes (11): clampPanelSize(), keyStepDelta(), PANEL_ORIENTATIONS, PanelOrientation, PanelSplitter(), PanelSplitterProps, AllOrientations, Default (+3 more)

### Community 59 - "WorkspaceIdentity.tsx"
Cohesion: 0.24
Nodes (10): leaf(), AllVariants, Clean, Default, Story, syncLabel(), tagContent(), tagTitle() (+2 more)

### Community 60 - "Text.tsx"
Cohesion: 0.16
Nodes (12): TypeRole, defaultElement(), AllVariants, Coloured, Default, SPECIMEN, Story, VARIANTS (+4 more)

### Community 61 - "icons.stories.tsx"
Cohesion: 0.17
Nodes (12): AllGlyphs, boxOf(), Decorative, Default, glyph(), GLYPHS, InlineWithText, Labelled (+4 more)

### Community 62 - "drawerControls.tsx"
Cohesion: 0.29
Nodes (6): SessionHeader(), HonestEmpty, Story, ToggleSolo, WORKSPACE, WorkspacePresent

### Community 63 - "button.stories.tsx"
Cohesion: 0.13
Nodes (12): AllVariants, AsChild, Bare, Default, Disabled, Quiet, SIZES, Story (+4 more)

### Community 64 - "DeliveryLifecycle.stories.tsx"
Cohesion: 0.20
Nodes (9): Absent, BeforePr, Closed, Default, DeliveryLifecycleProps, IN_REVIEW, Merged, PR (+1 more)

### Community 65 - "DeliveryTabs.stories.tsx"
Cohesion: 0.20
Nodes (9): ArtifactsSelected, Default, onBack, ReviewOutstanding, Scoped, Story, Stub, unscopedArgs (+1 more)

### Community 66 - "FindingCard.stories.tsx"
Cohesion: 0.50
Nodes (3): SessionStore, ADR-0005, useSessionStore

### Community 67 - "LifecycleNode.stories.tsx"
Cohesion: 0.22
Nodes (8): Default, EveryNode, EveryState, HeadPulsing, NotClickable, Open, Story, WithSub

### Community 68 - "badge.stories.tsx"
Cohesion: 0.22
Nodes (8): AllVariants, AsChild, Default, SHAPES, Story, VARIANTS, VERDICT_VARIANTS, WithIcon

### Community 69 - "BackgroundTasks.stories.tsx"
Cohesion: 0.20
Nodes (18): AllFilesDiff(), AllFilesDiffFile, CommitGroupFile, CONTENT_LABEL, Delivery(), DeliveryCommitGroup, DeliveryProps, DeliveryLifecycle() (+10 more)

### Community 70 - "ContextGauge.tsx"
Cohesion: 0.16
Nodes (12): clampPercentage(), ContextGauge(), Default, Story, EmptyRoster(), Default, Story, Roster() (+4 more)

### Community 71 - "SectionHeader.tsx"
Cohesion: 0.40
Nodes (4): SectionHeader(), Default, Story, WithoutCount

### Community 72 - "toggle-group.tsx"
Cohesion: 0.21
Nodes (8): seedDemoSession(), createHub(), Hub, ProjectionListener, ADR-0005, ADR-0005, ADR-0005, CockpitState

### Community 73 - "checkbox.stories.tsx"
Cohesion: 0.40
Nodes (4): Checked, Default, Disabled, Story

### Community 74 - "electron-vite"
Cohesion: 0.14
Nodes (10): ArrowLineUpIcon, CircleIcon, CircleNotchIcon, GearIcon, GitCommitIcon, GitMergeIcon, GitPullRequestIcon, ProhibitIcon (+2 more)

### Community 76 - "react"
Cohesion: 0.29
Nodes (6): Default, Empty, retryAudit, reviewAgent, Story, testSweep

### Community 77 - "react-dom"
Cohesion: 0.40
Nodes (4): Default, Empty, FILES, Story

### Community 78 - "projection.ts"
Cohesion: 0.26
Nodes (13): created(), addSession(), applyDelta(), applyEvent(), assertNever(), Cli, emptyState(), HubEvent (+5 more)

### Community 79 - "sessionStore.ts"
Cohesion: 0.23
Nodes (11): App(), DEFAULT_PANEL_UI, ADR-0005, root, SessionScreen(), applyResize(), applySnap(), isConsoleExpanded() (+3 more)

### Community 80 - "sessionFacts.ts"
Cohesion: 0.15
Nodes (12): CiFacts, CiStatus, GatePolicy, PrFacts, PrLifecycle, ReviewRound, ReviewVerdict, SESSION_STATES (+4 more)

### Community 81 - "terminalBridge.ts"
Cohesion: 0.22
Nodes (5): wireProjection(), shellCommand(), ADR-0005, wireTerminal(), TerminalSession

### Community 82 - "channels.ts"
Cohesion: 0.21
Nodes (7): cockpit, Window, ADR-0005, CockpitBridge, TerminalSize, ADR-0005, ProjectionDelta

### Community 83 - "Roster.stories.tsx"
Cohesion: 0.16
Nodes (15): Addressing, Advisory, Default, Fixed, Story, WalkFocused, FINDING_SEVERITIES, FINDING_SEVERITY (+7 more)

### Community 84 - "SessionRow.tsx"
Cohesion: 0.13
Nodes (13): CollapsedGroup, commitReady, deliveryStates, Empty, everyState, needsYou, NeedsYouPulse, oneSession (+5 more)

### Community 85 - "deliveryState"
Cohesion: 0.19
Nodes (10): SessionHeaderProps, SessionHeaderModel, IconButton(), Default, Story, PlusIcon, PanelHeader(), Default (+2 more)

### Community 86 - "deliveryState"
Cohesion: 0.21
Nodes (10): buildSessionPanel(), DEFAULT_UI, sessionFrom(), deliveryState, rosterStatus, PR, STATE_MATRIX_ROWS, stateMatrixInput() (+2 more)

### Community 87 - "PrChecksList.tsx"
Cohesion: 0.22
Nodes (8): CiCard(), CiCardProps, Default, Story, WithoutTrailing, AGGREGATE_TONE, CI_RUN_PRESENTATION, PrChecksList()

### Community 88 - "FileDiff.stories.tsx"
Cohesion: 0.20
Nodes (9): AllKinds, Default, DefaultViewed, FINDINGS, HUNK, KINDS, MarkedUncommitted, Story (+1 more)

### Community 89 - "FindingCard.tsx"
Cohesion: 0.44
Nodes (6): DiffFinding, findingBodyStub(), FindingCard(), severityAccent(), FindingSeverity, FindingState

### Community 90 - "lifecycleNodeState.ts"
Cohesion: 0.28
Nodes (5): LIFECYCLE_NODE_STATE, LifecycleNodeStatePresentation, ArrowsClockwiseIcon, IconAtom, WarningIcon

### Community 91 - "PrChecksList.stories.tsx"
Cohesion: 0.22
Nodes (8): CI_RUN_STATUSES, Default, EveryRunStatus, EveryStatus, Failed, NoRunsYet, RUNS, Story

### Community 92 - "NowLine.stories.tsx"
Cohesion: 0.25
Nodes (5): Idle, Live, Story, MagnifyingGlassIcon, PencilSimpleIcon

### Community 93 - "SessionRow.stories.tsx"
Cohesion: 0.29
Nodes (5): Default, EveryState, Pulsing, Selected, Story

### Community 94 - "SessionScreen.tsx"
Cohesion: 0.43
Nodes (6): SessionPanel(), SessionScreenHandlers, SessionScreenProps, SessionPanelModel, SpineEdge, SpineLayout

### Community 95 - "useDisclosure"
Cohesion: 0.40
Nodes (3): RunRow(), DisclosureProps, useDisclosure()

## Knowledge Gaps
- **532 isolated node(s):** `*.css`, `projectRoot`, `config`, `project`, `$schema` (+527 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createEclipseOrb()` connect `sessionFacts.ts` to `terminalBridge.ts`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Why does `TerminalSession` connect `terminalBridge.ts` to `channels.ts`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **Why does `cn()` connect `Session Row & Button` to `Runtime Dependencies`, `App Rail Shell`, `Vitest Browser Playwright`, `Storybook Docs Addon`, `Electron`, `sessionFacts.ts`, `index.ts`, `Text.tsx`, `PaneSplitter.stories.tsx`, `icons.stories.tsx`, `badge.stories.tsx`, `ContextGauge.tsx`, `PanelSplitter.stories.tsx`, `WorkspaceIdentity.tsx`, `Text.tsx`, `BackgroundTasks.stories.tsx`, `ContextGauge.tsx`, `SectionHeader.tsx`, `sessionStore.ts`, `deliveryState`, `PrChecksList.tsx`, `FindingCard.tsx`, `SessionScreen.tsx`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **What connects `*.css`, `projectRoot`, `config` to the rest of the system?**
  _532 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Biome Config` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Should `Root Package Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._
- **Should `Turbo Build Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.07389162561576355 - nodes in this community are weakly interconnected._