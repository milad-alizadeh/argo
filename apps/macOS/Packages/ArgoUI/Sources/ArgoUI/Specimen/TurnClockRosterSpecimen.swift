import ArgoEngine
import SwiftUI

/// The one age slot's three readings, side by side (`cockpit-roster-turn-clock.md`): a Turn
/// four minutes in, one seconds old, a six-minute one at the far end of the aged case, the
/// observed `output … ago` on a ghosted row, and the seen reading everything else keeps.
///
/// Its own fixture rather than the shared preview: that preview's running Session deliberately
/// ends its transcript on a boundary plus a waiting ask, so its clock degrades to the seen
/// reading — the honest render for it, and evidence of nothing this design adds.
struct TurnClockRosterSpecimen: View {
    /// Anchored to the render's own moment, the way the preview's ages are: a fixed stamp
    /// would age the readings out from under the PNG.
    static var rows: [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: sessions)
    }

    private static var sessions: [CockpitPresentation.Session] {
        let nowMs = Date().epochMs
        return [
            running(
                id: "midway",
                title: "Roster and header content, then a prototype",
                startedAtMs: nowMs - 252_000,
            ),
            running(
                id: "fresh",
                title: "Restore the sessions Warp closed",
                startedAtMs: nowMs - 21000,
            ),
            running(
                id: "long",
                title: "Retire Electron, set new design foundations",
                startedAtMs: nowMs - 400_000,
            ),
            observed(nowMs: nowMs),
            idle(nowMs: nowMs),
        ]
    }

    private static func running(
        id: String, title: String, startedAtMs: Int,
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
            transcript: .init(events: [.prompt(text: "go", images: [], atMs: startedAtMs)]),
        )
    }

    private static func observed(nowMs: Int) -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "observed",
            title: "Native Session roster in Swift",
            access: .external,
            status: .running,
            chain: .init(span: .init(lastSeenAtMs: nowMs - 12000)),
            work: .init(
                location: "/Users/milad/Developer/argo/.claude/worktrees/ticket-377-roster",
                workspace: .init(kind: .worktree, branch: "argo/#377-native-session-roster"),
            ),
        )
    }

    private static func idle(nowMs: Int) -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "idle",
            title: "Graphite and Ion Blue across the shell",
            access: .managed,
            status: .idle,
            chain: .init(
                program: .init(model: "claude-opus-5"),
                span: .init(lastSeenAtMs: nowMs - 3 * 60 * 60 * 1000),
            ),
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(kind: .main, branch: "main"),
            ),
        )
    }

    var body: some View {
        List {
            ForEach(Self.rows) { row in
                SessionRow(row: row).previewSafeListRow()
            }
        }
        .listStyle(.sidebar)
        .frame(width: ArgoLayout.sidebarIdealWidth)
    }
}

#Preview("Turn clock — the three readings on shipping rows") {
    TurnClockRosterSpecimen()
        .frame(height: 340)
        .argoAppearance()
}
