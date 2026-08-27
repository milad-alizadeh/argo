import SwiftUI

/// The compose call-to-action, in a vessel of its own at the leading edge of the ticket column.
///
/// Its own vessel and not a segment of the one beside it: the ticket's verbs act on a ticket that
/// already exists, and this one makes a new one. It is also the control that SURVIVES the empty
/// backlog — that is the moment you most want it — so a shared capsule would have to lose a segment
/// exactly where the row is at its emptiest.
struct NewTicketButton: View {
    var act: () -> Void = {}

    var body: some View {
        ToolbarVessel {
            ToolbarIcon(symbol: ArgoSymbol.newTicket, label: "New ticket", act: act)
        }
    }
}

#Preview("New ticket button") {
    NewTicketButton()
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
