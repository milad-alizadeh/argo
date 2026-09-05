import ArgoDesign
import ArgoEngine
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
            // open, and the projection resolves the pair (decision 7). It carries the SAME
            // finished Plan as the row above, so the only difference between the two rows is
            // the pull request — which is the one fact this specimen exists to show.
            session(
                id: "stale", title: "Draw the Ready badge on the roster row",
                delivery: .init(pullRequest: .fixture(number: 1400, state: "open"), claim: claim),
                plan: finished,
            ),
            session(
                id: "running", title: "Nothing claimed yet",
                delivery: .init(), plan: midFlight,
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

    /// The contrast row is mid-flight, which is what a Session with nothing to claim looks like.
    private static let midFlight: [(String, PlanEntryStatus)] = [
        ("Read the anatomy study in full", .completed),
        ("Implement the projection seam", .inProgress),
        ("Independent review, then PR", .pending),
    ]

    /// Takes the `Delivery` group whole rather than the pull request and the claim apart, which
    /// is the same grouping the production type makes (`Work.Delivery`, #1335) and for the same
    /// reason: the pair resolves in one place, so no fixture here can state the one the design
    /// forbids — a drawn `Ready` beside an open pull request.
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
            transcript: .init(events: [
                .plan(Plan(entries: plan.map { PlanEntry(text: $0.0, status: $0.1) })),
            ]),
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
