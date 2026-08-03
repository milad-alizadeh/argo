# Graph Report - argo  (2026-08-03)

## Corpus Check
- 294 files · ~216,732 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1514 nodes · 3168 edges · 118 communities (83 shown, 35 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8fa829f4`
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
- arms.ts
- rescore.ts
- trial.ts
- mine-transcripts.ts
- Console.stories.tsx
- claudeTranscript.ts
- models.ts
- containment.ts
- discover.ts
- speaker.ts
- CommitGroup.stories.tsx
- StatusDot.stories.tsx
- deliveryState
- IconButton.stories.tsx
- smoke-realtime.ts
- electron-builder
- electron-vite
- @fontsource-variable/inter

## God Nodes (most connected - your core abstractions)
1. `cn()` - 83 edges
2. `Text()` - 50 edges
3. `createIcon()` - 46 edges
4. `scripts` - 20 edges
5. `Button()` - 18 edges
6. `OrbState` - 16 edges
7. `scripts` - 14 edges
8. `sessionFacts` - 14 edges
9. `NodeDrawerSession` - 13 edges
10. `CheckIcon` - 13 edges

## Surprising Connections (you probably didn't know these)
- `collect()` --indirect_call--> `file()`  [INFERRED]
  prototypes/return-path-eval/mine-transcripts.ts → apps/desktop/src/main/observe/observedSession.test.ts
- `main()` --indirect_call--> `model()`  [INFERRED]
  prototypes/marker-drop-rate/sweep.ts → apps/desktop/src/shared/lifecycleModel.test.ts
- `main()` --indirect_call--> `flag()`  [INFERRED]
  prototypes/marker-drop-rate/sweep.ts → prototypes/return-path-eval/sweep.ts
- `observe()` --indirect_call--> `session()`  [INFERRED]
  apps/desktop/src/main/observe/observe.seamB.test.ts → apps/desktop/src/shared/projection.test.ts
- `observe()` --indirect_call--> `project()`  [INFERRED]
  apps/desktop/src/main/observe/observe.seamB.test.ts → apps/desktop/src/shared/projects.test.ts

## Import Cycles
- None detected.

## Communities (118 total, 35 thin omitted)

### Community 0 - "Biome Config"
Cohesion: 0.13
Nodes (20): ADR-0007, AxisResult, convene(), judgeOnce(), AXES, Axis, AxisId, judgePrompt() (+12 more)

### Community 1 - "Root Package Manifest"
Cohesion: 0.05
Nodes (41): @biomejs/biome, husky, jscpd, lint-staged, bin, argo, devDependencies, @biomejs/biome (+33 more)

### Community 2 - "Turbo Build Pipeline"
Cohesion: 0.07
Nodes (31): ^build, dist/**, OPENAI_API_KEY, out/**, REALTIME_MODEL, storybook-static/**, dependsOn, outputs (+23 more)

### Community 3 - "Desktop App Package"
Cohesion: 0.04
Nodes (47): dependencies, class-variance-authority, clsx, @electron-toolkit/preload, @electron-toolkit/utils, node-pty, @phosphor-icons/react, radix-ui (+39 more)

### Community 4 - "Session Row & Button"
Cohesion: 0.15
Nodes (18): NowLine(), Delivery(), DeliveryLifecycle(), TERMINAL_PRESENTATION, LifecycleNode(), NODE_LABEL, PrAnchor(), Default (+10 more)

### Community 5 - "Runtime Dependencies"
Cohesion: 0.09
Nodes (28): ArrowClockwiseIcon, ArrowRightIcon, ArrowsLeftRightIcon, ArrowsMergeIcon, ArrowSquareOutIcon, BinocularsIcon, BugIcon, CaretDownIcon (+20 more)

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
Nodes (9): devDependencies, electron, @electron-toolkit/tsconfig, @types/react, @vitest/browser-playwright, electron, @electron-toolkit/tsconfig, @types/react (+1 more)

### Community 10 - "Root TSConfig References"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 14 - "App Rail Shell"
Cohesion: 0.12
Nodes (13): AllIcons, Default, Story, Default, EveryState, Pulsing, Story, HEAD_STATUS (+5 more)

### Community 19 - "Dependency Cruiser"
Cohesion: 0.14
Nodes (13): AUTH, ConsoleExpanded, DEFAULT_LAYOUT, DEFAULT_UI, EmptyRoster, EXPANDED_LAYOUT, NOOP_HANDLERS, NoSelection (+5 more)

### Community 20 - "Vitest Browser Playwright"
Cohesion: 0.52
Nodes (4): Disclosure, DisclosureAction, disclosureReducer(), useDisclosure()

### Community 23 - "Storybook Docs Addon"
Cohesion: 0.13
Nodes (22): Console(), ConsoleProps, ConsoleChannel(), ConsoleChannelProps, feedNodes(), Capture, CaptureOfEmptyFeed, CaptureOfMarkup (+14 more)

### Community 25 - "Electron Vite"
Cohesion: 0.19
Nodes (16): RosterActor, AllFilesDiffFile, CONTENT_LABEL, DeliveryCommitGroup, DeliveryProps, ChangesView, DeliveryTab, SessionScreenHandlers (+8 more)

### Community 31 - "React Types"
Cohesion: 0.16
Nodes (22): checkLine(), CLASS_OF, ExpectedMarker, extractExpected(), extractiveFallback(), HOMOGRAPH_STOPLIST, isViolation(), LEXICON (+14 more)

### Community 39 - "Session State Hub"
Cohesion: 0.10
Nodes (28): ciState(), commitsState(), LIFECYCLE_KEYS, lifecycleModel, LifecycleNodeKey, LifecycleNodes, LifecycleNodeState, mergeState() (+20 more)

### Community 40 - "Electron"
Cohesion: 0.19
Nodes (11): ConsoleChannelTab(), ConsoleChannelTabProps, AgentChannel, Capture, Default, EveryChannel, LinkedToItsPanel, LongCaptureLabel (+3 more)

### Community 48 - "sessionFacts.ts"
Cohesion: 0.06
Nodes (37): ConciergeDock(), ConciergeDockProps, ErrorState, Idle, Inactive, Listening, ORB_STATES, Playground (+29 more)

### Community 49 - "index.ts"
Cohesion: 0.09
Nodes (21): CiFailingHead, CiRunning, CommitsGate, CommitsGateNotHead, CommitsNow, CommitsSync, CommitsWithCheckOutput, MergeAuto (+13 more)

### Community 50 - "Text.tsx"
Cohesion: 0.13
Nodes (16): AgentRowModel, actorKey(), BackgroundTasks(), BackgroundTasksProps, Default, Empty, retryAudit, reviewAgent (+8 more)

### Community 51 - "PaneSplitter.stories.tsx"
Cohesion: 0.18
Nodes (10): Collapsed, Controlled, deepReadMembers, Default, EveryState, MEMBERS_BY_STATE, Story, surveyMembers (+2 more)

### Community 52 - "icons.stories.tsx"
Cohesion: 0.17
Nodes (14): AgentRow(), AgentRowProps, Default, EveryState, InformativeAgainstRollup, Story, SuppressedByRollup, WithoutDuration (+6 more)

### Community 53 - "badge.stories.tsx"
Cohesion: 0.16
Nodes (16): CHANGES_VIEWS, DELIVERY_TABS, DeliveryTabs(), isChangesView(), isDeliveryTab(), AllTones, ChangesTone, Default (+8 more)

### Community 54 - "button.stories.tsx"
Cohesion: 0.12
Nodes (16): RUN_SHAPES, RunMember, batchMembers, CollapsedBatch, CollapsedWorkflow, Controlled, Default, EmptyBatch (+8 more)

### Community 55 - "ContextGauge.tsx"
Cohesion: 0.17
Nodes (11): agentStateWordClass(), RosterRow(), RosterRowProps, Default, EveryCaret, ReservedIsNeverAButton, Story, Toggleable (+3 more)

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
Cohesion: 0.10
Nodes (29): TypeRole, AccentCard(), AccentCardHeader(), AccentCardTone, accentCardVariants, Blocking, Landed, Story (+21 more)

### Community 61 - "icons.stories.tsx"
Cohesion: 0.17
Nodes (12): AllGlyphs, boxOf(), Decorative, Default, glyph(), GLYPHS, InlineWithText, Labelled (+4 more)

### Community 62 - "drawerControls.tsx"
Cohesion: 0.25
Nodes (7): HonestEmpty, Story, ToggleSolo, WORKSPACE, WorkspacePresent, WorkspaceModel, WorkspaceTree

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
Nodes (19): ARMS, Arm, armB(), EvalChunk, loadCorpus(), argv, byArm, corpus (+11 more)

### Community 67 - "LifecycleNode.stories.tsx"
Cohesion: 0.22
Nodes (8): Default, EveryNode, EveryState, HeadPulsing, NotClickable, Open, Story, WithSub

### Community 68 - "badge.stories.tsx"
Cohesion: 0.22
Nodes (8): AllVariants, AsChild, Default, SHAPES, Story, VARIANTS, VERDICT_VARIANTS, WithIcon

### Community 69 - "BackgroundTasks.stories.tsx"
Cohesion: 0.27
Nodes (12): CheckOutputProps, DeliveryLifecycleProps, LifecycleNodeProps, NodeDrawerSession, CiDrawerData, ClosedSummary, CommitsDrawerData, MergedSummary (+4 more)

### Community 70 - "ContextGauge.tsx"
Cohesion: 0.18
Nodes (10): clampPercentage(), ContextGauge(), Default, Story, EmptyRoster(), Default, Story, Roster() (+2 more)

### Community 71 - "SectionHeader.tsx"
Cohesion: 0.40
Nodes (4): SectionHeader(), Default, Story, WithoutCount

### Community 72 - "toggle-group.tsx"
Cohesion: 0.12
Nodes (19): seedDemoSession(), createHub(), Hub, ProjectionListener, created(), intake(), projected(), ADR-0005 (+11 more)

### Community 73 - "checkbox.stories.tsx"
Cohesion: 0.33
Nodes (5): Checkbox(), Checked, Default, Disabled, Story

### Community 74 - "electron-vite"
Cohesion: 0.11
Nodes (15): LIFECYCLE_NODE_STATE, LifecycleNodeStatePresentation, ArrowLineUpIcon, ArrowsClockwiseIcon, CircleIcon, CircleNotchIcon, IconAtom, GearIcon (+7 more)

### Community 76 - "react"
Cohesion: 0.22
Nodes (15): ciBody(), commitsBody(), commitsStageBody(), DelegatedRow(), GateAction(), GrowRow(), NodeDrawer(), NodeDrawerProps (+7 more)

### Community 77 - "react-dom"
Cohesion: 0.33
Nodes (5): AllFilesDiff(), Default, Empty, FILES, Story

### Community 78 - "projection.ts"
Cohesion: 0.12
Nodes (32): activateProject(), addProject(), addSession(), attribute(), Cli, CockpitState, repointProject(), SessionIntake (+24 more)

### Community 79 - "sessionStore.ts"
Cohesion: 0.17
Nodes (16): App(), DEFAULT_PANEL_UI, ADR-0005, root, SessionScreenProps, buildSessionPanel(), SessionPanelModel, SpineEdge (+8 more)

### Community 80 - "sessionFacts.ts"
Cohesion: 0.11
Nodes (34): parseTranscript(), matchesLiveProcess(), ObservationOptions, startObservation(), deriveLiveness(), gatherClaudeProcesses(), isRecent(), LivenessSignals (+26 more)

### Community 81 - "terminalBridge.ts"
Cohesion: 0.23
Nodes (15): restoreProjects(), emptyRegistry(), isProjectRecord(), isRecord(), knownProjectId(), parseRegistry(), persist(), ProjectRecord (+7 more)

### Community 82 - "channels.ts"
Cohesion: 0.16
Nodes (8): cockpit, Window, ADR-0005, CockpitBridge, TerminalSession, TerminalSize, ADR-0005, ProjectionDelta

### Community 83 - "Roster.stories.tsx"
Cohesion: 0.12
Nodes (17): Addressing, Advisory, Default, Fixed, Story, WalkFocused, FINDING_SEVERITIES, FINDING_SEVERITY (+9 more)

### Community 84 - "SessionRow.tsx"
Cohesion: 0.13
Nodes (13): CollapsedGroup, commitReady, deliveryStates, Empty, everyState, needsYou, NeedsYouPulse, oneSession (+5 more)

### Community 85 - "deliveryState"
Cohesion: 0.23
Nodes (8): SessionHeader(), SessionHeaderProps, SessionHeaderModel, IconButton(), PanelHeader(), Default, LeftOnly, Story

### Community 86 - "deliveryState"
Cohesion: 0.28
Nodes (9): DEFAULT_UI, sessionFrom(), HOT_HEAD_STATES, isHotHeadState(), lifecycleIsHot(), PR, STATE_MATRIX_ROWS, stateMatrixInput() (+1 more)

### Community 87 - "PrChecksList.tsx"
Cohesion: 0.15
Nodes (13): CHECK_LABEL, CheckOutput(), LOCAL_CHECKS, LocalCheck, Default, EveryCheck, MultilineFeed, Story (+5 more)

### Community 88 - "FileDiff.stories.tsx"
Cohesion: 0.20
Nodes (9): AllKinds, Default, DefaultViewed, FINDINGS, HUNK, KINDS, MarkedUncommitted, Story (+1 more)

### Community 89 - "FindingCard.tsx"
Cohesion: 0.28
Nodes (12): CommitGroupFile, DiffFinding, DiffHunkLine, FileChangeKind, findingBodyStub(), FileDiff(), hunkLineTone(), kindGlyph() (+4 more)

### Community 90 - "lifecycleNodeState.ts"
Cohesion: 0.25
Nodes (14): PhaseGroup(), PHASE_PRESENTATION, PHASE_ROLLUP_STATE, phaseOpensByDefault(), PhasePresentation, PhaseState, phaseStatusText(), rowCaret (+6 more)

### Community 91 - "PrChecksList.stories.tsx"
Cohesion: 0.15
Nodes (13): AGGREGATE_TONE, CI_RUN_PRESENTATION, CI_RUN_STATUSES, CiRunStatus, PrChecksList(), PrChecksListProps, Default, EveryRunStatus (+5 more)

### Community 92 - "NowLine.stories.tsx"
Cohesion: 0.25
Nodes (5): Idle, Live, Story, MagnifyingGlassIcon, PencilSimpleIcon

### Community 93 - "SessionRow.stories.tsx"
Cohesion: 0.17
Nodes (7): Default, EveryState, Pulsing, Selected, Story, SessionStore, ADR-0005

### Community 94 - "SessionScreen.tsx"
Cohesion: 0.16
Nodes (15): capLabel(), byClass(), byToken(), capKey(), corpus, errs, lengthTable(), ok (+7 more)

### Community 96 - "@electron-toolkit/tsconfig"
Cohesion: 0.12
Nodes (14): armKeys, contested, failed, judged, ok, parseProblems, path, pct() (+6 more)

### Community 100 - "arms.ts"
Cohesion: 0.23
Nodes (13): CAPS, systemPrompt(), userPrompt(), viaClaudeCli(), ArmSpec, RouterOutput, runRouter(), ChunkType (+5 more)

### Community 101 - "rescore.ts"
Cohesion: 0.14
Nodes (13): Chunk, ChunkType, CORPUS, SUBSTITUTIONS, coreById, files, merged, PROPOSED (+5 more)

### Community 102 - "trial.ts"
Cohesion: 0.17
Nodes (13): ArmId, SpanVerdict, CouncilResult, armB, inPath, leak, outPath, redactRow() (+5 more)

### Community 103 - "mine-transcripts.ts"
Cohesion: 0.16
Nodes (12): all, bands, collect(), Mined, mostlyCode(), outPath, perBand, picked (+4 more)

### Community 104 - "Console.stories.tsx"
Cohesion: 0.18
Nodes (9): captureLabel(), CAPTURE, CaptureActive, CaptureIdle, Default, Expanded, LongCaptureLabel, StaleSelection (+1 more)

### Community 105 - "claudeTranscript.ts"
Cohesion: 0.36
Nodes (8): absorb(), absorbMessage(), asString(), clampPrompt(), coercePromptText(), isRecord(), parseLine(), timestampMs()

### Community 106 - "models.ts"
Cohesion: 0.24
Nodes (10): Cap, ModelId, MODELS, ModelSpec, Reshaped, resolvedIds, resolveId(), stripThinking() (+2 more)

### Community 107 - "containment.ts"
Cohesion: 0.33
Nodes (8): checkAll(), checkSpan(), matchedPrefixWords(), normalise(), Transform, TRANSFORMS, Case, CASES

### Community 108 - "discover.ts"
Cohesion: 0.33
Nodes (7): discoverWorkingSet(), mtimeOf(), readDirNames(), selectWorkingSet(), NOW, TranscriptFile, ADR-0008

### Community 109 - "speaker.ts"
Cohesion: 0.43
Nodes (6): absentSpeaker(), realtimeSpeaker(), sessionInstructions(), Speaker, speakerFromEnv(), timeoutFor()

### Community 110 - "CommitGroup.stories.tsx"
Cohesion: 0.33
Nodes (5): CommitGroup(), Default, FILES, Story, Uncommitted

### Community 111 - "StatusDot.stories.tsx"
Cohesion: 0.33
Nodes (5): AllTones, Default, Labelled, Pulsing, Story

### Community 112 - "deliveryState"
Cohesion: 0.60
Nodes (3): deliveryState, rosterStatus, row()

### Community 113 - "IconButton.stories.tsx"
Cohesion: 0.40
Nodes (3): Default, Story, PlusIcon

## Knowledge Gaps
- **617 isolated node(s):** `*.css`, `projectRoot`, `config`, `project`, `$schema` (+612 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createEclipseOrb()` connect `sessionFacts.ts` to `channels.ts`?**
  _High betweenness centrality (0.333) - this node is a cross-community bridge._
- **Why does `TerminalSession` connect `channels.ts` to `toggle-group.tsx`?**
  _High betweenness centrality (0.333) - this node is a cross-community bridge._
- **Why does `model()` connect `Session State Hub` to `toggle-group.tsx`, `React Types`?**
  _High betweenness centrality (0.186) - this node is a cross-community bridge._
- **What connects `*.css`, `projectRoot`, `config` to the rest of the system?**
  _617 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Biome Config` be split into smaller, more focused modules?**
  _Cohesion score 0.1339031339031339 - nodes in this community are weakly interconnected._
- **Should `Root Package Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._
- **Should `Turbo Build Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.06653225806451613 - nodes in this community are weakly interconnected._