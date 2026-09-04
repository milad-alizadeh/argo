import ArgoDesign
import ArgoEngine
import ArgoUI
import SwiftUI

/// The five readings the leading column draws (#1344, `cockpit-roster-row.md`), one row each:
/// running under the ceiling, running past it, delegated-and-all-home, delegated-and-cannot-place,
/// and a Session Argo cannot place at all.
///
/// Its own fixture because none of the shared ones delegates anything: what this is for is the
/// column, and a roster of Sessions that handed nothing over draws an empty one on every row.
struct SubagentDotsSpecimen: View {
    /// Whether movement is off — `argoStillsMotion`, which is the only way a PNG catches the still.
    var isStill = false

    static var rows: [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: sessions)
    }

    private static var sessions: [CockpitPresentation.Session] {
        let nowMs = Date().epochMs
        return [
            Reading(
                run: Run(
                    id: "running",
                    title: "The rail reads the Subagents' own records",
                    status: .running,
                ),
                agoMs: 252_000, handed: Handover(open: 3, landed: 1),
            ),
            Reading(
                run: Run(
                    id: "ceiling",
                    title: "Sweep every stop reason in the corpus",
                    status: .running,
                ),
                agoMs: 1_327_000, handed: Handover(open: 12, landed: 0),
            ),
            Reading(
                run: Run(
                    id: "spent",
                    title: "Graphite and Ion Blue across the shell",
                    status: .running,
                ),
                agoMs: 18000, handed: Handover(open: 0, landed: 5),
            ),
            // Idle, so its open delegations are the #1076 shape: the record holds a live child and
            // a dead one in exactly the same words.
            Reading(
                run: Run(
                    id: "cannot-place",
                    title: "Wait on the fan-out to report",
                    status: .idle,
                ),
                agoMs: 640_000, handed: Handover(open: 4, landed: 0),
            ),
            // An external Session: its own state is an outline, and it draws no delegation mark
            // under it whatever its record says it handed over.
            Reading(
                run: Run(
                    id: "unknown",
                    title: "codex — refactor the relay",
                    status: .unknown,
                    access: .external,
                ),
                agoMs: 360_000, handed: Handover(open: 3, landed: 0),
            ),
        ].map { delegating($0, at: nowMs) }
    }

    /// How many briefs a Session handed over, and how many of them came back.
    struct Handover {
        let open: Int
        let landed: Int
    }

    /// The Session itself: what names it, and how Argo can place it.
    struct Run {
        let id: String
        let title: String
        let status: SessionStatus
        var access: CockpitPresentation.Session.Access = .managed
    }

    /// What a row in this specimen IS: a Session in some state, with some fan-out under it.
    struct Reading {
        let run: Run
        let agoMs: Int
        let handed: Handover
    }

    /// A Session that handed `open` briefs over and got `landed` of them back.
    private static func delegating(_ reading: Reading, at nowMs: Int)
        -> CockpitPresentation.Session {
        let startedAtMs = nowMs - reading.agoMs
        return CockpitPresentation.Session(
            id: reading.run.id,
            title: reading.run.title,
            access: reading.run.access,
            status: reading.run.status,
            chain: .init(
                program: .init(model: "claude-opus-5"),
                span: .init(lastSeenAtMs: startedAtMs),
            ),
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(kind: .main, branch: "main"),
            ),
            transcript: .init(events: events(at: startedAtMs, handed: reading.handed)),
        )
    }

    private static func events(at startedAtMs: Int, handed: Handover) -> [TranscriptEvent] {
        var events: [TranscriptEvent] = [.prompt(text: "go", images: [], atMs: startedAtMs)]
        for index in 0 ..< handed.open {
            events.append(.toolCall(ToolCall(
                id: "open-\(index)", name: "Task", kind: .delegate,
                target: "brief \(index)", atMs: startedAtMs,
            )))
        }
        for index in 0 ..< handed.landed {
            events.append(.toolCall(ToolCall(
                id: "home-\(index)", name: "Task", kind: .delegate,
                target: "done \(index)", atMs: startedAtMs,
            )))
            events.append(.toolCallOutcome(ToolCallOutcome(
                id: "home-\(index)",
                resolution: .init(status: .completed, result: nil, endedAtMs: startedAtMs),
            )))
        }
        // The newest call, so line 2 reads like a row on the real roster rather than repeating the
        // last brief this fixture handed over.
        events.append(.toolCall(ToolCall(
            id: "doing", name: "Bash", kind: .execute,
            target: "bun run quality", atMs: startedAtMs,
        )))
        return events
    }

    var body: some View {
        List {
            ForEach(Self.rows) { row in
                SessionRow(row: row).previewSafeListRow()
            }
        }
        .listStyle(.sidebar)
        .frame(width: ArgoLayout.sidebarIdealWidth)
        .environment(\.argoStillsMotion, isStill)
    }
}

#Preview("Subagent dots — the five readings of the column") {
    SubagentDotsSpecimen()
        .frame(height: 340)
        .argoAppearance()
}
