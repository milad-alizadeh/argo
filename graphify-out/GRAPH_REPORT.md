# Graph Report - argo  (2026-08-07)

## Corpus Check
- 540 files · ~329,828 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2840 nodes · 6643 edges · 176 communities (130 shown, 46 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 51 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fbce6456`
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
- electron
- @electron-toolkit/tsconfig
- @types/react
- MutationRow.stories.tsx
- gitHubPort.ts
- TurnFeed.tsx
- proseSubset.ts
- dependencies
- useConnectPanel.ts
- dock.ts
- toolResult.ts
- stateMap.ts
- ToolRow.stories.tsx
- WelcomeScreen.tsx
- DeliveryLifecycle.tsx
- realSession.ts
- MediaRow.stories.tsx
- DiffLines.tsx
- projection.ts
- branchRefs.ts
- ManagedSessions
- toolCalls.ts
- runGit
- PlanRow.tsx
- ShotGallery.tsx
- model.ts
- DiffView.tsx
- bridge.ts
- index.ts
- Roster.stories.tsx
- Text.stories.tsx
- headFacts.ts
- NowHead.tsx
- TerminalPane.tsx
- package.json
- ContextRing.tsx
- DiffView.stories.tsx
- ConnectionChip.tsx
- watch.test.ts
- ArchivedFooter.stories.tsx
- NewSessionRow.stories.tsx
- class-variance-authority
- date-fns
- @electron-toolkit/preload
- @electron-toolkit/utils
- @phosphor-icons/react
- shiki
- @xterm/addon-fit
- @xterm/xterm
- zustand
- electron-vite
- @fontsource-variable/inter
- remark-parse
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
- `stitch()` --indirect_call--> `file()`  [INFERRED]
  apps/desktop/src/main/observe/resumeChain.ts → apps/desktop/src/main/observe/__fixtures__/logical.ts
- `literaliseWhatDisablingCannot()` --indirect_call--> `file()`  [INFERRED]
  apps/desktop/src/renderer/src/rooms/sessions/components/proseSubset.ts → apps/desktop/src/main/observe/__fixtures__/logical.ts

## Import Cycles
- 1-file cycle: `apps/desktop/src/renderer/src/rooms/sessions/__fixtures__/realSession.ts -> apps/desktop/src/renderer/src/rooms/sessions/__fixtures__/realSession.ts`

## Communities (176 total, 46 thin omitted)

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
Cohesion: 0.06
Nodes (55): cn(), twMerge, TYPE_ROLES, TypeRole, RowGlyph(), RowLine(), ToolRow(), AccentCard() (+47 more)

### Community 5 - "Runtime Dependencies"
Cohesion: 0.08
Nodes (28): ArrowCounterClockwiseIcon, ArrowRightIcon, ArrowsLeftRightIcon, ArrowsMergeIcon, ArrowSquareOutIcon, BugIcon, CaretDownIcon, CaretLeftIcon (+20 more)

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
Nodes (9): devDependencies, electron-builder, @storybook/addon-docs, @types/node, @vitejs/plugin-react, electron-builder, @storybook/addon-docs, @types/node (+1 more)

### Community 10 - "Root TSConfig References"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 14 - "App Rail Shell"
Cohesion: 0.21
Nodes (9): AllIcons, Default, Story, HOT_HEAD_STATES, isHotHeadState(), DeliveryClaim, DOT_GLOWS, ROSTER_ICONS (+1 more)

### Community 17 - "Rail E2E Spec"
Cohesion: 0.25
Nodes (4): buildWorld(), here, linesOf(), record()

### Community 19 - "Dependency Cruiser"
Cohesion: 0.16
Nodes (12): SessionRow(), Blocked, CiFailed, External, NeedsYou, PR, rowOf(), Running (+4 more)

### Community 20 - "Vitest Browser Playwright"
Cohesion: 0.05
Nodes (50): NothingObserved, RealSession, Story, Surface, WideFanout, Docked, Expanded, NoPtyToSteer (+42 more)

### Community 23 - "Storybook Docs Addon"
Cohesion: 0.09
Nodes (39): withoutPhases(), CONTEXT_USED, FEEDS, LensTurn, lensTurns(), turnOf(), LENS_SPEC, LENSES (+31 more)

### Community 24 - "Chromatic Storybook"
Cohesion: 0.08
Nodes (44): turn(), ActivityPane(), AgentsRail(), SubagentRow(), ActivityItem, ActivityModel, buildActivity(), DelegateItem (+36 more)

### Community 25 - "Electron Vite"
Cohesion: 0.17
Nodes (11): ALL_FILES, ArtifactsTab, ByCommit, COMMIT_GROUPS, IN_REVIEW, InReview, Merged, PR (+3 more)

### Community 30 - "Node Types"
Cohesion: 0.09
Nodes (38): CallRole, Effect, ROLE, roleOf(), Yield, yieldOf(), callRow(), CallRowModel (+30 more)

### Community 31 - "React Types"
Cohesion: 0.05
Nodes (66): model(), Cap, capLabel(), CAPS, systemPrompt(), userPrompt(), Chunk, ChunkType (+58 more)

### Community 35 - "Vite React Plugin"
Cohesion: 0.12
Nodes (35): ToolRow, FeedRow, feedRows(), planIndex(), proseRow(), rowsByProseIndex(), ADR-0020, turnFeedRows() (+27 more)

### Community 39 - "Session State Hub"
Cohesion: 0.32
Nodes (8): readBranchRefs(), isGitRepository(), readGitFacts(), attachWorktrees(), parseWorktrees(), readWorktrees(), unheld, WORKTREE_ARGS

### Community 40 - "Electron"
Cohesion: 0.18
Nodes (8): ENTRY_MARK, ENTRY_TEXT, Blocking, Landed, Story, Tones, CaretRightIcon, CheckIcon

### Community 48 - "sessionFacts.ts"
Cohesion: 0.10
Nodes (34): discoverWorkingSet(), mtimeOf(), readDirectoryNames(), selectWorkingSet(), NOW, TranscriptFile, ADR-0008, readImageFile() (+26 more)

### Community 49 - "index.ts"
Cohesion: 0.09
Nodes (21): CiFailingHead, CiRunning, CommitsGate, CommitsGateNotHead, CommitsNow, CommitsSync, CommitsWithCheckOutput, MergeAuto (+13 more)

### Community 50 - "Text.tsx"
Cohesion: 0.13
Nodes (19): App(), ADR-0005, ADR-0015, useConnectPanel(), GitGroup, useGitFacts(), GitHatches, useGitGroup() (+11 more)

### Community 51 - "PaneSplitter.stories.tsx"
Cohesion: 0.09
Nodes (31): CAPABILITIES, GITHUB_STATES, join(), readBacklog(), readIssue(), ADR-0014, ADR-0018, readBlockers() (+23 more)

### Community 52 - "icons.stories.tsx"
Cohesion: 0.08
Nodes (24): ProjectStrip(), ProjectStripProps, Default, NoProjects, OneProject, Story, TABS, ProjectTab() (+16 more)

### Community 53 - "badge.stories.tsx"
Cohesion: 0.11
Nodes (22): CHANGES_VIEWS, DELIVERY_TABS, DeliveryTabs(), isChangesView(), isDeliveryTab(), SessionTabs(), Story, TwoTabs (+14 more)

### Community 54 - "button.stories.tsx"
Cohesion: 0.07
Nodes (41): DropdownMenu(), DropdownMenuContent(), DropdownMenuGroup(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuSeparator(), DropdownMenuTrigger(), Default (+33 more)

### Community 55 - "ContextGauge.tsx"
Cohesion: 0.10
Nodes (35): emptyTranscript(), file(), logicalOf(), running(), GradeStatus, resolveTitle(), toAgents(), toObservedSession() (+27 more)

### Community 56 - "SectionHeader.tsx"
Cohesion: 0.17
Nodes (11): ASKING, BROKEN, Candidate, LANDED, MOVING, OBSERVED, RAIL_DOTS, RailState (+3 more)

### Community 58 - "PanelSplitter.stories.tsx"
Cohesion: 0.20
Nodes (11): clampPanelSize(), keyStepDelta(), PANEL_ORIENTATIONS, PanelOrientation, PanelSplitter(), PanelSplitterProps, AllOrientations, Default (+3 more)

### Community 59 - "WorkspaceIdentity.tsx"
Cohesion: 0.10
Nodes (26): Adopted, AgentPty, createAgentTerminals(), attachDock(), claimFor(), cols(), detach(), DockWindow (+18 more)

### Community 60 - "Text.tsx"
Cohesion: 0.18
Nodes (9): AllVariants, AsChild, Default, SHAPES, Story, VARIANTS, VERDICT_VARIANTS, WithIcon (+1 more)

### Community 61 - "icons.stories.tsx"
Cohesion: 0.17
Nodes (12): AllGlyphs, boxOf(), Decorative, Default, glyph(), GLYPHS, InlineWithText, Labelled (+4 more)

### Community 62 - "drawerControls.tsx"
Cohesion: 0.43
Nodes (3): RailActionRow(), Default, Story

### Community 63 - "button.stories.tsx"
Cohesion: 0.15
Nodes (11): AllVariants, AsChild, Bare, Default, Disabled, Quiet, SIZES, Story (+3 more)

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
Cohesion: 0.11
Nodes (24): created(), intake(), projected(), Claim, ClaimId, createManagedSessions(), BEFORE, DURING (+16 more)

### Community 70 - "ContextGauge.tsx"
Cohesion: 0.39
Nodes (6): PR, STATE_MATRIX_ROWS, stateMatrixInput(), StateMatrixRow, labelOf(), outcomes

### Community 71 - "SectionHeader.tsx"
Cohesion: 0.15
Nodes (30): SessionInterior, useSessionInterior(), useTerminalAttach(), useWallClock(), Dock(), KIND_LABEL, asInteriorTab(), SessionPlane() (+22 more)

### Community 72 - "toggle-group.tsx"
Cohesion: 0.15
Nodes (15): ADR-0005, wireProjection(), createHub(), Hub, ProjectionListener, ADR-0005, ADR-0005, ADR-0005 (+7 more)

### Community 73 - "checkbox.stories.tsx"
Cohesion: 0.10
Nodes (29): ChapterBlock(), DensityGutter(), pct(), Tick(), activeOf(), anchorsOf(), jumpFeedTo(), stepFeed() (+21 more)

### Community 74 - "electron-vite"
Cohesion: 0.16
Nodes (9): ArrowLineUpIcon, CircleNotchIcon, GearIcon, GitCommitIcon, GitMergeIcon, ProhibitIcon, ROSTER_ICON, UserIcon (+1 more)

### Community 76 - "react"
Cohesion: 0.13
Nodes (28): CheckOutputProps, ciBody(), commitsBody(), commitsStageBody(), DelegatedRow(), GateAction(), GrowRow(), NodeDrawer() (+20 more)

### Community 77 - "react-dom"
Cohesion: 0.11
Nodes (17): CockpitScreenProps, CockpitScreenView(), CONNECTED, Default, FACTS, GrantRefused, NotAGitRepository, NothingConnected (+9 more)

### Community 78 - "projection.ts"
Cohesion: 0.14
Nodes (28): callResult(), diskFallbackPath(), resolveResult(), resultContext, absorb(), absorbFirstPrompt(), absorbMessage(), coercePromptText() (+20 more)

### Community 79 - "sessionStore.ts"
Cohesion: 0.20
Nodes (9): AllTones, Default, EveryState, Hollow, Labelled, Pulsing, Quiet, RAIL_STATES (+1 more)

### Community 80 - "sessionFacts.ts"
Cohesion: 0.11
Nodes (21): projectFolder(), connect(), wireWorkItems(), WorkItemsBridgeOptions, createGitHubWorkItems(), githubClientId(), HttpResponse, nodeHttp() (+13 more)

### Community 81 - "terminalBridge.ts"
Cohesion: 0.16
Nodes (26): restoreProjects(), registryFile(), twoProjects(), activate(), chooseCli(), chooseFolder(), create(), ADR-0017 (+18 more)

### Community 82 - "channels.ts"
Cohesion: 0.14
Nodes (5): cockpit, Window, ADR-0005, CockpitBridge, DeviceCodePrompt

### Community 83 - "Roster.stories.tsx"
Cohesion: 0.11
Nodes (19): projectCli(), AgentLauncher, createAgentLauncher(), Launch, Launched, AgentTerminals, AttachedTerminal, Docks (+11 more)

### Community 84 - "SessionRow.tsx"
Cohesion: 0.13
Nodes (11): LIFECYCLE_NODE_STATE, LifecycleNodeStatePresentation, FEED_GLYPHS, InTheColumn, Mark, Story, ArrowsClockwiseIcon, IconAtom (+3 more)

### Community 85 - "deliveryState"
Cohesion: 0.13
Nodes (28): GRANT_STATES, GrantState, ADR-0014, ADR-0018, activateProject(), addProject(), addSession(), attribute() (+20 more)

### Community 86 - "deliveryState"
Cohesion: 0.10
Nodes (28): ciState(), commitsState(), LIFECYCLE_KEYS, lifecycleModel, LifecycleNodeKey, LifecycleNodes, LifecycleNodeState, mergeState() (+20 more)

### Community 87 - "PrChecksList.tsx"
Cohesion: 0.08
Nodes (26): CHECK_LABEL, CheckOutput(), LOCAL_CHECKS, LocalCheck, Default, EveryCheck, MultilineFeed, Story (+18 more)

### Community 88 - "FileDiff.stories.tsx"
Cohesion: 0.12
Nodes (24): AllStates, Connecting, FolderOnly, Fresh, Refused, Settings, Story, buildConnectPanelModel() (+16 more)

### Community 89 - "FindingCard.tsx"
Cohesion: 0.06
Nodes (56): AllFilesDiff(), AllFilesDiffFile, Default, Empty, FILES, Story, CommitGroup(), CommitGroupFile (+48 more)

### Community 90 - "lifecycleNodeState.ts"
Cohesion: 0.29
Nodes (5): Default, NeutralWord, propsOf(), Pulsing, Story

### Community 91 - "PrChecksList.stories.tsx"
Cohesion: 0.25
Nodes (5): PR, rails, REVIEWING, RosterWord, SessionDot

### Community 92 - "NowLine.stories.tsx"
Cohesion: 0.13
Nodes (20): SessionHeader(), SessionMeta(), branchSegment(), buildInteriorHeader(), IntentChip, MetaSegment, metaSegments(), ran() (+12 more)

### Community 93 - "SessionRow.stories.tsx"
Cohesion: 0.10
Nodes (18): AgentPicker(), Default, Reselected, Story, ConnectPanel(), ADR-0015, ConnectRow(), Done (+10 more)

### Community 94 - "branchMenuModel.ts"
Cohesion: 0.10
Nodes (18): BranchManageProps, Ahead, Behind, Default, Diverged, Story, Default, facts (+10 more)

### Community 95 - "MutationRow.tsx"
Cohesion: 0.14
Nodes (16): relativeTo(), splitPath(), Absent(), absentReason(), FAILED, MediaRow(), SAW, CHANGE_MARKS (+8 more)

### Community 96 - "@electron-toolkit/tsconfig"
Cohesion: 0.12
Nodes (14): armKeys, contested, failed, judged, ok, parseProblems, path, pct() (+6 more)

### Community 99 - "CallRow.tsx"
Cohesion: 0.11
Nodes (18): CallOutput(), LOG, LongLog, Printed, Story, callMark(), CallRow(), FAILED (+10 more)

### Community 100 - "arms.ts"
Cohesion: 0.21
Nodes (12): ArmId, ArmSpec, RouterOutput, runRouter(), ChunkType, parseRouterReply(), ReducedPayload, renderForSpeaker() (+4 more)

### Community 101 - "useShellState.ts"
Cohesion: 0.17
Nodes (15): currentSessionId(), ShellCommands, useShellKeymap(), ShellState, useShellState(), CockpitHandlers, shellCommand, WITH_META (+7 more)

### Community 102 - "trial.ts"
Cohesion: 0.19
Nodes (12): SpanVerdict, CouncilResult, armB, inPath, leak, outPath, redactRow(), rows (+4 more)

### Community 103 - "mine-transcripts.ts"
Cohesion: 0.16
Nodes (12): all, bands, collect(), Mined, mostlyCode(), outPath, perBand, picked (+4 more)

### Community 104 - "Console.stories.tsx"
Cohesion: 0.08
Nodes (23): RoomScene(), Lit, Story, ROOM_ENTRIES, RoomSwitcher(), Default, EveryRoom, Story (+15 more)

### Community 105 - "claudeTranscript.ts"
Cohesion: 0.12
Nodes (37): commandPrompt(), firstText(), isHarnessMeta(), localCommandCall(), localCommandOutput(), spoken(), tag(), userPrompt() (+29 more)

### Community 106 - "models.ts"
Cohesion: 0.15
Nodes (13): owningTranscript(), PROMPT, REPLY, embedded(), extensionOf(), fromContentPart(), fromDisk(), fromToolUseResult() (+5 more)

### Community 107 - "containment.ts"
Cohesion: 0.48
Nodes (6): checkAll(), checkSpan(), matchedPrefixWords(), normalise(), Transform, TRANSFORMS

### Community 108 - "discover.ts"
Cohesion: 0.14
Nodes (13): createWorkItemPoller(), item, provider(), pump(), ADR-0018, ADR-0018, WorkItemPollerOptions, WorkItemProvider (+5 more)

### Community 109 - "speaker.ts"
Cohesion: 0.53
Nodes (5): absentSpeaker(), realtimeSpeaker(), Speaker, speakerFromEnv(), timeoutFor()

### Community 110 - "CommitGroup.stories.tsx"
Cohesion: 0.13
Nodes (16): countLabel(), foldLine(), GLYPH_FOR, QUIET_NOUN, QuietCall(), QuietRow(), sentenceCase(), FILES (+8 more)

### Community 111 - "deviceFlow.ts"
Cohesion: 0.22
Nodes (17): GitHubWorkItemsOptions, awaitToken(), DeviceCode, DeviceFlowOptions, field(), parseDeviceCode(), post(), readNumber() (+9 more)

### Community 112 - "channels.ts"
Cohesion: 0.12
Nodes (12): BranchRef, GitFacts, GitOperation, GitRequest, ADR-0004, TerminalAttachRequest, TerminalSession, TerminalSize (+4 more)

### Community 113 - "IconButton.stories.tsx"
Cohesion: 0.13
Nodes (8): Default, Story, ArrowLineDownIcon, GitBranchIcon, PlusIcon, TrashIcon, OperationRow(), OPERATIONS

### Community 115 - "parseTranscript"
Cohesion: 0.16
Nodes (10): parseTranscript(), parseFixture(), parseFixture(), parseFixture(), parsed(), parse(), transcript(), ANSWERED (+2 more)

### Community 116 - "Prose.tsx"
Cohesion: 0.14
Nodes (12): browsableHref(), ELEMENTS, Prose(), ProseLink(), SAFE_SCHEMES, ExcludedSyntax, FencedBlock, Lists (+4 more)

### Community 117 - "TurnFeed.stories.tsx"
Cohesion: 0.11
Nodes (16): COMMAND, CompactedBefore, Empty, Exchange, FAILED_CALL, FoldsBrokenByEachLoudKind, MESSAGE, MUTATION (+8 more)

### Community 118 - "Cli"
Cohesion: 0.22
Nodes (13): ProjectRecord, CockpitState, containsPath(), projectForCwd(), projectName(), projectView, SEPARATORS, project() (+5 more)

### Community 119 - "issues.ts"
Cohesion: 0.23
Nodes (14): isRecord(), issueStatus(), parseIssue(), readChildCount(), readLabels(), readLogin(), readTimestamp(), readTypeName() (+6 more)

### Community 123 - "MutationRow.stories.tsx"
Cohesion: 0.15
Nodes (15): AtTheBound, CompletedWithoutAPatch, Created, Deleted, Failed, FailedWithAReason, Modified, NoDiffAvailable (+7 more)

### Community 124 - "gitHubPort.ts"
Cohesion: 0.30
Nodes (12): byNumber(), fakeGitHub, FakeIssue, FakeRepository, respond(), route(), toPayload(), gitHubPort() (+4 more)

### Community 125 - "TurnFeed.tsx"
Cohesion: 0.18
Nodes (11): CompactionMarker(), Marker, Story, inkFor(), firstLine(), gapAbove(), isFailed(), MessageRow() (+3 more)

### Community 126 - "proseSubset.ts"
Cohesion: 0.19
Nodes (12): linkifyBareUrls(), nodeOf(), hrefs(), TextPiece, textPieces(), trimTrailing(), FORGOTTEN, isClosed() (+4 more)

### Community 127 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, clsx, node-pty, radix-ui, react-markdown, tailwind-merge, unist-util-visit, @xterm/addon-webgl (+7 more)

### Community 128 - "useConnectPanel.ts"
Cohesion: 0.27
Nodes (13): chooseCli(), chooseFolder(), commit(), connectActs(), ConnectSession, runRow(), signIn(), ConnectPanel (+5 more)

### Community 129 - "dock.ts"
Cohesion: 0.24
Nodes (12): buildDock(), describe(), DockKind, IDLE_NOW, nowHead(), NowHeadModel, toolCallsOf(), planProgress() (+4 more)

### Community 130 - "toolResult.ts"
Cohesion: 0.21
Nodes (11): countSide(), declaredChange(), diffLine(), diffResultFrom(), fileChange(), FileSnapshot, SIDE_BY_MARKER, wholeFileHunk() (+3 more)

### Community 131 - "stateMap.ts"
Cohesion: 0.25
Nodes (12): bucketFor(), collapse(), NAME_RULES, normalize(), ProviderState, seedBucket(), seedStateMap(), StateCategory (+4 more)

### Community 132 - "ToolRow.stories.tsx"
Cohesion: 0.14
Nodes (12): FAILED, MARKS, MinimapMark, UNKNOWN, Failed, LongCommand, LongPath, NothingToOpen (+4 more)

### Community 133 - "WelcomeScreen.tsx"
Cohesion: 0.19
Nodes (9): BinocularsIcon, BenefitRow(), Default, Story, BENEFITS, Default, Story, ADR-0015 (+1 more)

### Community 134 - "DeliveryLifecycle.tsx"
Cohesion: 0.19
Nodes (9): DeliveryLifecycleProps, TERMINAL_PRESENTATION, LifecycleNode(), LifecycleNodeProps, NODE_LABEL, PrAnchor(), PrAnchorProps, Default (+1 more)

### Community 135 - "realSession.ts"
Cohesion: 0.26
Nodes (12): agentOf(), callOf(), DIFF_SIDES, oneOf(), proseOf(), RawAgent, RawCall, RawFixture (+4 more)

### Community 136 - "MediaRow.stories.tsx"
Cohesion: 0.17
Nodes (11): Closable, Embedded, Failed, FileGone, FromDisk, row(), SamePathThrice, STAGES (+3 more)

### Community 137 - "DiffLines.tsx"
Cohesion: 0.23
Nodes (10): CodeToken, highlighter, highlightLines(), LANGUAGE_BY_EXTENSION, DiffLines(), Line(), lineNumbers(), SIDE_MARK (+2 more)

### Community 138 - "projection.ts"
Cohesion: 0.41
Nodes (8): emptyState(), argo, created(), registered(), replay(), session(), shop, superseded()

### Community 139 - "branchRefs.ts"
Cohesion: 0.31
Nodes (9): BRANCH_REF_ARGS, commitsIn(), mirroredDrift(), parseBranchRefs(), parseTrack(), RawRef, named(), REFS (+1 more)

### Community 141 - "toolCalls.ts"
Cohesion: 0.22
Nodes (9): CallOrigin, KIND_BY_NAME, planEntryStatus(), TARGET_KEYS, toolCallKind(), toolCallTarget(), PLAN_ENTRY_STATUSES, PlanEntry (+1 more)

### Community 142 - "runGit"
Cohesion: 0.40
Nodes (7): argumentsFor(), REF_OPERATIONS, runGitOperation(), execFileAsync, GitOutput, refusal(), runGit()

### Community 143 - "PlanRow.tsx"
Cohesion: 0.24
Nodes (8): currentStep(), PlanRow(), AllDone, ENTRIES, InProgress, NotStarted, Story, ADR-0020

### Community 144 - "ShotGallery.tsx"
Cohesion: 0.33
Nodes (8): absentReason(), hasBytes(), Lightbox(), nameOf(), Shot(), ShotGallery(), srcOf(), Thumb()

### Community 145 - "model.ts"
Cohesion: 0.36
Nodes (8): buildSessionsRoomModel(), byRecentActivity(), Graded, hasLeftForArchived(), newerFirst(), rowFor(), idsOf(), rowOf()

### Community 146 - "DiffView.tsx"
Cohesion: 0.31
Nodes (5): languageOf(), boundLabel(), DiffView(), DisclosureProps, useDisclosure()

### Community 147 - "bridge.ts"
Cohesion: 0.36
Nodes (7): isGitOperation(), isGitRequest(), isProjectId(), refuse(), ADR-0004, wireGit(), GIT_OPERATIONS

### Community 148 - "index.ts"
Cohesion: 0.39
Nodes (6): ADR-0004, GITHUB_HOSTS, onGitHub(), parseRemoteUrl(), readRemoteRepository(), RemoteRepository

### Community 149 - "Roster.stories.tsx"
Cohesion: 0.22
Nodes (8): Roster(), ARCHIVED, ArchivedOpen, POPULATED, PR, Selected, Story, Zero

### Community 150 - "Text.stories.tsx"
Cohesion: 0.22
Nodes (8): AllVariants, Coloured, Default, SPECIMEN, Story, VARIANTS, TEXT_ELEMENTS, TextVariant

### Community 151 - "headFacts.ts"
Cohesion: 0.39
Nodes (6): HEAD_FACTS_ARGS, HeadFacts, parseHeadFacts(), readDrift(), readHeaders(), readHeadFacts()

### Community 152 - "NowHead.tsx"
Cohesion: 0.32
Nodes (6): headline(), NowHead(), AtRest, NothingYet, Story, Working

### Community 153 - "TerminalPane.tsx"
Cohesion: 0.39
Nodes (6): openTerminal(), resolveColor(), OnGlassPanel, Story, TerminalPane(), terminalTheme()

### Community 154 - "package.json"
Cohesion: 0.29
Nodes (6): description, main, name, private, type, version

### Community 155 - "ContextRing.tsx"
Cohesion: 0.38
Nodes (5): clampPercentage(), ContextRing(), Estimated, Story, Unknown

### Community 156 - "DiffView.stories.tsx"
Cohesion: 0.33
Nodes (5): Bounded, NoDiffAvailable, ROTATION_HUNKS, Story, WholePatch

### Community 157 - "ConnectionChip.tsx"
Cohesion: 0.40
Nodes (4): ConnectionChip(), NeedsReconnect, Silent, Story

### Community 158 - "watch.test.ts"
Cohesion: 0.60
Nodes (4): armed(), settle(), sleep(), ADR-0008

### Community 159 - "ArchivedFooter.stories.tsx"
Cohesion: 0.40
Nodes (4): ArchivedFooter(), Closed, Open, Story

### Community 160 - "NewSessionRow.stories.tsx"
Cohesion: 0.40
Nodes (4): NewSessionRow(), Default, Refused, Story

## Knowledge Gaps
- **947 isolated node(s):** `*.css`, `projectRoot`, `config`, `project`, `$schema` (+942 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **46 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `turn()` connect `Chromatic Storybook` to `claudeTranscript.ts`, `dock.ts`, `Vite React Plugin`, `ContextGauge.tsx`?**
  _High betweenness centrality (0.159) - this node is a cross-community bridge._
- **Why does `model()` connect `React Types` to `useConnectPanel.ts`, `Chromatic Storybook`, `Text.tsx`, `FileDiff.stories.tsx`?**
  _High betweenness centrality (0.141) - this node is a cross-community bridge._
- **Why does `buildActivity()` connect `Chromatic Storybook` to `dock.ts`, `Storybook Docs Addon`, `SectionHeader.tsx`, `React Types`?**
  _High betweenness centrality (0.135) - this node is a cross-community bridge._
- **What connects `*.css`, `projectRoot`, `config` to the rest of the system?**
  _947 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Biome Config` be split into smaller, more focused modules?**
  _Cohesion score 0.1339031339031339 - nodes in this community are weakly interconnected._
- **Should `Root Package Manifest` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
- **Should `Turbo Build Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.06653225806451613 - nodes in this community are weakly interconnected._