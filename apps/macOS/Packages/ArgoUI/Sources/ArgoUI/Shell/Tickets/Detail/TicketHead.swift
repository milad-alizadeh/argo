import ArgoDesign
import ArgoEngine
import SwiftUI

/// The ticket's head: id, title, the status pair, then which live Session is on it (#1092).
/// Title-FIRST — no scope badge and no produced-by field (#272), because the largest line in the
/// pane should be the thing the pane is about.
package struct TicketHead: View {
    @Environment(\.argo) private var argo

    let ticket: TicketsRoomProjection.Detail
    /// Opens the Sessions room on the Session a claimant line was pressed for. Inert by default,
    /// so a preview and a specimen draw the head without reaching for the shell.
    var openSession: (CockpitPresentation.Session.ID) -> Void = { _ in }

    package var body: some View {
        VStack(alignment: .leading, spacing: ArgoTicketDetail.headStep) {
            Text("#\(ticket.id)")
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
            Text(ticket.title)
                .argoText(ArgoTypography.sessionTitle)
                .fixedSize(horizontal: false, vertical: true)
            StatusPair(word: ticket.status, bucket: ticket.bucket)
            TicketClaimantLine(claimants: ticket.claimants, openSession: openSession)
        }
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        ticket: TicketsRoomProjection.Detail,
        openSession: @escaping (CockpitPresentation.Session.ID) -> Void = { _ in },
    ) {
        self.ticket = ticket
        self.openSession = openSession
    }
}
