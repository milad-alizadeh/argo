import SwiftUI

/// The compose call-to-action, in a vessel of its own at the leading edge of the row — Mail's
/// compose button, in Mail's place and wearing Mail's mark (#836). It is the ONE thing this window
/// creates, which is what earns the compose mark: New Session is not in the Work room's row.
///
/// It SURVIVES the empty backlog where the vessel beside it does not, so the two cannot share one.
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
