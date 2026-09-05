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
                pullRequest: nil, claim: claim,
            ),
            // The claim is HELD here too, and the row still draws no word: the pull request is
            // open, and the projection resolves the pair (decision 7).
            session(
                id: "stale", title: "Draw the Ready badge on the roster row",
                pullRequest: .fixture(number: 1400, state: "open"), claim: claim,
            ),
            session(
                id: "running", title: "Nothing claimed yet",
                pullRequest: nil, claim: nil,
            ),
        ]
    }

    /// The claim as the channel delivered it, reason and all — the roster draws none of the
    /// reason, and the feed is where that is read (`FeedMark.readyToShip`).
    private static let claim = CompanionReady(reason: "3 files, 2 commits")

    private static func session(
        id: String, title: String, pullRequest: DeliveryPullRequest?, claim: CompanionReady?,
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
                delivery: .init(pullRequest: pullRequest, claim: claim),
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

#Preview("Ready to ship — drawn, stale behind an open pull request, and neither") {
    ReadyToShipRosterSpecimen()
        .frame(height: 220)
        .argoAppearance()
}
