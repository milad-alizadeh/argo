import ArgoDesign
import ArgoEngine
import ArgoUI
import SwiftUI

/// The second line in every shape it comes in (#1291): a row carrying both facts, a row with only
/// the clock, a row with only the activity, and a row whose activity is longer than the sidebar.
///
/// The claims a still can make here are the two the design turns on — that the line's first
/// character sits on the title's x rather than the dot's, and that the duration reads first and
/// keeps every character while the fact beside it gives up its tail.
///
/// Its own fixture rather than the shared preview: that roster has no row with both facts at once,
/// and "both" is the arrangement the two-ends rule #1199 landed was built around.
struct RosterSecondLineSpecimen: View {
    /// Whether movement is off. The running dot's pulse has no shorter answer under Reduce Motion,
    /// so this is the OTHER half of that design — the dot at its full running tint with nothing
    /// moving, which is the half a PNG can judge.
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
                id: "clock-only",
                title: "Retire Electron, set new design foundations",
                startedAtMs: nowMs - 21000,
                ran: nil,
            ),
            // No prompt Argo has a stamp for, and nothing seen either, so the slot has no reading
            // to give: the fact stands on the line alone.
            running(id: "fact-only", title: "Restore the sessions Warp closed", ran: "swift test"),
            running(
                id: "long-fact",
                title: "A Turn deep in a long command",
                startedAtMs: nowMs - 400_000,
                ran: "swift test --package-path apps/macOS/Packages/ArgoUI --filter RhythmTests",
            ),
        ]
    }

    /// A managed Session mid-Turn. `startedAtMs` is the prompt the clock counts from — without one
    /// the row has no reading for the slot at all, which is the third shape above.
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

#Preview("Second line — the shapes it comes in") {
    RosterSecondLineSpecimen()
        .frame(height: 300)
        .argoAppearance()
}

#Preview("Second line — with movement off") {
    RosterSecondLineSpecimen(isStill: true)
        .frame(height: 300)
        .argoAppearance()
}
