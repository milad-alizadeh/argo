import ArgoDesign
import SwiftUI

/// The TICKET pane's own header band: the `StartControl` pill at the pane's leading edge, and
/// nothing else (#1242).
///
/// **It keeps its band with no ticket open.** The pill goes — a verb addressing nobody must not be
/// one press away from being drawn — but the band stays, because a band that collapsed would move
/// every pane beside it on the first click of the day.
struct TicketPaneHeader: View {
    /// How far the band climbs into the window's strip, measured by the deck and handed down.
    var reach: CGFloat = 0
    /// The open ticket's verbs, and `nil` where the pane is open on nothing.
    var verbs: TicketsChromeIntents.Verbs?

    var body: some View {
        TicketsPaneHeader(reach: reach, inset: ArgoTicketDetail.inset) {
            if let verbs {
                StartControl(verbs: verbs)
            }
        }
    }
}

#Preview("Ticket pane header") {
    TicketPaneHeader(verbs: TicketsChromeIntents.Verbs(command: .implement))
        .frame(width: 480)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Ticket pane header — no ticket open, and the band stays") {
    TicketPaneHeader()
        .frame(width: 480)
        .argoDeckSurface()
        .argoAppearance()
}
