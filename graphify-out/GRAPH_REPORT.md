# Graph Report - argo  (2026-08-03)

## Corpus Check
- 365 files · ~168,276 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1833 nodes · 4037 edges · 112 communities (78 shown, 34 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `efac6e1c`
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
- Env Type Declarations
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
- @electron-toolkit/tsconfig
- react
- react-dom
- arms.ts
- trial.ts
- mine-transcripts.ts
- Console.stories.tsx
- claudeTranscript.ts
- models.ts
- containment.ts
- discover.ts
- speaker.ts
- CommitGroup.stories.tsx
- IconButton.stories.tsx
- smoke-realtime.ts
- electron
- @electron-toolkit/tsconfig
- @types/react

## God Nodes (most connected - your core abstractions)
1. `cn()` - 92 edges
2. `Text()` - 59 edges
3. `createIcon()` - 49 edges
4. `scripts` - 23 edges
5. `Button()` - 21 edges
6. `buildSessionsRoomModel()` - 17 edges
7. `parseTranscript()` - 16 edges
8. `isRecord()` - 16 edges
9. `asString()` - 15 edges
10. `deliveryState` - 15 edges

## Surprising Connections (you probably didn't know these)
- `collect()` --indirect_call--> `file()`  [INFERRED]
  prototypes/return-path-eval/mine-transcripts.ts → apps/desktop/src/main/observe/observedSession.test.ts
- `main()` --indirect_call--> `model()`  [INFERRED]
  prototypes/marker-drop-rate/sweep.ts → apps/desktop/src/shared/lifecycleModel.test.ts
- `dedupe()` --indirect_call--> `row()`  [INFERRED]
  prototypes/return-path-eval/trial.ts → apps/desktop/src/renderer/src/cockpit/sessionStore.test.ts
- `observe()` --indirect_call--> `project()`  [INFERRED]
  apps/desktop/src/main/observe/observe.seamB.test.ts → apps/desktop/src/shared/projects.test.ts
- `running()` --calls--> `derived()`  [EXTRACTED]
  apps/desktop/src/main/observe/observedSession.test.ts → apps/desktop/src/shared/honesty.ts

## Import Cycles
- None detected.

## Communities (112 total, 34 thin omitted)

### Community 0 - "Biome Config"
Cohesion: 0.13
Nodes (20): ADR-0007, AxisResult, convene(), judgeOnce(), AXES, Axis, AxisId, judgePrompt() (+12 more)

### Community 1 - "Root Package Manifest"
Cohesion: 0.05
Nodes (42): @biomejs/biome, husky, jscpd, lint-staged, bin, argo, devDependencies, @biomejs/biome (+34 more)

### Community 2 - "Turbo Build Pipeline"
Cohesion: 0.07
Nodes (31): ^build, dist/**, OPENAI_API_KEY, out/**, REALTIME_MODEL, storybook-static/**, dependsOn, outputs (+23 more)

### Community 3 - "Desktop App Package"
Cohesion: 0.04
Nodes (45): dependencies, class-variance-authority, clsx, @electron-toolkit/preload, @electron-toolkit/utils, node-pty, @phosphor-icons/react, radix-ui (+37 more)

### Community 4 - "Session Row & Button"
Cohesion: 0.12
Nodes (18): TERMINAL_PRESENTATION, LifecycleNode(), NODE_LABEL, PrAnchor(), Default, Story, cn(), twMerge (+10 more)

### Community 5 - "Runtime Dependencies"
Cohesion: 0.08
Nodes (31): ArrowClockwiseIcon, ArrowCounterClockwiseIcon, ArrowRightIcon, ArrowsLeftRightIcon, ArrowsMergeIcon, ArrowSquareOutIcon, BinocularsIcon, BugIcon (+23 more)

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
Nodes (9): devDependencies, electron-builder, electron-vite, @fontsource-variable/inter, @vitest/browser-playwright, electron-builder, electron-vite, @fontsource-variable/inter (+1 more)

### Community 10 - "Root TSConfig References"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 14 - "App Rail Shell"
Cohesion: 0.23
Nodes (8): AllIcons, Default, Story, HOT_HEAD_STATES, isHotHeadState(), DOT_GLOWS, ROSTER_ICONS, ROSTER_TONES

### Community 19 - "Dependency Cruiser"
Cohesion: 0.05
Nodes (51): DEFAULT_PANEL_UI, SessionPanel, useSessionPanel(), Roster(), ARCHIVED, ArchivedOpen, POPULATED, PR (+43 more)

### Community 20 - "Vitest Browser Playwright"
Cohesion: 0.10
Nodes (28): ciState(), commitsState(), LIFECYCLE_KEYS, lifecycleModel, LifecycleNodeKey, LifecycleNodes, LifecycleNodeState, mergeState() (+20 more)

### Community 23 - "Storybook Docs Addon"
Cohesion: 0.07
Nodes (39): captureLabel(), Console(), ConsoleProps, CAPTURE, CaptureActive, CaptureIdle, Default, Expanded (+31 more)

### Community 25 - "Electron Vite"
Cohesion: 0.08
Nodes (36): AllFilesDiffFile, CONTENT_LABEL, Delivery(), DeliveryCommitGroup, DeliveryProps, ALL_FILES, ArtifactsTab, ByCommit (+28 more)

### Community 31 - "React Types"
Cohesion: 0.05
Nodes (65): Cap, capLabel(), CAPS, systemPrompt(), userPrompt(), Chunk, ChunkType, CORPUS (+57 more)

### Community 39 - "Session State Hub"
Cohesion: 0.10
Nodes (32): BRANCH_REF_ARGS, commitsIn(), mirroredDrift(), parseBranchRefs(), parseTrack(), RawRef, readBranchRefs(), named() (+24 more)

### Community 40 - "Electron"
Cohesion: 0.29
Nodes (8): AccentCard(), AccentCardHeader(), AccentCardTone, accentCardVariants, Blocking, Landed, Story, Tones

### Community 48 - "sessionFacts.ts"
Cohesion: 0.10
Nodes (30): createHub(), transcriptRoot(), gatherClaudeProcesses(), processCwd(), run, observe(), parseFixture(), file() (+22 more)

### Community 49 - "index.ts"
Cohesion: 0.09
Nodes (21): CiFailingHead, CiRunning, CommitsGate, CommitsGateNotHead, CommitsNow, CommitsSync, CommitsWithCheckOutput, MergeAuto (+13 more)

### Community 50 - "Text.tsx"
Cohesion: 0.14
Nodes (16): App(), ADR-0005, ADR-0015, RoomStage(), SessionStore, ADR-0005, useSessionStore, GitGroup (+8 more)

### Community 51 - "PaneSplitter.stories.tsx"
Cohesion: 0.12
Nodes (16): RosterTone, ProjectStrip(), Default, NoProjects, OneProject, Story, TABS, Active (+8 more)

### Community 52 - "icons.stories.tsx"
Cohesion: 0.12
Nodes (17): ConciergeCaption(), Default, Silent, Story, ConciergeStrip(), Default, Story, OrbMini() (+9 more)

### Community 53 - "badge.stories.tsx"
Cohesion: 0.16
Nodes (18): DeliveryTabs(), isChangesView(), isDeliveryTab(), AllTones, ChangesTone, Default, Story, TONES (+10 more)

### Community 54 - "button.stories.tsx"
Cohesion: 0.06
Nodes (48): DropdownMenu(), DropdownMenuContent(), DropdownMenuGroup(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuSeparator(), DropdownMenuTrigger(), Default (+40 more)

### Community 55 - "ContextGauge.tsx"
Cohesion: 0.13
Nodes (19): Claim, ADR-0013, deriveSessionStatus(), HALTING_REASONS, hasPendingAsk(), isRecent(), quietStatus(), statusOf() (+11 more)

### Community 56 - "SectionHeader.tsx"
Cohesion: 0.11
Nodes (20): ASKING, BROKEN, Candidate, DeliveryClaim, DotGlow, LANDED, MOVING, OBSERVED (+12 more)

### Community 58 - "PanelSplitter.stories.tsx"
Cohesion: 0.20
Nodes (11): clampPanelSize(), keyStepDelta(), PANEL_ORIENTATIONS, PanelOrientation, PanelSplitter(), PanelSplitterProps, AllOrientations, Default (+3 more)

### Community 59 - "WorkspaceIdentity.tsx"
Cohesion: 0.20
Nodes (12): SessionHeaderProps, SessionHeaderModel, leaf(), AllVariants, Clean, Default, Story, syncLabel() (+4 more)

### Community 60 - "Text.tsx"
Cohesion: 0.09
Nodes (23): TypeRole, Badge(), BadgeVariant, badgeVariants, AllVariants, AsChild, Default, SHAPES (+15 more)

### Community 61 - "icons.stories.tsx"
Cohesion: 0.17
Nodes (12): AllGlyphs, boxOf(), Decorative, Default, glyph(), GLYPHS, InlineWithText, Labelled (+4 more)

### Community 62 - "drawerControls.tsx"
Cohesion: 0.15
Nodes (13): ArchivedFooter(), Closed, Open, Story, NewSessionRow(), Default, Story, RailActionRow() (+5 more)

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
Cohesion: 0.12
Nodes (18): ARMS, Arm, armB(), EvalChunk, loadCorpus(), argv, byArm, corpus (+10 more)

### Community 67 - "LifecycleNode.stories.tsx"
Cohesion: 0.22
Nodes (8): Default, EveryNode, EveryState, HeadPulsing, NotClickable, Open, Story, WithSub

### Community 68 - "badge.stories.tsx"
Cohesion: 0.22
Nodes (11): deliveryState, RailStatus, claimsOf(), deliveryClaimWord(), milestone(), pick(), railStatus(), sessionStatusWord() (+3 more)

### Community 69 - "BackgroundTasks.stories.tsx"
Cohesion: 0.23
Nodes (10): createManagedSessions(), createObserver(), ObserverOptions, read(), claimedManaged(), CLOSING_RECORD, fixture(), grown() (+2 more)

### Community 70 - "ContextGauge.tsx"
Cohesion: 0.24
Nodes (9): DEFAULT_UI, sessionFrom(), RosterWord, PR, STATE_MATRIX_ROWS, stateMatrixInput(), StateMatrixRow, labelOf() (+1 more)

### Community 71 - "SectionHeader.tsx"
Cohesion: 0.31
Nodes (5): ConsoleChannelTab(), ConsoleChannelTabProps, Button(), ButtonVariant, buttonVariants

### Community 72 - "toggle-group.tsx"
Cohesion: 0.09
Nodes (29): isGitOperation(), isGitRequest(), isProjectId(), refuse(), ADR-0004, wireGit(), Hub, ProjectionListener (+21 more)

### Community 73 - "checkbox.stories.tsx"
Cohesion: 0.40
Nodes (4): Checked, Default, Disabled, Story

### Community 74 - "electron-vite"
Cohesion: 0.14
Nodes (10): ArrowLineUpIcon, CircleIcon, GearIcon, GitCommitIcon, GitMergeIcon, ProhibitIcon, ROSTER_ICON, UserIcon (+2 more)

### Community 76 - "react"
Cohesion: 0.13
Nodes (25): CheckOutputProps, ciBody(), commitsBody(), commitsStageBody(), DelegatedRow(), GateAction(), GrowRow(), NodeDrawer() (+17 more)

### Community 77 - "react-dom"
Cohesion: 0.14
Nodes (16): CockpitHandlers, CockpitScreenProps, CockpitScreenView(), CONNECTED, Default, FACTS, NotAGitRepository, NothingConnected (+8 more)

### Community 78 - "projection.ts"
Cohesion: 0.13
Nodes (31): activateProject(), addProject(), addSession(), attribute(), CockpitState, emptyState(), repointProject(), ADR-0005 (+23 more)

### Community 79 - "sessionStore.ts"
Cohesion: 0.20
Nodes (9): AllTones, Default, EveryState, Hollow, Labelled, Pulsing, Quiet, RAIL_STATES (+1 more)

### Community 80 - "sessionFacts.ts"
Cohesion: 0.13
Nodes (20): created(), intake(), projected(), GradeStatus, resolveTitle(), toAgents(), toIntake(), ObservedSession (+12 more)

### Community 81 - "terminalBridge.ts"
Cohesion: 0.16
Nodes (24): restoreProjects(), registryFile(), twoProjects(), activate(), chooseFolder(), register(), ADR-0017, wireProjects() (+16 more)

### Community 82 - "channels.ts"
Cohesion: 0.09
Nodes (14): cockpit, Window, ADR-0005, CockpitBridge, CommandResult, TerminalSession, ADR-0004, ADR-0005 (+6 more)

### Community 83 - "Roster.stories.tsx"
Cohesion: 0.13
Nodes (20): findingBodyStub(), FindingCard(), severityAccent(), Addressing, Advisory, Default, Fixed, Story (+12 more)

### Community 84 - "SessionRow.tsx"
Cohesion: 0.28
Nodes (5): LIFECYCLE_NODE_STATE, LifecycleNodeStatePresentation, ArrowsClockwiseIcon, CircleNotchIcon, IconAtom

### Community 85 - "deliveryState"
Cohesion: 0.28
Nodes (6): IconButton(), Default, Story, Default, LeftOnly, Story

### Community 86 - "deliveryState"
Cohesion: 0.17
Nodes (11): defaultElement(), Text(), BranchSelectorProps, Default, Story, TRACKING, TrackingStates, Default (+3 more)

### Community 87 - "PrChecksList.tsx"
Cohesion: 0.07
Nodes (34): CHECK_LABEL, CheckOutput(), LOCAL_CHECKS, LocalCheck, Default, EveryCheck, MultilineFeed, Story (+26 more)

### Community 88 - "FileDiff.stories.tsx"
Cohesion: 0.43
Nodes (4): clampPercentage(), ContextGauge(), Default, Story

### Community 89 - "FindingCard.tsx"
Cohesion: 0.12
Nodes (25): CommitGroup(), CommitGroupFile, Default, FILES, Story, Uncommitted, DiffFinding, DiffHunkLine (+17 more)

### Community 90 - "lifecycleNodeState.ts"
Cohesion: 0.29
Nodes (5): Default, NeutralWord, propsOf(), Pulsing, Story

### Community 91 - "PrChecksList.stories.tsx"
Cohesion: 0.29
Nodes (4): PR, rails, REVIEWING, SessionDot

### Community 92 - "NowLine.stories.tsx"
Cohesion: 0.26
Nodes (9): Default, Story, Tooltip(), TooltipContent(), TooltipProvider(), TooltipTrigger(), ProjectStripProps, ProjectTab() (+1 more)

### Community 93 - "SessionRow.stories.tsx"
Cohesion: 0.33
Nodes (5): AllFilesDiff(), Default, Empty, FILES, Story

### Community 96 - "@electron-toolkit/tsconfig"
Cohesion: 0.12
Nodes (14): armKeys, contested, failed, judged, ok, parseProblems, path, pct() (+6 more)

### Community 100 - "arms.ts"
Cohesion: 0.27
Nodes (10): ArmId, ArmSpec, RouterOutput, runRouter(), ChunkType, parseRouterReply(), ReducedPayload, renderForSpeaker() (+2 more)

### Community 102 - "trial.ts"
Cohesion: 0.17
Nodes (13): row(), SpanVerdict, CouncilResult, armB, inPath, leak, outPath, redactRow() (+5 more)

### Community 103 - "mine-transcripts.ts"
Cohesion: 0.16
Nodes (12): all, bands, collect(), Mined, mostlyCode(), outPath, perBand, picked (+4 more)

### Community 104 - "Console.stories.tsx"
Cohesion: 0.18
Nodes (9): Default, EveryRoom, Story, ConnectionStale, Default, LongCaption, NoGitControls, Story (+1 more)

### Community 105 - "claudeTranscript.ts"
Cohesion: 0.08
Nodes (55): absorb(), absorbMessage(), clampPrompt(), coercePromptText(), parseTranscript(), parseFixture(), agentsOf(), DELEGATING_TOOLS (+47 more)

### Community 106 - "models.ts"
Cohesion: 0.27
Nodes (6): ShellCommands, useShellCommands(), useShellKeymap(), ShellState, shellCommand, WITH_META

### Community 107 - "containment.ts"
Cohesion: 0.33
Nodes (8): checkAll(), checkSpan(), matchedPrefixWords(), normalise(), Transform, TRANSFORMS, Case, CASES

### Community 108 - "discover.ts"
Cohesion: 0.33
Nodes (7): discoverWorkingSet(), mtimeOf(), readDirectoryNames(), selectWorkingSet(), NOW, TranscriptFile, ADR-0008

### Community 109 - "speaker.ts"
Cohesion: 0.43
Nodes (6): absentSpeaker(), realtimeSpeaker(), sessionInstructions(), Speaker, speakerFromEnv(), timeoutFor()

### Community 110 - "CommitGroup.stories.tsx"
Cohesion: 0.47
Nodes (7): useShellState(), DEFAULT_PROJECT_UI, nextProjectId(), ProjectUi, ProjectUiMemory, recallProjectUi(), rememberProjectUi()

### Community 113 - "IconButton.stories.tsx"
Cohesion: 0.20
Nodes (5): ArrowLineDownIcon, GitBranchIcon, PencilSimpleIcon, TrashIcon, OPERATIONS

## Knowledge Gaps
- **681 isolated node(s):** `*.css`, `projectRoot`, `config`, `project`, `$schema` (+676 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PanelSplitter()` connect `PanelSplitter.stories.tsx` to `sessionFacts.ts`, `Electron Vite`, `Session Row & Button`, `badge.stories.tsx`?**
  _High betweenness centrality (0.213) - this node is a cross-community bridge._
- **Why does `Observer` connect `sessionFacts.ts` to `toggle-group.tsx`?**
  _High betweenness centrality (0.213) - this node is a cross-community bridge._
- **Why does `cn()` connect `Session Row & Button` to `Runtime Dependencies`, `Storybook Docs Addon`, `Electron Vite`, `Electron`, `Text.tsx`, `icons.stories.tsx`, `badge.stories.tsx`, `button.stories.tsx`, `PanelSplitter.stories.tsx`, `WorkspaceIdentity.tsx`, `Text.tsx`, `drawerControls.tsx`, `SectionHeader.tsx`, `react`, `Roster.stories.tsx`, `deliveryState`, `deliveryState`, `PrChecksList.tsx`, `FileDiff.stories.tsx`, `FindingCard.tsx`, `NowLine.stories.tsx`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **What connects `*.css`, `projectRoot`, `config` to the rest of the system?**
  _681 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Biome Config` be split into smaller, more focused modules?**
  _Cohesion score 0.1339031339031339 - nodes in this community are weakly interconnected._
- **Should `Root Package Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `Turbo Build Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.06653225806451613 - nodes in this community are weakly interconnected._