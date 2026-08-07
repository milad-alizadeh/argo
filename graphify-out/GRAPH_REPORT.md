# Graph Report - argo  (2026-08-07)

## Corpus Check
- 626 files · ~354,945 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3485 nodes · 7852 edges · 179 communities (152 shown, 27 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 106 edges (avg confidence: 0.74)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `21665d64`
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
- TopBar.stories.tsx
- ToolCallKind
- @types/react
- MutationRow.stories.tsx
- gitHubPort.ts
- TranscriptEvent
- SessionRosterProjection
- dependencies
- useConnectPanel.ts
- dock.ts
- toolResult.ts
- stateMap.ts
- report.ts
- WelcomeScreen.tsx
- DeliveryLifecycle.tsx
- realSession.ts
- .callEvents
- DiffLines.tsx
- projection.ts
- transcriptLines
- .evidence
- View
- proseSubset.ts
- Identifiable
- HubSession
- DeckZone
- ArgoTypeface
- QuietRow.tsx
- Hub
- TranscriptObservation
- ArgoApp
- RowGlyph.stories.tsx
- NowHead.tsx
- TerminalPane.tsx
- package.json
- ContextRing.tsx
- Specimen
- Head
- watch.test.ts
- ArchivedFooter.stories.tsx
- NewSessionRow.stories.tsx
- .promptEvents
- ArgoElevation
- ArgoTheme
- describe
- HubProject
- PlanRow.stories.tsx
- HubConnection
- ContractSpecimen
- ArgoGeometry.swift
- CompactionMarker.tsx
- Tier
- TranscriptObservationError
- @types/mdast
- unified
- @vitest/browser-playwright
- .events
- GitVessel
- TreeBuilder

## God Nodes (most connected - your core abstractions)
1. `cn()` - 105 edges
2. `Text()` - 92 edges
3. `createIcon()` - 50 edges
4. `JSONValue` - 42 edges
5. `SwiftUI` - 31 edges
6. `asString()` - 30 edges
7. `isRecord()` - 29 edges
8. `parseTranscript()` - 28 edges
9. `Foundation` - 28 edges
10. `ArgoColor` - 28 edges

## Surprising Connections (you probably didn't know these)
- `collect()` --indirect_call--> `file()`  [INFERRED]
  prototypes/return-path-eval/mine-transcripts.ts → apps/desktop/src/main/observe/__fixtures__/logical.ts
- `main()` --indirect_call--> `model()`  [INFERRED]
  prototypes/marker-drop-rate/sweep.ts → apps/desktop/src/renderer/src/cockpit/connect/useConnectPanel.ts
- `firstInChain()` --indirect_call--> `file()`  [INFERRED]
  apps/desktop/src/main/observe/resumeChain.ts → apps/desktop/src/main/observe/__fixtures__/logical.ts
- `stitch()` --indirect_call--> `file()`  [INFERRED]
  apps/desktop/src/main/observe/resumeChain.ts → apps/desktop/src/main/observe/__fixtures__/logical.ts
- `literaliseWhatDisablingCannot()` --indirect_call--> `file()`  [INFERRED]
  apps/desktop/src/renderer/src/rooms/sessions/components/proseSubset.ts → apps/desktop/src/main/observe/__fixtures__/logical.ts

## Import Cycles
- None detected.

## Communities (179 total, 27 thin omitted)

### Community 0 - "Biome Config"
Cohesion: 0.13
Nodes (20): ADR-0007, AxisResult, convene(), judgeOnce(), AXES, Axis, AxisId, judgePrompt() (+12 more)

### Community 1 - "Root Package Manifest"
Cohesion: 0.04
Nodes (46): @biomejs/biome, husky, jscpd, lint-staged, bin, argo, devDependencies, @biomejs/biome (+38 more)

### Community 2 - "Turbo Build Pipeline"
Cohesion: 0.07
Nodes (31): ^build, dist/**, OPENAI_API_KEY, out/**, REALTIME_MODEL, storybook-static/**, dependsOn, outputs (+23 more)

### Community 3 - "Desktop App Package"
Cohesion: 0.14
Nodes (14): scripts, boundaries, build, build-storybook, dev, package, start, storybook (+6 more)

### Community 4 - "Session Row & Button"
Cohesion: 0.14
Nodes (19): RailActionRow(), Default, Story, AccentCard(), AccentCardHeader(), AccentCardTone, accentCardVariants, Blocking (+11 more)

### Community 5 - "Runtime Dependencies"
Cohesion: 0.10
Nodes (24): ArrowCounterClockwiseIcon, ArrowRightIcon, ArrowsLeftRightIcon, ArrowsMergeIcon, BugIcon, CaretLeftIcon, CaretUpIcon, CheckCircleIcon (+16 more)

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
Nodes (21): DiffFinding, findingBodyStub(), FindingCard(), severityAccent(), Addressing, Advisory, Default, Fixed (+13 more)

### Community 14 - "App Rail Shell"
Cohesion: 0.18
Nodes (13): AllIcons, Default, Story, HOT_HEAD_STATES, isHotHeadState(), ROSTER_ICONS, RosterWord, PR (+5 more)

### Community 16 - "Playwright"
Cohesion: 0.11
Nodes (21): ContextMenu(), ContextMenuContent(), ContextMenuItem(), ContextMenuTrigger(), Default, Story, Default, Story (+13 more)

### Community 17 - "Rail E2E Spec"
Cohesion: 0.22
Nodes (8): CI_RUN_STATUSES, Default, EveryRunStatus, EveryStatus, Failed, NoRunsYet, RUNS, Story

### Community 18 - "Playwright Test"
Cohesion: 0.10
Nodes (29): ContentBlock, image, thinking, toolResult, toolUse, unreadable, ImageBlock, imageMediaType() (+21 more)

### Community 19 - "Dependency Cruiser"
Cohesion: 0.09
Nodes (27): ARCHIVED, ArchivedOpen, POPULATED, PR, Selected, Story, Zero, SessionRow() (+19 more)

### Community 20 - "Vitest Browser Playwright"
Cohesion: 0.05
Nodes (49): NothingObserved, RealSession, Story, Surface, WideFanout, Docked, Expanded, NoPtyToSteer (+41 more)

### Community 22 - "Storybook A11y Addon"
Cohesion: 0.11
Nodes (30): DiffEvidence, DiffHunk, DiffLine, DiffLineSide, add, context, del, FileChange (+22 more)

### Community 23 - "Storybook Docs Addon"
Cohesion: 0.12
Nodes (31): withoutPhases(), CONTEXT_USED, OPEN_TURN, FEEDS, LensTurn, lensTurns(), turnOf(), LENS_SPEC (+23 more)

### Community 24 - "Chromatic Storybook"
Cohesion: 0.08
Nodes (41): ActivityPane(), ActivityItem, ActivityModel, buildActivity(), DelegateItem, ownItem(), rowsOf(), sessionChapters() (+33 more)

### Community 25 - "Electron Vite"
Cohesion: 0.10
Nodes (25): AllFilesDiff(), AllFilesDiffFile, Default, Empty, FILES, Story, CommitGroupFile, CONTENT_LABEL (+17 more)

### Community 28 - "Tailwind Vite Plugin"
Cohesion: 0.17
Nodes (8): GitHubWorkItemsOptions, createGitHubClient(), GitHubClientOptions, GitHubRefusal, Page, refusalReason(), ADR-0018, Http

### Community 29 - "TW Animate CSS"
Cohesion: 0.10
Nodes (12): View, DeckSeparator, ProjectStrip, CockpitPresentation, SessionNavigator, CockpitPresentation, ShellSidebar, CockpitPresentation (+4 more)

### Community 30 - "Node Types"
Cohesion: 0.10
Nodes (21): AsyncStream, TranscriptEvent, URL, transcriptEvents(), OpenCall, String, TranscriptEvent, TranscriptReader (+13 more)

### Community 31 - "React Types"
Cohesion: 0.10
Nodes (27): Chunk, ChunkType, CORPUS, checkLine(), CLASS_OF, ExpectedMarker, extractExpected(), extractiveFallback() (+19 more)

### Community 34 - "Vite"
Cohesion: 0.31
Nodes (4): ShellCommands, useShellKeymap(), shellCommand, WITH_META

### Community 35 - "Vite React Plugin"
Cohesion: 0.05
Nodes (79): resultOf(), Delegation, CallRole, Effect, ROLE, roleOf(), Yield, yieldOf() (+71 more)

### Community 36 - "Vitest"
Cohesion: 0.38
Nodes (5): BlockerState, PARENT_TYPE_WORDS, WorkItemBlocker, workItemKind, WorkItemStatus

### Community 39 - "Session State Hub"
Cohesion: 0.07
Nodes (49): BRANCH_REF_ARGS, commitsIn(), mirroredDrift(), parseBranchRefs(), parseTrack(), RawRef, readBranchRefs(), named() (+41 more)

### Community 40 - "Electron"
Cohesion: 0.15
Nodes (21): emptyTranscript(), file(), logicalOf(), running(), turn(), GradeStatus, resolveTitle(), toAgents() (+13 more)

### Community 48 - "sessionFacts.ts"
Cohesion: 0.11
Nodes (37): discoverWorkingSet(), mtimeOf(), readDirectoryNames(), selectWorkingSet(), NOW, TranscriptFile, ADR-0008, readImageFile() (+29 more)

### Community 49 - "index.ts"
Cohesion: 0.09
Nodes (21): CiFailingHead, CiRunning, CommitsGate, CommitsGateNotHead, CommitsNow, CommitsSync, CommitsWithCheckOutput, MergeAuto (+13 more)

### Community 50 - "Text.tsx"
Cohesion: 0.15
Nodes (16): App(), ADR-0005, ADR-0015, useConnectPanel(), GitGroup, useGitFacts(), GitHatches, useGitGroup() (+8 more)

### Community 51 - "PaneSplitter.stories.tsx"
Cohesion: 0.16
Nodes (28): CAPABILITIES, GITHUB_STATES, join(), readBacklog(), readIssue(), ADR-0014, ADR-0018, readBlockers() (+20 more)

### Community 52 - "icons.stories.tsx"
Cohesion: 0.11
Nodes (18): ConciergeCaption(), Default, Silent, Story, ConciergeStrip(), Default, Story, ConnectionChip() (+10 more)

### Community 53 - "badge.stories.tsx"
Cohesion: 0.17
Nodes (15): DeliveryTabs(), isChangesView(), isDeliveryTab(), AllTones, ChangesTone, Default, GlowSeat, Story (+7 more)

### Community 54 - "button.stories.tsx"
Cohesion: 0.04
Nodes (61): DropdownMenu(), DropdownMenuContent(), DropdownMenuGroup(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuSeparator(), DropdownMenuTrigger(), Default (+53 more)

### Community 55 - "ContextGauge.tsx"
Cohesion: 0.14
Nodes (19): deriveSessionStatus(), HALTING_REASONS, hasPendingAsk(), isRecent(), quietStatus(), statusOf(), StatusSignals, agentsOf() (+11 more)

### Community 56 - "SectionHeader.tsx"
Cohesion: 0.12
Nodes (14): PR, rails, REVIEWING, ASKING, BROKEN, Candidate, DeliveryClaim, LANDED (+6 more)

### Community 58 - "PanelSplitter.stories.tsx"
Cohesion: 0.20
Nodes (11): clampPanelSize(), keyStepDelta(), PANEL_ORIENTATIONS, PanelOrientation, PanelSplitter(), PanelSplitterProps, AllOrientations, Default (+3 more)

### Community 59 - "WorkspaceIdentity.tsx"
Cohesion: 0.08
Nodes (29): Adopted, AgentPty, AgentTerminals, AttachedTerminal, createAgentTerminals(), attachDock(), claimFor(), cols() (+21 more)

### Community 60 - "Text.tsx"
Cohesion: 0.17
Nodes (13): ArgoColor, Double, ArgoPalette, EdgeRoles, InteractionRoles, StateRoles, SurfaceRoles, TextRoles (+5 more)

### Community 61 - "icons.stories.tsx"
Cohesion: 0.17
Nodes (12): AllGlyphs, boxOf(), Decorative, Default, glyph(), GLYPHS, InlineWithText, Labelled (+4 more)

### Community 62 - "drawerControls.tsx"
Cohesion: 0.13
Nodes (14): cache, outputs, extends, $schema, cache, outputs, persistent, tasks (+6 more)

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
Cohesion: 0.10
Nodes (24): ARMS, Arm, armB(), EvalChunk, loadCorpus(), absentSpeaker(), realtimeSpeaker(), sessionInstructions() (+16 more)

### Community 67 - "LifecycleNode.stories.tsx"
Cohesion: 0.22
Nodes (8): Default, EveryNode, EveryState, HeadPulsing, NotClickable, Open, Story, WithSub

### Community 68 - "badge.stories.tsx"
Cohesion: 0.14
Nodes (20): deliveryState, RailState, RailStatus, SessionWord, ATTENTION_CLAIMS, claimsOf(), deliveryClaimWord(), LANDED (+12 more)

### Community 69 - "BackgroundTasks.stories.tsx"
Cohesion: 0.09
Nodes (20): Claim, ClaimId, createManagedSessions(), ManagedSessions, BEFORE, DURING, ADR-0013, Observer (+12 more)

### Community 70 - "ContextGauge.tsx"
Cohesion: 0.15
Nodes (24): model(), Cap, CAPS, systemPrompt(), userPrompt(), namedRetryNote(), availableLocalKeys(), ModelId (+16 more)

### Community 71 - "SectionHeader.tsx"
Cohesion: 0.13
Nodes (33): SessionInterior, useSessionInterior(), useTerminalAttach(), useWallClock(), SessionsRoomSpawn, ADR-0015, Dock(), KIND_LABEL (+25 more)

### Community 72 - "toggle-group.tsx"
Cohesion: 0.08
Nodes (29): ADR-0005, wireProjection(), createHub(), Hub, ProjectionListener, ADR-0005, ADR-0005, ADR-0005 (+21 more)

### Community 73 - "checkbox.stories.tsx"
Cohesion: 0.10
Nodes (31): ChapterBlock(), DensityGutter(), pct(), Tick(), activeOf(), anchorsOf(), jumpFeedTo(), stepFeed() (+23 more)

### Community 74 - "electron-vite"
Cohesion: 0.11
Nodes (15): LIFECYCLE_NODE_STATE, LifecycleNodeStatePresentation, ArrowClockwiseIcon, ArrowLineUpIcon, CheckIcon, CircleIcon, CircleNotchIcon, IconAtom (+7 more)

### Community 75 - "happy-dom"
Cohesion: 0.22
Nodes (8): description, name, private, scripts, build, lint, screenshot, test

### Community 76 - "react"
Cohesion: 0.16
Nodes (23): CheckOutputProps, ciBody(), commitsBody(), commitsStageBody(), DelegatedRow(), GateAction(), GrowRow(), NodeDrawer() (+15 more)

### Community 77 - "react-dom"
Cohesion: 0.10
Nodes (21): ConnectPanel, CockpitScreenProps, CockpitScreenView(), CONNECTED, Default, FACTS, GrantRefused, NotAGitRepository (+13 more)

### Community 78 - "projection.ts"
Cohesion: 0.09
Nodes (20): buildWorld(), here, parseTranscript(), linesOf(), delegateDirectory(), owningTranscript(), readDelegateTurns(), PROMPT (+12 more)

### Community 79 - "sessionStore.ts"
Cohesion: 0.15
Nodes (11): AllTones, Default, EveryState, Hollow, Labelled, Pulsing, Quiet, RAIL_STATES (+3 more)

### Community 80 - "sessionFacts.ts"
Cohesion: 0.13
Nodes (20): projectFolder(), connect(), wireWorkItems(), WorkItemsBridgeOptions, createGitHubWorkItems(), githubClientId(), HttpResponse, nodeHttp() (+12 more)

### Community 81 - "terminalBridge.ts"
Cohesion: 0.16
Nodes (27): restoreProjects(), registryFile(), twoProjects(), activate(), chooseCli(), chooseFolder(), create(), ADR-0017 (+19 more)

### Community 82 - "channels.ts"
Cohesion: 0.09
Nodes (13): cockpit, Window, ADR-0005, CockpitBridge, DeviceCodePrompt, TerminalAttachRequest, TerminalSession, TerminalSize (+5 more)

### Community 83 - "Roster.stories.tsx"
Cohesion: 0.14
Nodes (19): Int, Usage, Access, managed, readOnly, Checkout, branch, detached (+11 more)

### Community 84 - "SessionRow.tsx"
Cohesion: 0.09
Nodes (18): SessionStateIndicator, ConnectionChip, Bool, CockpitPresentation, String, Void, SpecimenStateDot, SpecimenStatusChip (+10 more)

### Community 85 - "deliveryState"
Cohesion: 0.12
Nodes (31): GRANT_STATES, GrantState, ADR-0014, ADR-0018, activateProject(), addProject(), addSession(), attribute() (+23 more)

### Community 86 - "deliveryState"
Cohesion: 0.10
Nodes (28): ciState(), commitsState(), LIFECYCLE_KEYS, lifecycleModel, LifecycleNodeKey, LifecycleNodes, LifecycleNodeState, mergeState() (+20 more)

### Community 87 - "PrChecksList.tsx"
Cohesion: 0.11
Nodes (20): CHECK_LABEL, CheckOutput(), LOCAL_CHECKS, LocalCheck, Default, EveryCheck, MultilineFeed, Story (+12 more)

### Community 88 - "FileDiff.stories.tsx"
Cohesion: 0.12
Nodes (24): AllStates, Connecting, FolderOnly, Fresh, Refused, Settings, Story, buildConnectPanelModel() (+16 more)

### Community 89 - "FindingCard.tsx"
Cohesion: 0.11
Nodes (20): CommitGroup(), Default, FILES, Story, Uncommitted, FileDiff(), kindGlyph(), AllKinds (+12 more)

### Community 90 - "lifecycleNodeState.ts"
Cohesion: 0.29
Nodes (5): Default, NeutralWord, propsOf(), Pulsing, Story

### Community 91 - "PrChecksList.stories.tsx"
Cohesion: 0.14
Nodes (15): ParseOptions, embedded(), extensionOf(), fromContentPart(), fromDisk(), fromToolUseResult(), ImageReader, imageType() (+7 more)

### Community 92 - "NowLine.stories.tsx"
Cohesion: 0.09
Nodes (25): SessionMeta(), SessionTabs(), Story, TwoTabs, TAB_LABELS, branchSegment(), buildInteriorHeader(), IntentChip (+17 more)

### Community 93 - "SessionRow.stories.tsx"
Cohesion: 0.09
Nodes (22): Default, Story, ToggleGroup(), ToggleGroupItem(), AgentPicker(), CLI_LABELS, Default, Reselected (+14 more)

### Community 94 - "branchMenuModel.ts"
Cohesion: 0.24
Nodes (5): Engine, URL, CheckoutReader, String, URL

### Community 95 - "MutationRow.tsx"
Cohesion: 0.04
Nodes (63): CallOutput(), LOG, LongLog, Printed, Story, callMark(), CallRow(), FAILED (+55 more)

### Community 96 - "@electron-toolkit/tsconfig"
Cohesion: 0.12
Nodes (14): armKeys, contested, failed, judged, ok, parseProblems, path, pct() (+6 more)

### Community 99 - "CallRow.tsx"
Cohesion: 0.10
Nodes (16): CockpitActions, Void, CockpitRoom, code, sessions, work, Self, CockpitView (+8 more)

### Community 100 - "arms.ts"
Cohesion: 0.31
Nodes (9): ArmSpec, RouterOutput, runRouter(), ChunkType, parseRouterReply(), ReducedPayload, renderForSpeaker(), routerUserPrompt() (+1 more)

### Community 101 - "useShellState.ts"
Cohesion: 0.33
Nodes (11): currentSessionId(), ShellState, useShellState(), CockpitHandlers, DEFAULT_PROJECT_UI, nextProjectId(), ProjectUi, ProjectUiMemory (+3 more)

### Community 102 - "trial.ts"
Cohesion: 0.12
Nodes (21): ArmId, checkAll(), checkSpan(), matchedPrefixWords(), normalise(), SpanVerdict, Transform, TRANSFORMS (+13 more)

### Community 103 - "mine-transcripts.ts"
Cohesion: 0.16
Nodes (12): all, bands, collect(), Mined, mostlyCode(), outPath, perBand, picked (+4 more)

### Community 104 - "Console.stories.tsx"
Cohesion: 0.14
Nodes (10): ProjectStrip(), Default, NoProjects, OneProject, Story, TABS, RANKED, worstStateDot() (+2 more)

### Community 105 - "claudeTranscript.ts"
Cohesion: 0.10
Nodes (54): callResult(), diskFallbackPath(), resolveResult(), resultContext, absorb(), absorbFirstPrompt(), absorbMessage(), coercePromptText() (+46 more)

### Community 107 - "containment.ts"
Cohesion: 0.13
Nodes (8): String, [TranscriptEvent], prompts(), String, ArgoEngine, CoreGraphics, Foundation, Testing

### Community 108 - "discover.ts"
Cohesion: 0.13
Nodes (13): createWorkItemPoller(), item, provider(), pump(), ADR-0018, ADR-0018, WorkItemPoller, WorkItemPollerOptions (+5 more)

### Community 109 - "speaker.ts"
Cohesion: 0.14
Nodes (16): Animation, ArgoAnimationModifier, ArgoMotion, Curve, easeInOut, easeOut, spring, Bool (+8 more)

### Community 110 - "CommitGroup.stories.tsx"
Cohesion: 0.18
Nodes (9): FILES, Folded, LongRun, Opened, reads, searched, SingleCall, Story (+1 more)

### Community 111 - "deviceFlow.ts"
Cohesion: 0.24
Nodes (15): awaitToken(), DeviceCode, DeviceFlowOptions, field(), parseDeviceCode(), post(), readNumber(), readString() (+7 more)

### Community 113 - "IconButton.stories.tsx"
Cohesion: 0.13
Nodes (8): Default, Story, ArrowLineDownIcon, ArrowsClockwiseIcon, GitBranchIcon, PlusIcon, TrashIcon, OPERATIONS

### Community 116 - "Prose.tsx"
Cohesion: 0.06
Nodes (32): TypeRole, browsableHref(), ELEMENTS, Prose(), ProseLink(), SAFE_SCHEMES, ExcludedSyntax, FencedBlock (+24 more)

### Community 117 - "TurnFeed.stories.tsx"
Cohesion: 0.11
Nodes (16): COMMAND, CompactedBefore, Empty, Exchange, FAILED_CALL, FoldsBrokenByEachLoudKind, MESSAGE, MUTATION (+8 more)

### Community 118 - "Cli"
Cohesion: 0.42
Nodes (8): containsPath(), projectForCwd(), projectName(), projectView, SEPARATORS, project(), trimSeparator(), ADR-0015

### Community 119 - "issues.ts"
Cohesion: 0.14
Nodes (17): Closable, Embedded, Failed, FileGone, FromDisk, row(), SamePathThrice, STAGES (+9 more)

### Community 120 - "TopBar.stories.tsx"
Cohesion: 0.12
Nodes (15): RoomScene(), Lit, Story, ROOM_ENTRIES, RoomSwitcher(), Default, EveryRoom, Story (+7 more)

### Community 121 - "ToolCallKind"
Cohesion: 0.12
Nodes (19): Int, ToolResult, Usage, ToolCall, ToolCallKind, delegate, edit, execute (+11 more)

### Community 123 - "MutationRow.stories.tsx"
Cohesion: 0.15
Nodes (15): AtTheBound, CompletedWithoutAPatch, Created, Deleted, Failed, FailedWithAReason, Modified, NoDiffAvailable (+7 more)

### Community 124 - "gitHubPort.ts"
Cohesion: 0.30
Nodes (12): byNumber(), fakeGitHub, FakeIssue, FakeRepository, respond(), route(), toPayload(), gitHubPort() (+4 more)

### Community 125 - "TranscriptEvent"
Cohesion: 0.10
Nodes (19): Int, String, TranscriptEvent, branch, compaction, cwd, headLeaf, message (+11 more)

### Community 126 - "SessionRosterProjection"
Cohesion: 0.16
Nodes (11): AppKit, Row, SessionRosterProjection, Bool, CockpitPresentation, Int, String, SessionRow (+3 more)

### Community 127 - "dependencies"
Cohesion: 0.06
Nodes (33): dependencies, class-variance-authority, clsx, date-fns, @electron-toolkit/preload, @electron-toolkit/utils, node-pty, @phosphor-icons/react (+25 more)

### Community 128 - "useConnectPanel.ts"
Cohesion: 0.33
Nodes (10): chooseCli(), chooseFolder(), commit(), connectActs(), ConnectSession, runRow(), signIn(), Opened (+2 more)

### Community 129 - "dock.ts"
Cohesion: 0.10
Nodes (22): headline(), NowHead(), AtRest, NothingYet, Story, Working, Plan, Story (+14 more)

### Community 130 - "toolResult.ts"
Cohesion: 0.24
Nodes (11): countSide(), declaredChange(), diffLine(), diffResultFrom(), fileChange(), FileSnapshot, hunkFrom(), SIDE_BY_MARKER (+3 more)

### Community 131 - "stateMap.ts"
Cohesion: 0.22
Nodes (14): WorkItemCapabilities, bucketFor(), collapse(), NAME_RULES, normalize(), ProviderState, seedBucket(), seedStateMap() (+6 more)

### Community 132 - "report.ts"
Cohesion: 0.16
Nodes (15): capLabel(), byClass(), byToken(), capKey(), corpus, errs, lengthTable(), ok (+7 more)

### Community 133 - "WelcomeScreen.tsx"
Cohesion: 0.19
Nodes (9): BinocularsIcon, BenefitRow(), Default, Story, BENEFITS, Default, Story, ADR-0015 (+1 more)

### Community 134 - "DeliveryLifecycle.tsx"
Cohesion: 0.07
Nodes (41): DeliveryLifecycle(), TERMINAL_PRESENTATION, LifecycleNode(), NODE_LABEL, PrAnchor(), Default, Story, AGGREGATE_TONE (+33 more)

### Community 135 - "realSession.ts"
Cohesion: 0.22
Nodes (13): agentOf(), callOf(), DIFF_SIDES, oneOf(), proseOf(), RawAgent, RawCall, RawFixture (+5 more)

### Community 136 - ".callEvents"
Cohesion: 0.19
Nodes (12): Plan, PlanEntry, PlanEntryStatus, completed, inProgress, pending, plan(), planEntryStatus() (+4 more)

### Community 137 - "DiffLines.tsx"
Cohesion: 0.11
Nodes (20): CodeToken, highlighter, highlightLines(), LANGUAGE_BY_EXTENSION, languageOf(), DiffLines(), Line(), lineNumbers() (+12 more)

### Community 138 - "projection.ts"
Cohesion: 0.26
Nodes (14): created(), intake(), projected(), SessionIntake, sessionView, argo, created(), registered() (+6 more)

### Community 139 - "transcriptLines"
Cohesion: 0.21
Nodes (8): FileCursor, FileWatcher, AsyncStream, String, URL, Void, transcriptLines(), DispatchSourceFileSystemObject

### Community 140 - ".evidence"
Cohesion: 0.22
Nodes (12): MediaEvidence, fromContent(), fromDisk(), fromToolUseResult(), mediaEvidence(), MediaRead, String, outputEvidence() (+4 more)

### Community 141 - "View"
Cohesion: 0.20
Nodes (10): DeckContentRow, SessionsDeck, FoundationSpecimen, ToolbarContent, SpecimenDeck, SpecimenDeckTabs, SpecimenFeedEntry, SpecimenFixtures (+2 more)

### Community 142 - "proseSubset.ts"
Cohesion: 0.21
Nodes (11): linkifyBareUrls(), nodeOf(), hrefs(), TextPiece, textPieces(), trimTrailing(), FORGOTTEN, isClosed() (+3 more)

### Community 143 - "Identifiable"
Cohesion: 0.21
Nodes (14): DeckTab, activity, delivery, FeedEntry, Room, code, sessions, work (+6 more)

### Community 144 - "HubSession"
Cohesion: 0.26
Nodes (7): HubSession, String, TranscriptEvent, URL, HubSessionChain, HubTranscript, String

### Community 145 - "DeckZone"
Cohesion: 0.15
Nodes (11): DeckSlot, DeckZone, dock, feed, header, minimap, rail, tabs (+3 more)

### Community 146 - "ArgoTypeface"
Cohesion: 0.24
Nodes (10): ArgoTextStyle, ArgoTypeface, identity, interface, machine, ArgoTypography, CGFloat, String (+2 more)

### Community 147 - "QuietRow.tsx"
Cohesion: 0.21
Nodes (8): countLabel(), foldLine(), GLYPH_FOR, QUIET_NOUN, QuietCall(), sentenceCase(), FileTextIcon, MagnifyingGlassIcon

### Community 148 - "Hub"
Cohesion: 0.33
Nodes (6): Hub, RecordOwner, Int, String, TranscriptEvent, Observation

### Community 149 - "TranscriptObservation"
Cohesion: 0.27
Nodes (9): AsyncStream, String, TranscriptEvent, URL, TranscriptObservation, hubFixtureObservation(), hubTestObservation(), String (+1 more)

### Community 150 - "ArgoApp"
Cohesion: 0.25
Nodes (8): App, ArgoApp, CockpitPresentation, LaunchConfiguration, String, URL, Hub, Scene

### Community 151 - "RowGlyph.stories.tsx"
Cohesion: 0.18
Nodes (7): FEED_GLYPHS, InTheColumn, Mark, Story, FileMinusIcon, TerminalWindowIcon, WarningIcon

### Community 152 - "NowHead.tsx"
Cohesion: 0.25
Nodes (7): firstLines(), ScratchFile, Int, String, URL, Duration, FileHandle

### Community 153 - "TerminalPane.tsx"
Cohesion: 0.39
Nodes (6): openTerminal(), resolveColor(), OnGlassPanel, Story, TerminalPane(), terminalTheme()

### Community 154 - "package.json"
Cohesion: 0.29
Nodes (6): description, main, name, private, type, version

### Community 155 - "ContextRing.tsx"
Cohesion: 0.38
Nodes (5): clampPercentage(), ContextRing(), Estimated, Story, Unknown

### Community 156 - "Specimen"
Cohesion: 0.22
Nodes (9): DeckSpecimen, SessionRowsSpecimen, Specimen, contract, deck, foundations, sessionRows, sessionsDeck (+1 more)

### Community 157 - "Head"
Cohesion: 0.31
Nodes (7): CheckoutProjection, Head, branch, detached, unavailable, String, URL

### Community 158 - "watch.test.ts"
Cohesion: 0.27
Nodes (8): NO_WATCHER, armed(), settle(), sleep(), ADR-0008, ADR-0008, Watcher, watchTranscripts()

### Community 159 - "ArchivedFooter.stories.tsx"
Cohesion: 0.40
Nodes (4): ArchivedFooter(), Closed, Open, Story

### Community 160 - "NewSessionRow.stories.tsx"
Cohesion: 0.40
Nodes (4): NewSessionRow(), Default, Refused, Story

### Community 161 - ".promptEvents"
Cohesion: 0.53
Nodes (7): text, commandPrompt(), firstText(), localCommandOutput(), String, tag(), userPrompt()

### Community 162 - "ArgoElevation"
Cohesion: 0.31
Nodes (6): ArgoElevation, Bool, CGFloat, Double, String, View

### Community 163 - "ArgoTheme"
Cohesion: 0.39
Nodes (4): ArgoTheme, EnvironmentValues, ArgoPalette, View

### Community 164 - "describe"
Cohesion: 0.38
Nodes (6): describe(), oneLine(), Int, String, ToolResult, TranscriptEvent

### Community 165 - "HubProject"
Cohesion: 0.33
Nodes (4): URL, HubProject, String, URL

### Community 166 - "PlanRow.stories.tsx"
Cohesion: 0.33
Nodes (5): AllDone, ENTRIES, InProgress, NotStarted, Story

### Community 167 - "HubConnection"
Cohesion: 0.33
Nodes (5): HubConnection, failed, healthy, reconnecting, String

### Community 169 - "ArgoGeometry.swift"
Cohesion: 0.47
Nodes (5): ArgoRadius, ArgoSpacing, ArgoStroke, CGFloat, String

### Community 170 - "CompactionMarker.tsx"
Cohesion: 0.50
Nodes (3): CompactionMarker(), Marker, Story

### Community 171 - "Tier"
Cohesion: 0.40
Nodes (4): Tier, convention, derived, direct

### Community 172 - "TranscriptObservationError"
Cohesion: 0.40
Nodes (4): URL, TranscriptObservationError, unreadable, Error

### Community 176 - ".events"
Cohesion: 0.60
Nodes (3): Fixture, String, TranscriptEvent

### Community 177 - "GitVessel"
Cohesion: 0.40
Nodes (4): GitVessel, CockpitPresentation, String, Void

## Knowledge Gaps
- **1065 isolated node(s):** `*.css`, `projectRoot`, `config`, `project`, `$schema` (+1060 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `turn()` connect `Electron` to `Chromatic Storybook`, `claudeTranscript.ts`, `dock.ts`, `Vite React Plugin`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Why does `Text()` connect `DeliveryLifecycle.tsx` to `dock.ts`, `Session Row & Button`, `WelcomeScreen.tsx`, `DiffLines.tsx`, `Storybook Vitest Addon`, `App Rail Shell`, `Playwright`, `Dependency Cruiser`, `RowGlyph.stories.tsx`, `Electron Vite`, `ContextRing.tsx`, `CompactionMarker.tsx`, `Text.tsx`, `icons.stories.tsx`, `badge.stories.tsx`, `button.stories.tsx`, `PanelSplitter.stories.tsx`, `button.stories.tsx`, `SectionHeader.tsx`, `checkbox.stories.tsx`, `electron-vite`, `react`, `sessionStore.ts`, `PrChecksList.tsx`, `FindingCard.tsx`, `NowLine.stories.tsx`, `SessionRow.stories.tsx`, `MutationRow.tsx`, `IconButton.stories.tsx`, `Prose.tsx`, `TopBar.stories.tsx`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Why does `model()` connect `ContextGauge.tsx` to `useConnectPanel.ts`, `Chromatic Storybook`, `Text.tsx`, `FileDiff.stories.tsx`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **What connects `*.css`, `projectRoot`, `config` to the rest of the system?**
  _1065 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Biome Config` be split into smaller, more focused modules?**
  _Cohesion score 0.1339031339031339 - nodes in this community are weakly interconnected._
- **Should `Root Package Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._
- **Should `Turbo Build Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.06653225806451613 - nodes in this community are weakly interconnected._