import ArgoDesign
import ArgoEngine
import ArgoUI
import SwiftUI

/// Every shape the row comes in once the clock is on line 3 (#1343): three lines, two lines with
/// no activity, two lines with no clock, and an activity longer than the sidebar.
///
/// Its own fixture rather than the shared preview, which has no row drawing all three lines.
struct RosterSecondLineSpecimen: View {
    /// Whether movement is off — `argoStillsMotion`, which is the only way a PNG catches the still.
    var isStill = false

    static var rows: [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: sessions)
    }

    /// Anchored to the render's own moment, the way `TurnClockRosterSpecimen`'s ages are: a fixed
    /// stamp would age the readings out from under the PNG.
    private static var sessions: [CockpitPresentation.Session] {
        let nowMs = Date().epochMs
        return [
            running(
                id: "both",
                title: "The roster row's second line",
                startedAtMs: nowMs - 252_000,
                ran: "bun run quality",
            ),
            running(
                id: "no-activity",
                title: "Retire Electron, set new design foundations",
                startedAtMs: nowMs - 21000,
                ran: nil,
            ),
            // No prompt Argo has a stamp for and nothing seen either, so there is no clock: the
            // row is a title and an activity, and line 3 goes with the reading.
            running(id: "no-clock", title: "Restore the sessions Warp closed", ran: "swift test"),
            running(
                id: "long-fact",
                title: "A Turn deep in a long command",
                startedAtMs: nowMs - 400_000,
                ran: "swift test --package-path apps/macOS/Packages/ArgoUI --filter RhythmTests",
            ),
        ]
    }

    /// A managed Session mid-Turn. `startedAtMs` is the prompt the clock counts from; without one
    /// the row has no clock, which is the third shape above.
    private static func running(
        id: String, title: String, startedAtMs: Int? = nil, ran: String?,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: id,
            title: title,
            access: .managed,
            status: .running,
            chain: .init(
                program: .init(model: "claude-opus-5"),
                span: .init(lastSeenAtMs: startedAtMs),
            ),
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(kind: .main, branch: "main"),
            ),
            transcript: .init(events: events(startedAtMs: startedAtMs, ran: ran)),
        )
    }

    private static func events(startedAtMs: Int?, ran: String?) -> [TranscriptEvent] {
        var events: [TranscriptEvent] = [.prompt(text: "go", images: [], atMs: startedAtMs)]
        if let ran {
            events.append(.toolCall(ToolCall(
                id: "call", name: "Bash", kind: .execute, target: ran, atMs: startedAtMs,
            )))
        }
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

#Preview("The roster row — the shapes it comes in") {
    RosterSecondLineSpecimen()
        .frame(height: 300)
        .argoAppearance()
}

#Preview("The roster row — with movement off") {
    RosterSecondLineSpecimen(isStill: true)
        .frame(height: 300)
        .argoAppearance()
}
