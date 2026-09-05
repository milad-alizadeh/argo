import ArgoDesign
import ArgoEngine
import ArgoFixtures
import ArgoUI
import SwiftUI

/// The badge slot's `Ready` reading (#1335, `cockpit-roster-row.md` — decisions 6 and 7): a
/// Session whose claim stands and draws, one whose claim is stale because its branch already
/// has an open pull request and so draws nothing, and an ordinary row beside them for contrast.
struct ReadyToShipRosterSpecimen: View {
    static var rows: [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: sessions)
    }

    private static let nowMs = Date().epochMs

    private static var sessions: [CockpitPresentation.Session] {
        [
            session(
                id: "ready", title: "Add the fourth companion tool",
                delivery: .init(claim: claim), plan: finished,
            ),
            // The claim is HELD here too, and the row still draws no word: the pull request is
            // open, and the projection resolves the pair (decision 7). Same claim and the same
            // finished Plan as the row above, so the pull request is the only thing the badge
            // slot answers to differently.
            session(
                id: "stale", title: "Draw the Ready badge on the roster row",
                delivery: .init(pullRequest: .fixture(number: 1400, state: "open"), claim: claim),
                plan: finished,
            ),
            session(
                id: "unclaimed", title: "Nothing claimed yet",
                delivery: .init(), plan: partDone,
            ),
        ]
    }

    /// The claim as the channel delivered it, reason and all — the roster draws none of the
    /// reason, and the feed is where that is read (`FeedMark.readyToShip`).
    private static let claim = CompanionReady(reason: "3 files, 2 commits")

    /// A Session that says it is ready reads as a FULL Plan bar with no pull request mark beside
    /// it (`cockpit-roster-row.md`, the `ready` state) — the shape says it before the word does,
    /// so the specimen has to carry the shape or it renders half the state.
    private static let finished: [(String, PlanEntryStatus)] = [
        ("Read the anatomy study in full", .completed),
        ("Add the fourth companion tool", .completed),
        ("Fold the claim into the report", .completed),
        ("Resolve it against the pull request", .completed),
        ("Draw it in the badge slot", .completed),
        ("Independent review, then PR", .completed),
    ]

    /// A Plan that stopped part-way, so the contrast row's bar is visibly short of the two above
    /// it. Every Session here is `idle`, so all three bars draw at `progress.still` (rule 3) and
    /// the only thing separating them is how far the fill got — which is the comparison the
    /// fixed 64pt width exists to make.
    private static let partDone: [(String, PlanEntryStatus)] = [
        ("Read the anatomy study in full", .completed),
        ("Implement the projection seam", .inProgress),
        ("Independent review, then PR", .pending),
    ]

    /// Takes the `Delivery` group whole, as `Work.Delivery` does and for its stated reason.
    private static func session(
        id: String,
        title: String,
        delivery: CockpitPresentation.Session.Work.Delivery,
        plan: [(String, PlanEntryStatus)],
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: id,
            title: title,
            access: .managed,
            status: .idle,
            chain: .init(span: .init(lastSeenAtMs: nowMs - 3 * 60 * 1000)),
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(kind: .main, branch: "argo/#\(id)"),
                delivery: delivery,
            ),
            transcript: .init(events: [TranscriptFixtures.plan(plan)]),
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

#Preview("Ready to ship — drawn, stale behind an open pull request, and neither") {
    ReadyToShipRosterSpecimen()
        .frame(height: 220)
        .argoAppearance()
}
