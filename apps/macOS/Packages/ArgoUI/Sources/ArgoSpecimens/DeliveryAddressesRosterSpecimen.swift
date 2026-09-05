import ArgoDesign
import ArgoEngine
import ArgoUI
import SwiftUI

/// The addresses `SessionRow` draws at the trailing edge of line 3 (#1346,
/// `cockpit-roster-row.md` — `DeliveryAddresses`): an open pull request, a merged one, a closed
/// one, a draft, and a row with neither address at all.
struct DeliveryAddressesRosterSpecimen: View {
    static var rows: [SessionRosterProjection.Row] {
        SessionRosterProjection.rows(from: sessions)
    }

    /// Anchored to the render's own moment, the way the other roster specimens' ages are.
    private static let nowMs = Date().epochMs

    private static var sessions: [CockpitPresentation.Session] {
        [
            session(
                id: "open", title: "The rail reads the Subagents’ own records",
                ticket: 1269, pullRequest: .fixture(number: 1312, state: "open"),
            ),
            session(
                id: "merged", title: "Retire Electron, set new design foundations",
                ticket: 1289,
                pullRequest: .fixture(number: 1291, state: "closed", isMerged: true),
            ),
            session(
                id: "closed", title: "A prototype variant that did not land",
                ticket: 1310, pullRequest: .fixture(number: 1320, state: "closed"),
            ),
            session(
                id: "draft", title: "Draft: the Atlas volume experiment",
                ticket: 1150,
                pullRequest: .fixture(number: 1369, state: "open", isDraft: true),
            ),
            session(
                id: "neither", title: "A Session with no Ticket and no pull request",
                ticket: nil, pullRequest: nil,
            ),
        ]
    }

    private static func session(
        id: String, title: String, ticket: Int?, pullRequest: DeliveryPullRequest?,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: id,
            title: title,
            access: .managed,
            status: .idle,
            chain: .init(span: .init(lastSeenAtMs: nowMs - 3 * 60 * 60 * 1000)),
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(kind: .main, branch: "argo/#\(id)"),
                ticket: ticket.map { .linked(.init(number: $0)) } ?? .unread,
                delivery: .init(pullRequest: pullRequest),
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

#Preview("Delivery addresses — open, merged, closed, draft, neither") {
    DeliveryAddressesRosterSpecimen()
        .frame(height: 340)
        .argoAppearance()
}
