# Graph Report - argo  (2026-08-03)

## Corpus Check
- 357 files · ~162,532 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1766 nodes · 3901 edges · 123 communities (89 shown, 34 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `33bfac6a`
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
- BranchNameField.stories.tsx
- liveness.ts
- electron
- @electron-toolkit/tsconfig
- @types/react

## God Nodes (most connected - your core abstractions)
1. `cn()` - 90 edges
2. `Text()` - 60 edges
3. `createIcon()` - 49 edges
4. `scripts` - 23 edges
5. `Button()` - 20 edges
6. `parseTranscript()` - 16 edges
7. `isRecord()` - 16 edges
8. `asString()` - 15 edges
9. `scripts` - 14 edges
10. `runGit()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `collect()` --indirect_call--> `file()`  [INFERRED]
  prototypes/return-path-eval/mine-transcripts.ts → apps/desktop/src/main/observe/observedSession.test.ts
- `main()` --indirect_call--> `model()`  [INFERRED]
  prototypes/marker-drop-rate/sweep.ts → apps/desktop/src/shared/lifecycleModel.test.ts
- `wireSpawn()` --indirect_call--> `state()`  [INFERRED]
  apps/desktop/src/main/spawnSession.ts → apps/desktop/src/renderer/src/shell/shellModel.test.ts
- `agentsOf()` --calls--> `parseTranscript()`  [EXTRACTED]
  apps/desktop/src/main/observe/sessionStatus.test.ts → apps/desktop/src/main/observe/claudeTranscript.ts
- `observe()` --indirect_call--> `project()`  [INFERRED]
  apps/desktop/src/main/observe/observe.seamB.test.ts → apps/desktop/src/shared/projects.test.ts

## Import Cycles
- None detected.

## Communities (123 total, 34 thin omitted)

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
Cohesion: 0.15
Nodes (13): TERMINAL_PRESENTATION, LifecycleNode(), NODE_LABEL, PrAnchor(), Default, Story, cn(), twMerge (+5 more)

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
Nodes (9): devDependencies, electron-builder, electron-vite, @fontsource-variable/inter, @vitest/browser-playwright, electron-builder, electron-vite, @fontsource-variable/inter (+1 more)

### Community 10 - "Root TSConfig References"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 14 - "App Rail Shell"
Cohesion: 0.12
Nodes (20): AllIcons, Default, Story, Default, EveryState, Pulsing, Story, deliveryState (+12 more)

### Community 19 - "Dependency Cruiser"
Cohesion: 0.14
Nodes (13): AUTH, ConsoleExpanded, DEFAULT_LAYOUT, DEFAULT_UI, EmptyRoster, EXPANDED_LAYOUT, NOOP_HANDLERS, NoSelection (+5 more)

### Community 20 - "Vitest Browser Playwright"
Cohesion: 0.27
Nodes (9): FileDiff(), hunkLineTone(), kindGlyph(), FindingCard(), severityAccent(), Disclosure, DisclosureAction, disclosureReducer() (+1 more)

### Community 23 - "Storybook Docs Addon"
Cohesion: 0.07
Nodes (39): captureLabel(), Console(), ConsoleProps, CAPTURE, CaptureActive, CaptureIdle, Default, Expanded (+31 more)

### Community 25 - "Electron Vite"
Cohesion: 0.17
Nodes (18): DEFAULT_PANEL_UI, SessionPanel, ChangesView, DeliveryTab, SessionPanel(), SessionScreen(), SessionScreenHandlers, SessionScreenProps (+10 more)

### Community 31 - "React Types"
Cohesion: 0.15
Nodes (23): CAPS, checkLine(), CLASS_OF, ExpectedMarker, extractExpected(), extractiveFallback(), HOMOGRAPH_STOPLIST, isViolation() (+15 more)

### Community 39 - "Session State Hub"
Cohesion: 0.10
Nodes (32): BRANCH_REF_ARGS, commitsIn(), mirroredDrift(), parseBranchRefs(), parseTrack(), RawRef, readBranchRefs(), named() (+24 more)

### Community 40 - "Electron"
Cohesion: 0.17
Nodes (14): ConsoleChannelTab(), ConsoleChannelTabProps, AccentCard(), AccentCardHeader(), AccentCardTone, accentCardVariants, Blocking, Landed (+6 more)

### Community 48 - "sessionFacts.ts"
Cohesion: 0.12
Nodes (22): Hub, Claim, createManagedSessions(), ManagedSessions, ADR-0013, toSessionUpdate(), Context, createObserver() (+14 more)

### Community 49 - "index.ts"
Cohesion: 0.09
Nodes (21): CiFailingHead, CiRunning, CommitsGate, CommitsGateNotHead, CommitsNow, CommitsSync, CommitsWithCheckOutput, MergeAuto (+13 more)

### Community 50 - "Text.tsx"
Cohesion: 0.13
Nodes (17): App(), ADR-0005, ADR-0015, RoomStage(), GitGroup, useGitFacts(), GitHatches, useGitGroup() (+9 more)

### Community 51 - "PaneSplitter.stories.tsx"
Cohesion: 0.11
Nodes (16): RosterTone, ProjectStrip(), Default, NoProjects, OneProject, Story, TABS, Active (+8 more)

### Community 52 - "icons.stories.tsx"
Cohesion: 0.14
Nodes (14): ConciergeCaption(), Default, Silent, Story, ConciergeStrip(), Default, Story, OrbMini() (+6 more)

### Community 53 - "badge.stories.tsx"
Cohesion: 0.18
Nodes (14): DeliveryTabs(), isChangesView(), isDeliveryTab(), AllTones, ChangesTone, Default, Story, TONES (+6 more)

### Community 54 - "button.stories.tsx"
Cohesion: 0.19
Nodes (15): DropdownMenu(), DropdownMenuContent(), DropdownMenuGroup(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuSeparator(), DropdownMenuTrigger(), Default (+7 more)

### Community 55 - "ContextGauge.tsx"
Cohesion: 0.17
Nodes (15): deriveSessionStatus(), HALTING_REASONS, hasPendingAsk(), isRecent(), quietStatus(), statusOf(), agentsOf(), NOW (+7 more)

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
Cohesion: 0.12
Nodes (18): TYPE_ROLES, TypeRole, StatusDot(), AllTones, Default, Labelled, Pulsing, Story (+10 more)

### Community 61 - "icons.stories.tsx"
Cohesion: 0.17
Nodes (12): AllGlyphs, boxOf(), Decorative, Default, glyph(), GLYPHS, InlineWithText, Labelled (+4 more)

### Community 62 - "drawerControls.tsx"
Cohesion: 0.22
Nodes (8): SessionHeader(), HonestEmpty, Story, ToggleSolo, WORKSPACE, WorkspacePresent, WorkspaceModel, WorkspaceTree

### Community 63 - "button.stories.tsx"
Cohesion: 0.13
Nodes (12): AllVariants, AsChild, Bare, Default, Disabled, Quiet, SIZES, Story (+4 more)

### Community 64 - "DeliveryLifecycle.stories.tsx"
Cohesion: 0.18
Nodes (10): DeliveryLifecycle(), Absent, BeforePr, Closed, Default, DeliveryLifecycleProps, IN_REVIEW, Merged (+2 more)

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
Nodes (8): AllVariants, AsChild, Default, SHAPES, Story, VARIANTS, VERDICT_VARIANTS, WithIcon

### Community 69 - "BackgroundTasks.stories.tsx"
Cohesion: 0.25
Nodes (13): createHub(), parseTranscript(), observe(), parseFixture(), toObservedSession(), toSessionEvent(), latestInChain(), stitch() (+5 more)

### Community 70 - "ContextGauge.tsx"
Cohesion: 0.27
Nodes (6): EmptyRoster(), Default, Story, SessionRow(), CaretRightIcon, Status()

### Community 71 - "SectionHeader.tsx"
Cohesion: 0.19
Nodes (10): Badge(), BadgeVariant, badgeVariants, ButtonVariant, StatusIcon(), SectionHeader(), Default, Story (+2 more)

### Community 72 - "toggle-group.tsx"
Cohesion: 0.11
Nodes (13): ADR-0005, ADR-0008, ADR-0017, transcriptRoot(), ADR-0005, wireProjection(), shellCommand(), ADR-0005 (+5 more)

### Community 73 - "checkbox.stories.tsx"
Cohesion: 0.33
Nodes (5): Checkbox(), Checked, Default, Disabled, Story

### Community 74 - "electron-vite"
Cohesion: 0.11
Nodes (16): LIFECYCLE_NODE_STATE, LifecycleNodeStatePresentation, ArrowLineUpIcon, ArrowsClockwiseIcon, CheckIcon, CircleIcon, CircleNotchIcon, IconAtom (+8 more)

### Community 76 - "react"
Cohesion: 0.18
Nodes (20): CheckOutputProps, ciBody(), commitsBody(), commitsStageBody(), NodeDrawer(), NodeDrawerProps, NodeDrawerSession, mergeBody() (+12 more)

### Community 77 - "react-dom"
Cohesion: 0.14
Nodes (15): CockpitHandlers, CockpitScreenProps, CockpitScreenView(), CONNECTED, Default, FACTS, NotAGitRepository, NothingConnected (+7 more)

### Community 78 - "projection.ts"
Cohesion: 0.05
Nodes (67): created(), intake(), projected(), toIntake(), activateProject(), addProject(), addSession(), attribute() (+59 more)

### Community 79 - "sessionStore.ts"
Cohesion: 0.46
Nodes (6): applyResize(), applySnap(), isConsoleExpanded(), SPINE, base, useSpineLayout()

### Community 80 - "sessionFacts.ts"
Cohesion: 0.14
Nodes (19): GradeStatus, resolveTitle(), file(), running(), toAgents(), StatusSignals, LogicalSession, ObservedSession (+11 more)

### Community 81 - "terminalBridge.ts"
Cohesion: 0.16
Nodes (24): restoreProjects(), registryFile(), twoProjects(), activate(), chooseFolder(), register(), ADR-0017, wireProjects() (+16 more)

### Community 82 - "channels.ts"
Cohesion: 0.08
Nodes (27): isGitOperation(), isGitRequest(), isProjectId(), refuse(), ADR-0004, wireGit(), ProjectionListener, ADR-0005 (+19 more)

### Community 83 - "Roster.stories.tsx"
Cohesion: 0.12
Nodes (17): Addressing, Advisory, Default, Fixed, Story, WalkFocused, FINDING_SEVERITIES, FINDING_SEVERITY (+9 more)

### Community 84 - "SessionRow.tsx"
Cohesion: 0.13
Nodes (13): CollapsedGroup, commitReady, deliveryStates, Empty, everyState, needsYou, NeedsYouPulse, oneSession (+5 more)

### Community 85 - "deliveryState"
Cohesion: 0.25
Nodes (7): SessionHeaderProps, SessionHeaderModel, IconButton(), PanelHeader(), Default, LeftOnly, Story

### Community 86 - "deliveryState"
Cohesion: 0.19
Nodes (10): BranchSelector(), BranchSelectorProps, Default, Story, TRACKING, TrackingStates, Default, InStep (+2 more)

### Community 87 - "PrChecksList.tsx"
Cohesion: 0.13
Nodes (18): CHECK_LABEL, CheckOutput(), LOCAL_CHECKS, LocalCheck, Default, EveryCheck, MultilineFeed, Story (+10 more)

### Community 88 - "FileDiff.stories.tsx"
Cohesion: 0.20
Nodes (9): AllKinds, Default, DefaultViewed, FINDINGS, HUNK, KINDS, MarkedUncommitted, Story (+1 more)

### Community 89 - "FindingCard.tsx"
Cohesion: 0.14
Nodes (22): AllFilesDiff(), AllFilesDiffFile, Default, Empty, FILES, Story, CommitGroup(), CommitGroupFile (+14 more)

### Community 90 - "lifecycleNodeState.ts"
Cohesion: 0.29
Nodes (8): BranchRow, BranchRowAction, isDeletable(), BranchMenu(), BranchMenuProps, BranchMenuRow(), BranchRowHandlers, GitControlsProps

### Community 91 - "PrChecksList.stories.tsx"
Cohesion: 0.15
Nodes (13): AGGREGATE_TONE, CI_RUN_PRESENTATION, CI_RUN_STATUSES, CiRunStatus, PrChecksList(), PrChecksListProps, Default, EveryRunStatus (+5 more)

### Community 92 - "NowLine.stories.tsx"
Cohesion: 0.26
Nodes (9): Default, Story, Tooltip(), TooltipContent(), TooltipProvider(), TooltipTrigger(), ProjectStripProps, ProjectTab() (+1 more)

### Community 93 - "SessionRow.stories.tsx"
Cohesion: 0.29
Nodes (5): Default, EveryState, Pulsing, Selected, Story

### Community 94 - "SessionScreen.tsx"
Cohesion: 0.16
Nodes (15): capLabel(), byClass(), byToken(), capKey(), corpus, errs, lengthTable(), ok (+7 more)

### Community 95 - "useDisclosure"
Cohesion: 0.33
Nodes (5): DelegatedRow(), GateAction(), GrowRow(), DisclosureProps, useDisclosure()

### Community 96 - "@electron-toolkit/tsconfig"
Cohesion: 0.12
Nodes (14): armKeys, contested, failed, judged, ok, parseProblems, path, pct() (+6 more)

### Community 99 - "@types/three"
Cohesion: 0.17
Nodes (9): manageMenu, facts(), ref(), BranchManageProps, GitControls(), Default, facts, NotAGitRepository (+1 more)

### Community 100 - "arms.ts"
Cohesion: 0.14
Nodes (23): Cap, systemPrompt(), userPrompt(), availableLocalKeys(), ModelId, MODELS, ModelSpec, Reshaped (+15 more)

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
Cohesion: 0.15
Nodes (11): RoomSwitcher(), Default, EveryRoom, Story, ConnectionStale, Default, LongCaption, NoGitControls (+3 more)

### Community 105 - "claudeTranscript.ts"
Cohesion: 0.09
Nodes (51): absorb(), absorbMessage(), clampPrompt(), coercePromptText(), DELEGATING_TOOLS, KIND_BY_NAME, planEntryStatus(), planFrom() (+43 more)

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

### Community 111 - "StatusDot.stories.tsx"
Cohesion: 0.22
Nodes (6): BranchManage(), Ahead, Behind, Default, Diverged, Story

### Community 112 - "deliveryState"
Cohesion: 0.36
Nodes (4): NO_WATCHER, ADR-0008, Watcher, watchTranscripts()

### Community 113 - "IconButton.stories.tsx"
Cohesion: 0.13
Nodes (8): Default, Story, ArrowLineDownIcon, GitBranchIcon, PencilSimpleIcon, PlusIcon, TrashIcon, OPERATIONS

### Community 115 - "electron-builder"
Cohesion: 0.39
Nodes (4): clampPercentage(), ContextGauge(), Default, Story

### Community 116 - "electron-vite"
Cohesion: 0.25
Nodes (6): Default, facts, LocalOnly, localOnlyFacts, rows, Story

### Community 117 - "@fontsource-variable/inter"
Cohesion: 0.60
Nodes (4): Roster(), HOT_HEAD_STATES, isHotHeadState(), lifecycleIsHot()

### Community 118 - "BranchNameField.stories.tsx"
Cohesion: 0.40
Nodes (4): BranchNameField(), Default, Story, WhitespaceOnly

### Community 119 - "liveness.ts"
Cohesion: 1.00
Nodes (3): gatherClaudeProcesses(), processCwd(), run

## Knowledge Gaps
- **658 isolated node(s):** `*.css`, `projectRoot`, `config`, `project`, `$schema` (+653 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PanelSplitter()` connect `PanelSplitter.stories.tsx` to `sessionFacts.ts`, `Electron Vite`, `Session Row & Button`, `SectionHeader.tsx`?**
  _High betweenness centrality (0.326) - this node is a cross-community bridge._
- **Why does `Observer` connect `sessionFacts.ts` to `BackgroundTasks.stories.tsx`?**
  _High betweenness centrality (0.323) - this node is a cross-community bridge._
- **Why does `model()` connect `projection.ts` to `React Types`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
- **What connects `*.css`, `projectRoot`, `config` to the rest of the system?**
  _658 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Biome Config` be split into smaller, more focused modules?**
  _Cohesion score 0.1339031339031339 - nodes in this community are weakly interconnected._
- **Should `Root Package Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Should `Turbo Build Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.06653225806451613 - nodes in this community are weakly interconnected._