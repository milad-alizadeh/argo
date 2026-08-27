import SwiftUI

/// The compose call-to-action, in a vessel of its own at the leading edge of the ticket column. It
/// SURVIVES the empty backlog where the vessel beside it does not, so the two cannot share one.
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
