import ArgoDesign
import ArgoEngine
import ArgoFixtures
import ArgoUI
import SwiftUI

/// Every shape `PlanBar` comes in on the roster row (`cockpit-roster-row.md`, #1345): a Plan
/// mid-flight, one complete, one frozen where an idle Session stopped, and a row with none at
/// all.
struct PlanBarRosterSpecimen: View {
    /// Movement off, so the half a still cannot otherwise carry is renderable: the step in
    /// progress holds its full `interaction.accentBright` instead of breathing (#1403).
    var isStill = false

    static var rows: [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: sessions)
    }

    private static var sessions: [CockpitPresentation.Session] {
        [
            session(
                id: "mid-flight", title: "Fix the worktree naming guard", status: .running,
                entries: [
                    ("Read the anatomy study in full", .completed),
                    ("Run the plan projection suite red", .completed),
                    ("Implement the projection seam", .inProgress),
                    ("Wire the pill above the dock", .pending),
                    ("Independent review, then PR", .pending),
                ],
            ),
            session(
                id: "complete", title: "Sort the roster's second line out", status: .running,
                entries: [
                    ("Read the anatomy study in full", .completed),
                    ("Implement the projection seam", .completed),
                ],
            ),
            session(
                id: "frozen", title: "Graphite and Ion Blue across the shell", status: .idle,
                entries: [
                    ("Read the anatomy study in full", .completed),
                    ("Run the plan projection suite red", .completed),
                    ("Implement the projection seam", .inProgress),
                    ("Wire the pill above the dock", .pending),
                    ("Independent review, then PR", .pending),
                    ("Ship it", .pending),
                ],
            ),
            session(
                id: "none", title: "Read the composer's focus rules", status: .idle, entries: [],
            ),
        ]
    }

    private static func session(
        id: String, title: String, status: SessionStatus, entries: [(String, PlanEntryStatus)],
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: id,
            title: title,
            access: .managed,
            status: status,
            chain: .init(
                program: .init(model: "claude-opus-5"),
                span: .init(lastSeenAtMs: Date().epochMs - 90000),
            ),
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(kind: .main, branch: "main"),
            ),
            transcript: .init(events: entries.isEmpty ? [] : [TranscriptFixtures.plan(entries)]),
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
        .environment(\.argoStillsMotion, isStill)
    }
}

#Preview("PlanBar — mid-flight, complete, frozen, and none") {
    PlanBarRosterSpecimen()
        .frame(height: 340)
        .argoAppearance()
}

// The half a still cannot carry: with movement off the step in progress has to sit at its full ink,
// where the same still with movement on catches it anywhere along the breath.
#Preview("PlanBar — with movement off") {
    PlanBarRosterSpecimen(isStill: true)
        .frame(height: 340)
        .argoAppearance()
}
