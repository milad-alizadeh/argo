# Graph Report - .  (2026-08-07)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 920 nodes · 1678 edges · 51 communities (48 shown, 3 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 58 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bb6d3ca1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Hub
- sweep.ts
- JSONValue
- scripts
- Foundation
- tasks
- transcriptLines
- ArgoColor
- council.ts
- SwiftUI
- sweep.ts
- ArgoMotion
- Session
- SessionRosterProjection
- DiffHunk
- ArgoOperationalState
- ArgoTypeface
- Sendable
- TranscriptEvent
- report.ts
- View
- MessageRecord
- Identifiable
- tasks
- ToolCallOutcome
- redact.ts
- mine-transcripts.ts
- TranscriptReader
- DeckZone
- CockpitActions
- arms.ts
- Equatable
- CockpitRoom
- Specimen
- trial.ts
- scripts
- Head
- ToolCallKind
- ArgoElevation
- ArgoTheme
- .callEvents
- HubConnection
- transcriptEvents
- ConnectionChip
- ArgoGeometry.swift
- speaker.ts
- TranscriptObservationError
- GitVessel
- Usage
- PackageDescription
- smoke-realtime.ts

## God Nodes (most connected - your core abstractions)
1. `JSONValue` - 42 edges
2. `SwiftUI` - 31 edges
3. `Foundation` - 28 edges
4. `ArgoColor` - 28 edges
5. `scripts` - 25 edges
6. `TranscriptEvent` - 22 edges
7. `ContentBlock` - 20 edges
8. `ArgoOperationalState` - 20 edges
9. `TranscriptReader` - 18 edges
10. `MessageRecord` - 18 edges

## Surprising Connections (you probably didn't know these)
- `diffEvidence()` --calls--> `DiffEvidence`  [INFERRED]
  apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Transcript/DiffReading.swift → apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Session/Evidence.swift
- `outputEvidence()` --calls--> `OutputEvidence`  [INFERRED]
  apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Transcript/OutputReading.swift → apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Session/Evidence.swift
- `plan()` --calls--> `PlanEntry`  [INFERRED]
  apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Transcript/ToolCallReading.swift → apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Session/Plan.swift
- `plan()` --calls--> `Plan`  [INFERRED]
  apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Transcript/ToolCallReading.swift → apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Session/Plan.swift
- `tag()` --calls--> `text`  [INFERRED]
  apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Transcript/HarnessRecord.swift → apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Transcript/ContentBlock.swift

## Import Cycles
- None detected.

## Communities (51 total, 3 thin omitted)

### Community 0 - "Hub"
Cohesion: 0.05
Nodes (36): App, ArgoApp, CockpitPresentation, Engine, URL, Hub, RecordOwner, Int (+28 more)

### Community 1 - "sweep.ts"
Cohesion: 0.05
Nodes (65): Cap, capLabel(), CAPS, systemPrompt(), userPrompt(), Chunk, ChunkType, CORPUS (+57 more)

### Community 2 - "JSONValue"
Cohesion: 0.07
Nodes (46): ContentBlock, image, text, thinking, toolResult, toolUse, unreadable, ImageBlock (+38 more)

### Community 3 - "scripts"
Cohesion: 0.04
Nodes (46): @biomejs/biome, husky, jscpd, lint-staged, bin, argo, devDependencies, @biomejs/biome (+38 more)

### Community 4 - "Foundation"
Cohesion: 0.10
Nodes (19): describe(), oneLine(), Int, String, TranscriptEvent, Fixture, ImageReader, String (+11 more)

### Community 5 - "tasks"
Cohesion: 0.07
Nodes (31): ^build, dist/**, OPENAI_API_KEY, out/**, REALTIME_MODEL, storybook-static/**, dependsOn, outputs (+23 more)

### Community 6 - "transcriptLines"
Cohesion: 0.13
Nodes (15): FileCursor, FileWatcher, AsyncStream, String, URL, Void, transcriptLines(), firstLines() (+7 more)

### Community 7 - "ArgoColor"
Cohesion: 0.17
Nodes (12): ArgoColor, Double, ArgoPalette, EdgeRoles, InteractionRoles, StateRoles, SurfaceRoles, TextRoles (+4 more)

### Community 8 - "council.ts"
Cohesion: 0.13
Nodes (20): ADR-0007, AxisResult, convene(), judgeOnce(), AXES, Axis, AxisId, judgePrompt() (+12 more)

### Community 9 - "SwiftUI"
Cohesion: 0.09
Nodes (12): View, DeckSeparator, ProjectStrip, CockpitPresentation, SessionNavigator, CockpitPresentation, ShellSidebar, CockpitPresentation (+4 more)

### Community 10 - "sweep.ts"
Cohesion: 0.12
Nodes (19): ARMS, Arm, armB(), EvalChunk, loadCorpus(), sessionInstructions(), argv, byArm (+11 more)

### Community 11 - "ArgoMotion"
Cohesion: 0.14
Nodes (16): Animation, ArgoAnimationModifier, ArgoMotion, Curve, easeInOut, easeOut, spring, Bool (+8 more)

### Community 12 - "Session"
Cohesion: 0.17
Nodes (16): Access, managed, readOnly, Checkout, branch, detached, unavailable, CockpitPresentation (+8 more)

### Community 13 - "SessionRosterProjection"
Cohesion: 0.16
Nodes (11): AppKit, Row, SessionRosterProjection, Bool, CockpitPresentation, Int, String, SessionRow (+3 more)

### Community 14 - "DiffHunk"
Cohesion: 0.19
Nodes (16): DiffHunk, DiffLine, DiffLineSide, add, context, del, Int, count() (+8 more)

### Community 15 - "ArgoOperationalState"
Cohesion: 0.12
Nodes (13): SessionStateIndicator, SpecimenStateDot, SpecimenStatusChip, String, ArgoOperationalState, attention, failure, idle (+5 more)

### Community 16 - "ArgoTypeface"
Cohesion: 0.16
Nodes (12): ContractSpecimen, String, ArgoTextStyle, ArgoTypeface, identity, interface, machine, ArgoTypography (+4 more)

### Community 17 - "Sendable"
Cohesion: 0.18
Nodes (16): DiffEvidence, FileChange, create, delete, modify, MediaEvidence, OutputEvidence, ToolResult (+8 more)

### Community 18 - "TranscriptEvent"
Cohesion: 0.11
Nodes (17): Int, String, TranscriptEvent, branch, compaction, cwd, headLeaf, message (+9 more)

### Community 19 - "report.ts"
Cohesion: 0.12
Nodes (14): armKeys, contested, failed, judged, ok, parseProblems, path, pct() (+6 more)

### Community 20 - "View"
Cohesion: 0.20
Nodes (10): DeckContentRow, SessionsDeck, FoundationSpecimen, ToolbarContent, SpecimenDeck, SpecimenDeckTabs, SpecimenFeedEntry, SpecimenFixtures (+2 more)

### Community 21 - "MessageRecord"
Cohesion: 0.18
Nodes (12): MessageRecord, Bool, Int, String, Usage, TranscriptRecord, aiTitle, assistant (+4 more)

### Community 22 - "Identifiable"
Cohesion: 0.21
Nodes (14): DeckTab, activity, delivery, FeedEntry, Room, code, sessions, work (+6 more)

### Community 23 - "tasks"
Cohesion: 0.13
Nodes (14): cache, outputs, extends, $schema, cache, outputs, persistent, tasks (+6 more)

### Community 24 - "ToolCallOutcome"
Cohesion: 0.18
Nodes (11): Int, Usage, ToolCall, ToolCallOutcome, ToolCallStatus, completed, failed, inProgress (+3 more)

### Community 25 - "redact.ts"
Cohesion: 0.25
Nodes (8): armB, inPath, leak, outPath, redactRow(), rows, spokenBody(), Trial

### Community 26 - "mine-transcripts.ts"
Cohesion: 0.16
Nodes (12): all, bands, collect(), Mined, mostlyCode(), outPath, perBand, picked (+4 more)

### Community 27 - "TranscriptReader"
Cohesion: 0.31
Nodes (5): OpenCall, ImageReader, String, TranscriptEvent, TranscriptReader

### Community 28 - "DeckZone"
Cohesion: 0.15
Nodes (11): DeckSlot, DeckZone, dock, feed, header, minimap, rail, tabs (+3 more)

### Community 29 - "CockpitActions"
Cohesion: 0.21
Nodes (7): CockpitActions, Void, CockpitView, CockpitPresentation, ShellToolbar, CockpitPresentation, ToolbarContent

### Community 30 - "arms.ts"
Cohesion: 0.29
Nodes (10): ArmId, ArmSpec, RouterOutput, runRouter(), ChunkType, parseRouterReply(), ReducedPayload, renderForSpeaker() (+2 more)

### Community 31 - "Equatable"
Cohesion: 0.33
Nodes (8): Plan, PlanEntry, PlanEntryStatus, completed, inProgress, pending, Equatable, String

### Community 32 - "CockpitRoom"
Cohesion: 0.18
Nodes (8): CockpitRoom, code, sessions, work, Self, InstrumentDeckShell, RoomsVessel, KeyEquivalent

### Community 33 - "Specimen"
Cohesion: 0.22
Nodes (9): DeckSpecimen, SessionRowsSpecimen, Specimen, contract, deck, foundations, sessionRows, sessionsDeck (+1 more)

### Community 34 - "trial.ts"
Cohesion: 0.21
Nodes (12): checkAll(), checkSpan(), matchedPrefixWords(), normalise(), SpanVerdict, Transform, TRANSFORMS, CouncilResult (+4 more)

### Community 35 - "scripts"
Cohesion: 0.22
Nodes (8): description, name, private, scripts, build, lint, screenshot, test

### Community 36 - "Head"
Cohesion: 0.31
Nodes (7): CheckoutProjection, Head, branch, detached, unavailable, String, URL

### Community 37 - "ToolCallKind"
Cohesion: 0.22
Nodes (9): ToolCallKind, delegate, edit, execute, fetch, other, plan, read (+1 more)

### Community 38 - "ArgoElevation"
Cohesion: 0.31
Nodes (6): ArgoElevation, Bool, CGFloat, Double, String, View

### Community 39 - "ArgoTheme"
Cohesion: 0.39
Nodes (4): ArgoTheme, EnvironmentValues, ArgoPalette, View

### Community 40 - ".callEvents"
Cohesion: 0.43
Nodes (6): plan(), planEntryStatus(), String, toolCallKind(), toolCallTarget(), Int

### Community 41 - "HubConnection"
Cohesion: 0.33
Nodes (5): HubConnection, failed, healthy, reconnecting, String

### Community 42 - "transcriptEvents"
Cohesion: 0.33
Nodes (5): AsyncStream, ImageReader, TranscriptEvent, URL, transcriptEvents()

### Community 43 - "ConnectionChip"
Cohesion: 0.33
Nodes (5): ConnectionChip, Bool, CockpitPresentation, String, Void

### Community 44 - "ArgoGeometry.swift"
Cohesion: 0.47
Nodes (5): ArgoRadius, ArgoSpacing, ArgoStroke, CGFloat, String

### Community 45 - "speaker.ts"
Cohesion: 0.53
Nodes (5): absentSpeaker(), realtimeSpeaker(), Speaker, speakerFromEnv(), timeoutFor()

### Community 46 - "TranscriptObservationError"
Cohesion: 0.40
Nodes (4): URL, TranscriptObservationError, unreadable, Error

### Community 47 - "GitVessel"
Cohesion: 0.40
Nodes (4): GitVessel, CockpitPresentation, String, Void

## Knowledge Gaps
- **240 isolated node(s):** `healthy`, `reconnecting`, `failed`, `branch`, `detached` (+235 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SwiftUI` connect `SwiftUI` to `CockpitRoom`, `Specimen`, `ArgoElevation`, `ArgoTheme`, `ConnectionChip`, `ArgoGeometry.swift`, `SessionRosterProjection`, `ArgoMotion`, `ArgoOperationalState`, `GitVessel`, `ArgoTypeface`, `View`, `DeckZone`, `CockpitActions`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `JSONValue` connect `JSONValue` to `Foundation`, `.callEvents`, `DiffHunk`, `Sendable`, `MessageRecord`, `TranscriptReader`, `Equatable`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `ArgoOperationalState` connect `ArgoOperationalState` to `ConnectionChip`, `Session`, `SessionRosterProjection`, `Sendable`, `Identifiable`, `Equatable`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **What connects `healthy`, `reconnecting`, `failed` to the rest of the system?**
  _240 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Hub` be split into smaller, more focused modules?**
  _Cohesion score 0.05153153153153153 - nodes in this community are weakly interconnected._
- **Should `sweep.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05333333333333334 - nodes in this community are weakly interconnected._
- **Should `JSONValue` be split into smaller, more focused modules?**
  _Cohesion score 0.06830601092896176 - nodes in this community are weakly interconnected._