# Graph Report - .  (2026-08-07)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 720 nodes · 1311 edges · 34 communities (28 shown, 6 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 56 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `67976d31`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Hub
- JSONValue
- TranscriptReader
- scripts
- Foundation
- Equatable
- TranscriptEvent
- Sendable
- String
- CockpitRoom
- tasks
- transcriptLines
- ArgoMotion
- SessionRosterProjection
- .callEvents
- Head
- SwiftUI
- tasks
- ArgoTypeface
- CockpitActions
- View
- SpecimenFixtures
- Specimen
- scripts
- ArgoElevation
- ConnectionChip
- ContractSpecimen
- ArgoGeometry.swift
- GitVessel
- PackageDescription
- ProjectStrip
- SessionNavigator
- ShellSidebar
- ArgoLayout.swift

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
- `outputEvidence()` --calls--> `OutputEvidence`  [INFERRED]
  apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Transcript/OutputReading.swift → apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Session/Evidence.swift
- `tag()` --calls--> `text`  [INFERRED]
  apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Transcript/HarnessRecord.swift → apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Transcript/ContentBlock.swift
- `transcriptEvents()` --calls--> `transcriptLines()`  [INFERRED]
  apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Transcript/TranscriptEvents.swift → apps/macOS/Packages/ArgoEngine/Sources/ArgoEngine/Transcript/TranscriptTail.swift
- `ArgoApp` --references--> `CockpitActions`  [EXTRACTED]
  apps/macOS/Argo/ArgoApp.swift → apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/CockpitActions.swift
- `ArgoApp` --calls--> `CockpitNavigationModel`  [INFERRED]
  apps/macOS/Argo/ArgoApp.swift → apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/CockpitNavigationModel.swift

## Import Cycles
- None detected.

## Communities (34 total, 6 thin omitted)

### Community 0 - "Hub"
Cohesion: 0.06
Nodes (33): App, ArgoApp, CockpitPresentation, Engine, URL, Hub, RecordOwner, Int (+25 more)

### Community 1 - "JSONValue"
Cohesion: 0.08
Nodes (38): MediaEvidence, message, ContentBlock, image, thinking, toolResult, toolUse, unreadable (+30 more)

### Community 2 - "TranscriptReader"
Cohesion: 0.08
Nodes (32): text, commandPrompt(), firstText(), localCommandOutput(), String, tag(), userPrompt(), outputEvidence() (+24 more)

### Community 3 - "scripts"
Cohesion: 0.04
Nodes (46): @biomejs/biome, husky, jscpd, lint-staged, bin, argo, devDependencies, @biomejs/biome (+38 more)

### Community 4 - "Foundation"
Cohesion: 0.07
Nodes (26): describe(), oneLine(), Int, String, TranscriptEvent, URL, TranscriptObservationError, unreadable (+18 more)

### Community 5 - "Equatable"
Cohesion: 0.08
Nodes (30): HubConnection, failed, healthy, reconnecting, String, Int, Usage, Access (+22 more)

### Community 6 - "TranscriptEvent"
Cohesion: 0.06
Nodes (36): Int, Usage, ToolCall, ToolCallKind, delegate, edit, execute, fetch (+28 more)

### Community 7 - "Sendable"
Cohesion: 0.12
Nodes (17): ArgoColor, Double, ArgoPalette, EdgeRoles, InteractionRoles, StateRoles, SurfaceRoles, TextRoles (+9 more)

### Community 8 - "String"
Cohesion: 0.10
Nodes (31): DiffEvidence, DiffHunk, DiffLine, DiffLineSide, add, context, del, FileChange (+23 more)

### Community 9 - "CockpitRoom"
Cohesion: 0.08
Nodes (30): CockpitRoom, code, sessions, work, Self, DeckZone, dock, feed (+22 more)

### Community 10 - "tasks"
Cohesion: 0.07
Nodes (31): ^build, dist/**, OPENAI_API_KEY, out/**, REALTIME_MODEL, storybook-static/**, dependsOn, outputs (+23 more)

### Community 11 - "transcriptLines"
Cohesion: 0.13
Nodes (15): FileCursor, FileWatcher, AsyncStream, String, URL, Void, transcriptLines(), firstLines() (+7 more)

### Community 12 - "ArgoMotion"
Cohesion: 0.14
Nodes (16): Animation, ArgoAnimationModifier, ArgoMotion, Curve, easeInOut, easeOut, spring, Bool (+8 more)

### Community 13 - "SessionRosterProjection"
Cohesion: 0.16
Nodes (11): AppKit, Row, SessionRosterProjection, Bool, CockpitPresentation, Int, String, SessionRow (+3 more)

### Community 14 - ".callEvents"
Cohesion: 0.19
Nodes (12): Plan, PlanEntry, PlanEntryStatus, completed, inProgress, pending, plan(), planEntryStatus() (+4 more)

### Community 15 - "Head"
Cohesion: 0.17
Nodes (10): CheckoutProjection, Head, branch, detached, unavailable, String, URL, CheckoutReader (+2 more)

### Community 16 - "SwiftUI"
Cohesion: 0.14
Nodes (6): View, DeckSeparator, DeckSlot, RoomsVessel, ArgoUI, SwiftUI

### Community 17 - "tasks"
Cohesion: 0.13
Nodes (14): cache, outputs, extends, $schema, cache, outputs, persistent, tasks (+6 more)

### Community 18 - "ArgoTypeface"
Cohesion: 0.24
Nodes (10): ArgoTextStyle, ArgoTypeface, identity, interface, machine, ArgoTypography, CGFloat, String (+2 more)

### Community 19 - "CockpitActions"
Cohesion: 0.21
Nodes (7): CockpitActions, Void, CockpitView, CockpitPresentation, ShellToolbar, CockpitPresentation, ToolbarContent

### Community 20 - "View"
Cohesion: 0.20
Nodes (8): InstrumentDeckShell, DeckContentRow, SessionsDeck, SessionStateIndicator, SpecimenStateDot, SpecimenStatusChip, String, View

### Community 21 - "SpecimenFixtures"
Cohesion: 0.21
Nodes (7): FoundationSpecimen, ToolbarContent, SpecimenDeck, SpecimenDeckTabs, SpecimenFeedEntry, SpecimenFixtures, SpecimenSessionRow

### Community 22 - "Specimen"
Cohesion: 0.22
Nodes (9): DeckSpecimen, SessionRowsSpecimen, Specimen, contract, deck, foundations, sessionRows, sessionsDeck (+1 more)

### Community 23 - "scripts"
Cohesion: 0.22
Nodes (8): description, name, private, scripts, build, lint, screenshot, test

### Community 24 - "ArgoElevation"
Cohesion: 0.31
Nodes (6): ArgoElevation, Bool, CGFloat, Double, String, View

### Community 25 - "ConnectionChip"
Cohesion: 0.33
Nodes (5): ConnectionChip, Bool, CockpitPresentation, String, Void

### Community 27 - "ArgoGeometry.swift"
Cohesion: 0.47
Nodes (5): ArgoRadius, ArgoSpacing, ArgoStroke, CGFloat, String

### Community 28 - "GitVessel"
Cohesion: 0.40
Nodes (4): GitVessel, CockpitPresentation, String, Void

## Knowledge Gaps
- **165 isolated node(s):** `healthy`, `reconnecting`, `failed`, `branch`, `detached` (+160 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SwiftUI` connect `SwiftUI` to `ShellSidebar`, `ArgoLayout.swift`, `Sendable`, `CockpitRoom`, `ArgoMotion`, `SessionRosterProjection`, `ArgoTypeface`, `CockpitActions`, `View`, `SpecimenFixtures`, `Specimen`, `ArgoElevation`, `ConnectionChip`, `ContractSpecimen`, `ArgoGeometry.swift`, `GitVessel`, `ProjectStrip`, `SessionNavigator`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `JSONValue` connect `JSONValue` to `TranscriptReader`, `Equatable`, `Sendable`, `String`, `.callEvents`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `ArgoOperationalState` connect `Equatable` to `Foundation`, `Sendable`, `CockpitRoom`, `SessionRosterProjection`, `View`, `ConnectionChip`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **What connects `healthy`, `reconnecting`, `failed` to the rest of the system?**
  _165 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Hub` be split into smaller, more focused modules?**
  _Cohesion score 0.05794556628621598 - nodes in this community are weakly interconnected._
- **Should `JSONValue` be split into smaller, more focused modules?**
  _Cohesion score 0.07686274509803921 - nodes in this community are weakly interconnected._
- **Should `TranscriptReader` be split into smaller, more focused modules?**
  _Cohesion score 0.07890070921985816 - nodes in this community are weakly interconnected._