import ArgoDesign
import ArgoEngine
import ArgoUI
import Foundation
import SwiftUI

/// The leading column's four Subagent readings, and the ceiling, over the roster's own row
/// (#1344, `cockpit-roster-row.md`) — never delegated, running under the ceiling, past it, all
/// landed, unresolved, and a fold summing what it hides.
struct SubagentDotsRosterSpecimen: View {
    var body: some View {
        List {
            ForEach(Self.rows) { row in
                SessionRow(row: row).previewSafeListRow()
            }
        }
        .listStyle(.sidebar)
        .frame(width: ArgoLayout.sidebarIdealWidth)
    }

    static let rows = SessionRosterProjection.rows(from: sessions)

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

    private static let landedDelegation: [TranscriptEvent] = [
        .toolCall(ToolCall(id: "done", name: "Task", kind: .delegate, target: "work", atMs: nil)),
        .toolCallOutcome(ToolCallOutcome(
            id: "done",
            resolution: ToolCallOutcome.Resolution(status: .completed, result: nil, endedAtMs: nil),
        )),
    ]
}
