import ArgoDesign
import ArgoEngine
import ArgoUI
import Foundation
import SwiftUI

/// The leading column's four Subagent readings, and the ceiling, over the roster's own row
/// (#1344, `cockpit-roster-row.md`) — never delegated, running under the ceiling, past it, all
/// landed, unresolved, a fold summing what it hides, and the row the deck has OPEN.
///
/// The open row is the state #1513 was reported for: the same record as `unresolved` above it —
/// a waiting parent, an open delegation the record cannot settle — beside a reader that has
/// watched both children's files grow. Grey on one and green on the other is the bug; drawn
/// together here, the two rows are what tells the fourth fact apart from the three.
struct SubagentDotsRosterSpecimen: View {
    var body: some View {
        List {
            ForEach(rows) { row in
                SessionRow(row: row).previewSafeListRow()
            }
        }
        .listStyle(.sidebar)
        .frame(width: ArgoLayout.sidebarIdealWidth)
    }

    /// Derived in the body's own isolation, not at file scope: the fourth fact is read through a
    /// reader, and a reader answers on the main actor (`FeedAgentReader`).
    private var rows: [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(
            from: Self.sessions,
            focus: SessionRosterProjection.focus(
                on: "open", among: Self.sessions, asking: Self.watching,
            ),
        )
    }

    /// What the deck has open, stated: both of that Session's children are writing right now.
    private static let watching = FeedAgentReader(
        events: ["open-0": [], "open-1": []],
        of: .undecided,
        growth: StatedGrowth(writing: ["open-0", "open-1"]),
    )

    private static let checkout = "/Users/milad/Developer/argo"

    private static let sessions: [CockpitPresentation.Session] = [
        CockpitPresentation.Session(
            id: "running-3",
            title: "Never delegated anything at all",
            access: .managed,
            status: .running,
            chain: .init(program: .init(model: "claude-opus-5")),
            work: .init(location: checkout),
        ),
        CockpitPresentation.Session(
            id: "ceiling",
            title: "Twelve running — five dots and a plus seven",
            access: .managed,
            status: .running,
            chain: .init(program: .init(model: "claude-opus-5")),
            work: .init(location: checkout),
            transcript: .init(events: openDelegations(12)),
        ),
        CockpitPresentation.Session(
            id: "landed",
            title: "Delegated, and all of them are home",
            access: .managed,
            status: .idle,
            chain: .init(program: .init(model: "claude-opus-5")),
            work: .init(location: checkout),
            transcript: .init(events: landedDelegation),
        ),
        CockpitPresentation.Session(
            id: "unresolved",
            title: "An open delegation Argo cannot resolve",
            access: .managed,
            status: .idle,
            chain: .init(program: .init(model: "claude-opus-5")),
            work: .init(location: checkout),
            transcript: .init(events: openDelegations(1)),
        ),
        CockpitPresentation.Session(
            id: "open",
            title: "The row the deck has open — two children still writing",
            access: .managed,
            status: .idle,
            chain: .init(program: .init(model: "claude-opus-5")),
            work: .init(location: checkout),
            transcript: .init(events: backgroundDelegations(["open-0", "open-1"])),
        ),
        CockpitPresentation.Session(
            id: "external",
            title: "A Session Argo cannot place draws no mark",
            access: .external,
            status: .unknown,
            chain: .init(program: .init(model: "claude-opus-5")),
            work: .init(location: checkout),
            transcript: .init(events: openDelegations(2)),
        ),
        CockpitPresentation.Session(
            id: "fold-a",
            title: "Fold member A",
            access: .external,
            status: .running,
            chain: .init(program: .init(model: "claude-opus-5", entry: .headless)),
            work: .init(location: "\(checkout)/.claude/worktrees/fold-example"),
            transcript: .init(events: openDelegations(2)),
        ),
        CockpitPresentation.Session(
            id: "fold-b",
            title: "Fold member B",
            access: .external,
            status: .running,
            chain: .init(program: .init(model: "claude-opus-5", entry: .headless)),
            work: .init(location: "\(checkout)/.claude/worktrees/fold-example"),
            transcript: .init(events: openDelegations(3)),
        ),
    ]

    /// `count` delegate calls, none of them answered — a Subagent still working, whatever the
    /// Session's own status settles it into (`DelegatingSession`).
    private static func openDelegations(_ count: Int) -> [TranscriptEvent] {
        (0 ..< count).map {
            .toolCall(ToolCall(
                id: "away-\($0)", name: "Task", kind: .delegate, target: "work", atMs: nil,
            ))
        }
    }

    /// One BACKGROUNDED delegation per child, each answered by the launch receipt that names it
    /// and resolves nothing (#908) — which is what gives the row a Subagent to ask the reader
    /// about at all.
    private static func backgroundDelegations(_ children: [String]) -> [TranscriptEvent] {
        children.flatMap { child -> [TranscriptEvent] in
            [
                .toolCall(ToolCall(
                    id: "away-\(child)", name: "Task", kind: .delegate, target: "work", atMs: nil,
                )),
                .toolCallOutcome(ToolCallOutcome(
                    id: "away-\(child)",
                    resolution: ToolCallOutcome.Resolution(
                        status: .inProgress, result: nil, endedAtMs: nil,
                    ),
                    delegated: ToolCallOutcome.Delegated(usage: nil, subagentID: child),
                )),
            ]
        }
    }

    private static let landedDelegation: [TranscriptEvent] = [
        .toolCall(ToolCall(id: "done", name: "Task", kind: .delegate, target: "work", atMs: nil)),
        .toolCallOutcome(ToolCallOutcome(
            id: "done",
            resolution: ToolCallOutcome.Resolution(status: .completed, result: nil, endedAtMs: nil),
        )),
    ]
}
