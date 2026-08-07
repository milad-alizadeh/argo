# Graph Report - argo  (2026-08-07)

## Corpus Check
- 547 files · ~330,133 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2871 nodes · 6669 edges · 143 communities (117 shown, 26 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 51 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cb636959`
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
- branchMenuModel.ts
- MutationRow.tsx
- @electron-toolkit/tsconfig
- react
- react-dom
- CallRow.tsx
- arms.ts
- useShellState.ts
- trial.ts
- mine-transcripts.ts
- Console.stories.tsx
- claudeTranscript.ts
- models.ts
- containment.ts
- discover.ts
- speaker.ts
- CommitGroup.stories.tsx
- deviceFlow.ts
- channels.ts
- IconButton.stories.tsx
- smoke-realtime.ts
- parseTranscript
- Prose.tsx
- TurnFeed.stories.tsx
- Cli
- issues.ts
- @types/react
- MutationRow.stories.tsx
- gitHubPort.ts
- dependencies
- useConnectPanel.ts
- dock.ts
- toolResult.ts
- stateMap.ts
- WelcomeScreen.tsx
- DeliveryLifecycle.tsx
- realSession.ts
- DiffLines.tsx
- projection.ts
- NowHead.tsx
- TerminalPane.tsx
- package.json
- ContextRing.tsx
- watch.test.ts
- ArchivedFooter.stories.tsx
- NewSessionRow.stories.tsx
- @types/mdast
- unified
- @vitest/browser-playwright

## God Nodes (most connected - your core abstractions)
1. `cn()` - 105 edges
2. `Text()` - 92 edges
3. `createIcon()` - 50 edges
4. `asString()` - 30 edges
5. `isRecord()` - 29 edges
6. `parseTranscript()` - 28 edges
7. `Button()` - 25 edges
8. `scripts` - 23 edges
9. `Hub` - 22 edges
10. `aTurn()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `collect()` --indirect_call--> `file()`  [INFERRED]
  prototypes/return-path-eval/mine-transcripts.ts → apps/desktop/src/main/observe/__fixtures__/logical.ts
- `main()` --indirect_call--> `model()`  [INFERRED]
  prototypes/marker-drop-rate/sweep.ts → apps/desktop/src/renderer/src/cockpit/connect/useConnectPanel.ts
- `firstInChain()` --indirect_call--> `file()`  [INFERRED]
  apps/desktop/src/main/observe/resumeChain.ts → apps/desktop/src/main/observe/__fixtures__/logical.ts
- `maxInChain()` --indirect_call--> `file()`  [INFERRED]
  apps/desktop/src/main/observe/resumeChain.ts → apps/desktop/src/main/observe/__fixtures__/logical.ts
- `stitch()` --indirect_call--> `file()`  [INFERRED]
  apps/desktop/src/main/observe/resumeChain.ts → apps/desktop/src/main/observe/__fixtures__/logical.ts

## Import Cycles
- 1-file cycle: `apps/desktop/src/renderer/src/rooms/sessions/__fixtures__/realSession.ts -> apps/desktop/src/renderer/src/rooms/sessions/__fixtures__/realSession.ts`

## Communities (143 total, 26 thin omitted)

### Community 0 - "Biome Config"
Cohesion: 0.13
Nodes (20): ADR-0007, AxisResult, convene(), judgeOnce(), AXES, Axis, AxisId, judgePrompt() (+12 more)

### Community 1 - "Root Package Manifest"
Cohesion: 0.04
Nodes (44): @biomejs/biome, husky, jscpd, lint-staged, bin, argo, devDependencies, @biomejs/biome (+36 more)

### Community 2 - "Turbo Build Pipeline"
Cohesion: 0.07
Nodes (31): ^build, dist/**, OPENAI_API_KEY, out/**, REALTIME_MODEL, storybook-static/**, dependsOn, outputs (+23 more)

### Community 3 - "Desktop App Package"
Cohesion: 0.14
Nodes (14): scripts, boundaries, build, build-storybook, dev, package, start, storybook (+6 more)

### Community 4 - "Session Row & Button"
Cohesion: 0.08
Nodes (35): TypeRole, RailActionRow(), Default, Story, AccentCard(), AccentCardHeader(), AccentCardTone, accentCardVariants (+27 more)

### Community 5 - "Runtime Dependencies"
Cohesion: 0.09
Nodes (26): ArrowCounterClockwiseIcon, ArrowRightIcon, ArrowsLeftRightIcon, ArrowsMergeIcon, ArrowSquareOutIcon, BugIcon, CaretLeftIcon, CaretUpIcon (+18 more)

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
Cohesion: 0.06
Nodes (33): devDependencies, electron, @electron-toolkit/tsconfig, electron-vite, @fontsource-variable/inter, happy-dom, playwright, @playwright/test (+25 more)

### Community 10 - "Root TSConfig References"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 13 - "Storybook Vitest Addon"
Cohesion: 0.14
Nodes (20): findingBodyStub(), FindingCard(), severityAccent(), Addressing, Advisory, Default, Fixed, Story (+12 more)

### Community 14 - "App Rail Shell"
Cohesion: 0.21
Nodes (9): AllIcons, Default, Story, HOT_HEAD_STATES, isHotHeadState(), DeliveryClaim, DOT_GLOWS, ROSTER_ICONS (+1 more)

### Community 16 - "Playwright"
Cohesion: 0.18
Nodes (13): ContextMenu(), ContextMenuContent(), ContextMenuItem(), ContextMenuTrigger(), Default, Story, Default, Story (+5 more)

### Community 17 - "Rail E2E Spec"
Cohesion: 0.14
Nodes (14): AGGREGATE_TONE, CI_RUN_PRESENTATION, CI_RUN_STATUSES, CiRunStatus, PrChecksList(), PrChecksListProps, Default, EveryRunStatus (+6 more)

### Community 18 - "Playwright Test"
Cohesion: 0.27
Nodes (11): attachDock(), claimFor(), cols(), detach(), DockWindow, rows(), ADR-0005, viewKey() (+3 more)

### Community 19 - "Dependency Cruiser"
Cohesion: 0.09
Nodes (24): ARCHIVED, ArchivedOpen, POPULATED, PR, Selected, Story, Zero, Blocked (+16 more)

### Community 20 - "Vitest Browser Playwright"
Cohesion: 0.05
Nodes (49): NothingObserved, RealSession, Story, Surface, WideFanout, Docked, Expanded, NoPtyToSteer (+41 more)

### Community 22 - "Storybook A11y Addon"
Cohesion: 0.28
Nodes (11): created(), intake(), projected(), ProjectRecord, Launch, AgentExit, AgentSpawn, SessionIntake (+3 more)

### Community 23 - "Storybook Docs Addon"
Cohesion: 0.06
Nodes (57): Closable, Embedded, Failed, FileGone, FromDisk, row(), SamePathThrice, STAGES (+49 more)

### Community 24 - "Chromatic Storybook"
Cohesion: 0.08
Nodes (41): ActivityPane(), ActivityItem, ActivityModel, buildActivity(), DelegateItem, ownItem(), rowsOf(), sessionChapters() (+33 more)

### Community 25 - "Electron Vite"
Cohesion: 0.15
Nodes (12): DeliveryCommitGroup, ALL_FILES, ArtifactsTab, ByCommit, COMMIT_GROUPS, IN_REVIEW, InReview, Merged (+4 more)

### Community 28 - "Tailwind Vite Plugin"
Cohesion: 0.17
Nodes (7): createGitHubClient(), GitHubClient, GitHubClientOptions, GitHubRefusal, Page, refusalReason(), ADR-0018

### Community 29 - "TW Animate CSS"
Cohesion: 0.20
Nodes (7): App, ArgoApp, CockpitView, ArgoUI, Scene, SwiftUI, View

### Community 30 - "Node Types"
Cohesion: 0.33
Nodes (7): discoverWorkingSet(), mtimeOf(), readDirectoryNames(), selectWorkingSet(), NOW, TranscriptFile, ADR-0008

### Community 31 - "React Types"
Cohesion: 0.05
Nodes (66): model(), Cap, capLabel(), CAPS, systemPrompt(), userPrompt(), Chunk, ChunkType (+58 more)

### Community 34 - "Vite"
Cohesion: 0.31
Nodes (4): ShellCommands, useShellKeymap(), shellCommand, WITH_META

### Community 35 - "Vite React Plugin"
Cohesion: 0.05
Nodes (81): resultOf(), Delegation, CallRole, Effect, ROLE, roleOf(), Yield, yieldOf() (+73 more)

### Community 36 - "Vitest"
Cohesion: 0.36
Nodes (6): argoItem(), shopItem(), PARENT_TYPE_WORDS, workItemKind, WorkItemStatus, workItemView

### Community 39 - "Session State Hub"
Cohesion: 0.07
Nodes (48): BRANCH_REF_ARGS, commitsIn(), mirroredDrift(), parseBranchRefs(), parseTrack(), RawRef, readBranchRefs(), named() (+40 more)

### Community 40 - "Electron"
Cohesion: 0.18
Nodes (9): AgentsRail(), ENTRY_MARK, ENTRY_TEXT, PlanProgress(), CaretRightIcon, SectionHeader(), Default, Story (+1 more)

### Community 48 - "sessionFacts.ts"
Cohesion: 0.10
Nodes (46): createHub(), readImageFile(), gatherClaudeProcesses(), processCwd(), run, ClaimId, observe(), parseFixture() (+38 more)

### Community 49 - "index.ts"
Cohesion: 0.09
Nodes (21): CiFailingHead, CiRunning, CommitsGate, CommitsGateNotHead, CommitsNow, CommitsSync, CommitsWithCheckOutput, MergeAuto (+13 more)

### Community 50 - "Text.tsx"
Cohesion: 0.12
Nodes (21): App(), ADR-0005, ADR-0015, useConnectPanel(), GitGroup, useGitFacts(), GitHatches, useGitGroup() (+13 more)

### Community 51 - "PaneSplitter.stories.tsx"
Cohesion: 0.18
Nodes (20): CAPABILITIES, GITHUB_STATES, GitHubWorkItemsOptions, join(), readBacklog(), readIssue(), ADR-0014, ADR-0018 (+12 more)

### Community 52 - "icons.stories.tsx"
Cohesion: 0.17
Nodes (10): ConciergeCaption(), Default, Silent, Story, ConciergeStrip(), Default, Story, OrbMini() (+2 more)

### Community 53 - "badge.stories.tsx"
Cohesion: 0.11
Nodes (24): CONTENT_LABEL, Delivery(), DeliveryProps, ChangesView, DeliveryTab, DeliveryTabs(), isChangesView(), isDeliveryTab() (+16 more)

### Community 54 - "button.stories.tsx"
Cohesion: 0.04
Nodes (61): STICKY_BAR, DropdownMenu(), DropdownMenuContent(), DropdownMenuGroup(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuSeparator(), DropdownMenuTrigger() (+53 more)

### Community 55 - "ContextGauge.tsx"
Cohesion: 0.11
Nodes (24): emptyTranscript(), file(), logicalOf(), running(), turn(), deriveSessionStatus(), HALTING_REASONS, hasPendingAsk() (+16 more)

### Community 56 - "SectionHeader.tsx"
Cohesion: 0.17
Nodes (11): ASKING, BROKEN, Candidate, LANDED, MOVING, OBSERVED, RAIL_DOTS, RailState (+3 more)

### Community 58 - "PanelSplitter.stories.tsx"
Cohesion: 0.20
Nodes (11): clampPanelSize(), keyStepDelta(), PANEL_ORIENTATIONS, PanelOrientation, PanelSplitter(), PanelSplitterProps, AllOrientations, Default (+3 more)

### Community 59 - "WorkspaceIdentity.tsx"
Cohesion: 0.13
Nodes (18): Adopted, AgentPty, createAgentTerminals(), Listener, Listener, attach(), observed(), resize() (+10 more)

### Community 60 - "Text.tsx"
Cohesion: 0.22
Nodes (8): AllVariants, AsChild, Default, SHAPES, Story, VARIANTS, VERDICT_VARIANTS, WithIcon

### Community 61 - "icons.stories.tsx"
Cohesion: 0.17
Nodes (12): AllGlyphs, boxOf(), Decorative, Default, glyph(), GLYPHS, InlineWithText, Labelled (+4 more)

### Community 62 - "drawerControls.tsx"
Cohesion: 0.25
Nodes (7): cache, outputs, extends, $schema, tasks, build, //

### Community 63 - "button.stories.tsx"
Cohesion: 0.12
Nodes (13): AllVariants, AsChild, Bare, Default, Disabled, Quiet, SIZES, Story (+5 more)

### Community 64 - "DeliveryLifecycle.stories.tsx"
Cohesion: 0.20
Nodes (9): Absent, BeforePr, Closed, Default, DeliveryLifecycleProps, IN_REVIEW, Merged, PR (+1 more)

### Community 65 - "DeliveryTabs.stories.tsx"
Cohesion: 0.20
Nodes (9): ArtifactsSelected, Default, onBack, ReviewOutstanding, Scoped, Story, Stub, unscopedArgs (+1 more)

### Community 66 - "FindingCard.stories.tsx"
Cohesion: 0.12
Nodes (19): ARMS, Arm, armB(), EvalChunk, loadCorpus(), sessionInstructions(), argv, byArm (+11 more)

### Community 67 - "LifecycleNode.stories.tsx"
Cohesion: 0.22
Nodes (8): Default, EveryNode, EveryState, HeadPulsing, NotClickable, Open, Story, WithSub

### Community 68 - "badge.stories.tsx"
Cohesion: 0.16
Nodes (18): deliveryState, RailStatus, ATTENTION_CLAIMS, claimsOf(), deliveryClaimWord(), LANDED, milestone(), MILESTONE_CLAIMS (+10 more)

### Community 69 - "BackgroundTasks.stories.tsx"
Cohesion: 0.09
Nodes (15): Claim, createManagedSessions(), ManagedSessions, BEFORE, DURING, ADR-0013, createObserver(), Observer (+7 more)

### Community 70 - "ContextGauge.tsx"
Cohesion: 0.39
Nodes (6): PR, STATE_MATRIX_ROWS, stateMatrixInput(), StateMatrixRow, labelOf(), outcomes

### Community 71 - "SectionHeader.tsx"
Cohesion: 0.13
Nodes (33): SessionInterior, useSessionInterior(), useTerminalAttach(), useWallClock(), Dock(), KIND_LABEL, Roster(), asInteriorTab() (+25 more)

### Community 72 - "toggle-group.tsx"
Cohesion: 0.18
Nodes (11): ADR-0005, wireProjection(), Hub, ProjectionListener, ADR-0005, ADR-0005, ADR-0005, ADR-0008 (+3 more)

### Community 73 - "checkbox.stories.tsx"
Cohesion: 0.10
Nodes (31): ChapterBlock(), DensityGutter(), pct(), Tick(), activeOf(), anchorsOf(), jumpFeedTo(), stepFeed() (+23 more)

### Community 74 - "electron-vite"
Cohesion: 0.13
Nodes (12): LIFECYCLE_NODE_STATE, ArrowLineUpIcon, CheckIcon, CircleIcon, CircleNotchIcon, GearIcon, GitCommitIcon, GitMergeIcon (+4 more)

### Community 75 - "happy-dom"
Cohesion: 0.33
Nodes (5): description, name, private, scripts, build

### Community 76 - "react"
Cohesion: 0.16
Nodes (23): CheckOutputProps, ciBody(), commitsBody(), commitsStageBody(), DelegatedRow(), GateAction(), GrowRow(), NodeDrawer() (+15 more)

### Community 77 - "react-dom"
Cohesion: 0.08
Nodes (25): CockpitScreenProps, CockpitScreenView(), CONNECTED, Default, FACTS, GrantRefused, NotAGitRepository, NothingConnected (+17 more)

### Community 78 - "projection.ts"
Cohesion: 0.06
Nodes (33): buildWorld(), here, absorb(), absorbFirstPrompt(), absorbMessage(), coercePromptText(), ParseOptions, parseTranscript() (+25 more)

### Community 79 - "sessionStore.ts"
Cohesion: 0.20
Nodes (9): AllTones, Default, EveryState, Hollow, Labelled, Pulsing, Quiet, RAIL_STATES (+1 more)

### Community 80 - "sessionFacts.ts"
Cohesion: 0.12
Nodes (20): ADR-0017, projectFolder(), connect(), wireWorkItems(), WorkItemsBridgeOptions, githubClientId(), HttpResponse, nodeHttp() (+12 more)

### Community 81 - "terminalBridge.ts"
Cohesion: 0.15
Nodes (27): restoreProjects(), registryFile(), twoProjects(), activate(), chooseCli(), chooseFolder(), create(), ADR-0017 (+19 more)

### Community 82 - "channels.ts"
Cohesion: 0.09
Nodes (13): cockpit, Window, ADR-0005, CockpitBridge, DeviceCodePrompt, TerminalAttachRequest, TerminalSession, TerminalSize (+5 more)

### Community 83 - "Roster.stories.tsx"
Cohesion: 0.12
Nodes (18): spawnedRow(), projectCli(), AgentLauncher, createAgentLauncher(), Launched, AgentTerminals, AttachedTerminal, Docks (+10 more)

### Community 84 - "SessionRow.tsx"
Cohesion: 0.50
Nodes (3): Default, Story, WindowControls()

### Community 85 - "deliveryState"
Cohesion: 0.15
Nodes (25): GRANT_STATES, GrantState, ADR-0014, ADR-0018, activateProject(), addProject(), addSession(), attribute() (+17 more)

### Community 86 - "deliveryState"
Cohesion: 0.10
Nodes (28): ciState(), commitsState(), LIFECYCLE_KEYS, lifecycleModel, LifecycleNodeKey, LifecycleNodes, LifecycleNodeState, mergeState() (+20 more)

### Community 87 - "PrChecksList.tsx"
Cohesion: 0.12
Nodes (19): CHECK_LABEL, CheckOutput(), LOCAL_CHECKS, LocalCheck, Default, EveryCheck, MultilineFeed, Story (+11 more)

### Community 88 - "FileDiff.stories.tsx"
Cohesion: 0.12
Nodes (24): AllStates, Connecting, FolderOnly, Fresh, Refused, Settings, Story, buildConnectPanelModel() (+16 more)

### Community 89 - "FindingCard.tsx"
Cohesion: 0.09
Nodes (29): AllFilesDiff(), AllFilesDiffFile, Default, Empty, FILES, Story, CommitGroup(), CommitGroupFile (+21 more)

### Community 90 - "lifecycleNodeState.ts"
Cohesion: 0.29
Nodes (5): Default, NeutralWord, propsOf(), Pulsing, Story

### Community 91 - "PrChecksList.stories.tsx"
Cohesion: 0.25
Nodes (5): PR, rails, REVIEWING, RosterWord, SessionDot

### Community 92 - "NowLine.stories.tsx"
Cohesion: 0.14
Nodes (20): SessionMeta(), branchSegment(), buildInteriorHeader(), IntentChip, MetaSegment, metaSegments(), ran(), segment() (+12 more)

### Community 93 - "SessionRow.stories.tsx"
Cohesion: 0.10
Nodes (19): AgentPicker(), Default, Reselected, Story, ConnectPanel(), ConnectPanelHandlers, ADR-0015, ConnectRow() (+11 more)

### Community 95 - "MutationRow.tsx"
Cohesion: 0.05
Nodes (55): CallOutput(), LOG, LongLog, Printed, Story, callMark(), CallRow(), FAILED (+47 more)

### Community 96 - "@electron-toolkit/tsconfig"
Cohesion: 0.12
Nodes (14): armKeys, contested, failed, judged, ok, parseProblems, path, pct() (+6 more)

### Community 99 - "CallRow.tsx"
Cohesion: 0.25
Nodes (6): Failed, FailedRead, NoOutput, Ran, Running, Story

### Community 100 - "arms.ts"
Cohesion: 0.21
Nodes (12): ArmId, ArmSpec, RouterOutput, runRouter(), ChunkType, parseRouterReply(), ReducedPayload, renderForSpeaker() (+4 more)

### Community 101 - "useShellState.ts"
Cohesion: 0.33
Nodes (11): currentSessionId(), ShellState, useShellState(), CockpitHandlers, DEFAULT_PROJECT_UI, nextProjectId(), ProjectUi, ProjectUiMemory (+3 more)

### Community 102 - "trial.ts"
Cohesion: 0.19
Nodes (12): SpanVerdict, CouncilResult, armB, inPath, leak, outPath, redactRow(), rows (+4 more)

### Community 103 - "mine-transcripts.ts"
Cohesion: 0.16
Nodes (12): all, bands, collect(), Mined, mostlyCode(), outPath, perBand, picked (+4 more)

### Community 104 - "Console.stories.tsx"
Cohesion: 0.07
Nodes (29): RosterTone, ProjectStripProps, Default, NoProjects, OneProject, Story, TABS, ProjectTab() (+21 more)

### Community 105 - "claudeTranscript.ts"
Cohesion: 0.10
Nodes (40): resultContext, commandPrompt(), firstText(), isHarnessMeta(), localCommandCall(), localCommandOutput(), spoken(), tag() (+32 more)

### Community 107 - "containment.ts"
Cohesion: 0.48
Nodes (6): checkAll(), checkSpan(), matchedPrefixWords(), normalise(), Transform, TRANSFORMS

### Community 108 - "discover.ts"
Cohesion: 0.12
Nodes (16): createWorkItemPoller(), item, provider(), pump(), ADR-0018, ADR-0018, WorkItemPoller, WorkItemPollerOptions (+8 more)

### Community 109 - "speaker.ts"
Cohesion: 0.53
Nodes (5): absentSpeaker(), realtimeSpeaker(), Speaker, speakerFromEnv(), timeoutFor()

### Community 110 - "CommitGroup.stories.tsx"
Cohesion: 0.18
Nodes (9): FILES, Folded, LongRun, Opened, reads, searched, SingleCall, Story (+1 more)

### Community 111 - "deviceFlow.ts"
Cohesion: 0.24
Nodes (16): awaitToken(), DeviceCode, DeviceFlowOptions, field(), parseDeviceCode(), post(), readNumber(), readString() (+8 more)

### Community 113 - "IconButton.stories.tsx"
Cohesion: 0.11
Nodes (10): Default, Story, ArrowLineDownIcon, ArrowsClockwiseIcon, GitBranchIcon, PencilSimpleIcon, PlusIcon, TrashIcon (+2 more)

### Community 116 - "Prose.tsx"
Cohesion: 0.08
Nodes (24): linkifyBareUrls(), nodeOf(), hrefs(), TextPiece, textPieces(), trimTrailing(), browsableHref(), ELEMENTS (+16 more)

### Community 117 - "TurnFeed.stories.tsx"
Cohesion: 0.11
Nodes (16): COMMAND, CompactedBefore, Empty, Exchange, FAILED_CALL, FoldsBrokenByEachLoudKind, MESSAGE, MUTATION (+8 more)

### Community 118 - "Cli"
Cohesion: 0.42
Nodes (8): containsPath(), projectForCwd(), projectName(), projectView, SEPARATORS, project(), trimSeparator(), ADR-0015

### Community 119 - "issues.ts"
Cohesion: 0.38
Nodes (10): isRecord(), issueStatus(), parseIssue(), readChildCount(), readLabels(), readLogin(), readTimestamp(), readTypeName() (+2 more)

### Community 123 - "MutationRow.stories.tsx"
Cohesion: 0.14
Nodes (16): AtTheBound, CompletedWithoutAPatch, Created, Deleted, Failed, FailedWithAReason, Modified, NoDiffAvailable (+8 more)

### Community 124 - "gitHubPort.ts"
Cohesion: 0.28
Nodes (13): byNumber(), fakeGitHub, FakeIssue, FakeRepository, respond(), route(), toPayload(), gitHubPort() (+5 more)

### Community 127 - "dependencies"
Cohesion: 0.06
Nodes (33): dependencies, class-variance-authority, clsx, date-fns, @electron-toolkit/preload, @electron-toolkit/utils, node-pty, @phosphor-icons/react (+25 more)

### Community 128 - "useConnectPanel.ts"
Cohesion: 0.27
Nodes (12): chooseCli(), chooseFolder(), commit(), connectActs(), ConnectSession, runRow(), signIn(), ConnectPanel (+4 more)

### Community 129 - "dock.ts"
Cohesion: 0.24
Nodes (11): buildDock(), describe(), DockKind, IDLE_NOW, nowHead(), root(), toolCallsOf(), planProgress() (+3 more)

### Community 130 - "toolResult.ts"
Cohesion: 0.16
Nodes (26): callResult(), diskFallbackPath(), resolveResult(), embedded(), extensionOf(), fromContentPart(), fromDisk(), fromToolUseResult() (+18 more)

### Community 131 - "stateMap.ts"
Cohesion: 0.25
Nodes (12): bucketFor(), collapse(), NAME_RULES, normalize(), ProviderState, seedBucket(), seedStateMap(), StateCategory (+4 more)

### Community 133 - "WelcomeScreen.tsx"
Cohesion: 0.10
Nodes (17): LifecycleNodeStatePresentation, FEED_GLYPHS, InTheColumn, Mark, Story, BinocularsIcon, IconAtom, FileMinusIcon (+9 more)

### Community 134 - "DeliveryLifecycle.tsx"
Cohesion: 0.09
Nodes (29): DeliveryLifecycle(), TERMINAL_PRESENTATION, LifecycleNode(), NODE_LABEL, PrAnchor(), Default, Story, cn() (+21 more)

### Community 135 - "realSession.ts"
Cohesion: 0.26
Nodes (12): agentOf(), callOf(), DIFF_SIDES, oneOf(), proseOf(), RawAgent, RawCall, RawFixture (+4 more)

### Community 137 - "DiffLines.tsx"
Cohesion: 0.11
Nodes (20): CodeToken, highlighter, highlightLines(), LANGUAGE_BY_EXTENSION, languageOf(), DiffLines(), Line(), lineNumbers() (+12 more)

### Community 138 - "projection.ts"
Cohesion: 0.29
Nodes (10): emptyState(), argo, created(), registered(), replay(), session(), shop, applyEvent() (+2 more)

### Community 152 - "NowHead.tsx"
Cohesion: 0.28
Nodes (7): headline(), NowHead(), AtRest, NothingYet, Story, Working, NowHeadModel

### Community 153 - "TerminalPane.tsx"
Cohesion: 0.39
Nodes (6): openTerminal(), resolveColor(), OnGlassPanel, Story, TerminalPane(), terminalTheme()

### Community 154 - "package.json"
Cohesion: 0.29
Nodes (6): description, main, name, private, type, version

### Community 155 - "ContextRing.tsx"
Cohesion: 0.14
Nodes (13): CompactionMarker(), Marker, Story, clampPercentage(), ContextRing(), Estimated, Story, Unknown (+5 more)

### Community 158 - "watch.test.ts"
Cohesion: 0.27
Nodes (8): NO_WATCHER, armed(), settle(), sleep(), ADR-0008, ADR-0008, Watcher, watchTranscripts()

### Community 159 - "ArchivedFooter.stories.tsx"
Cohesion: 0.40
Nodes (4): ArchivedFooter(), Closed, Open, Story

### Community 160 - "NewSessionRow.stories.tsx"
Cohesion: 0.40
Nodes (4): NewSessionRow(), Default, Refused, Story

## Knowledge Gaps
- **956 isolated node(s):** `*.css`, `projectRoot`, `config`, `project`, `$schema` (+951 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `turn()` connect `ContextGauge.tsx` to `Chromatic Storybook`, `dock.ts`, `Vite React Plugin`?**
  _High betweenness centrality (0.152) - this node is a cross-community bridge._
- **Why does `model()` connect `React Types` to `useConnectPanel.ts`, `Chromatic Storybook`, `Text.tsx`, `FileDiff.stories.tsx`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Why does `buildActivity()` connect `Chromatic Storybook` to `dock.ts`, `SectionHeader.tsx`, `ContextGauge.tsx`, `Storybook Docs Addon`, `React Types`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **What connects `*.css`, `projectRoot`, `config` to the rest of the system?**
  _956 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Biome Config` be split into smaller, more focused modules?**
  _Cohesion score 0.1339031339031339 - nodes in this community are weakly interconnected._
- **Should `Root Package Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
- **Should `Turbo Build Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.06653225806451613 - nodes in this community are weakly interconnected._