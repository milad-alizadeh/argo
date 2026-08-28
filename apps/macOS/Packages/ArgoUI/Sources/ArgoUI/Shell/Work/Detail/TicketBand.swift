import ArgoEngine
import SwiftUI

/// The open ticket's own controls, at the head of the pane that draws it — New ticket, then the
/// verbs that act on what is open (#836).
///
/// Mail's placement, taken literally: compose at the leading edge of the message column, the
/// message's verbs after it. In the pane rather than the window's row for the reason
/// `cockpit-work-room.md` settles under the column question (#836).
///
/// The band is the same height as the list's beside it, so both panes' content starts on one line.
struct TicketBand: View {
    let reading: WorkChromeProjection.Reading
    var intents = WorkToolbarIntents.inert
    /// The Mode a Session would start in. Held above the room, because the choice outlives the
    /// ticket it was made on.
    var mode: Binding<SessionMode> = .constant(.code)

    var body: some View {
        HStack(spacing: ArgoSpacing.comfortable) {
            if reading.draws {
                NewTicketButton(creation: intents.creation)
                // The verbs address the ticket the deck is OPEN on. With none open there is
                // nothing for Start, open-on-host or copy link to name, and the vessel goes rather
                // than standing there addressing nobody.
                if reading.ticket != nil {
                    StartControl(verbs: intents.verbs, mode: mode)
                }
            }
            Spacer(minLength: ArgoSpacing.flush)
        }
        .padding(.horizontal, ArgoTicketDetail.bandInsetX)
        .frame(minHeight: ArgoTicketDetail.bandHeight)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Ticket actions")
    }
}

#Preview("Ticket band") {
    TicketBand(
        reading: WorkChromeProjection.reading(of: WorkFixture.room, in: .allOpen, showing: 272),
    )
    .frame(width: ArgoTicketDetail.idealWidth)
    .argoDeckSurface()
    .argoAppearance()
}

// Nothing open in the pane below, so the call-to-action stands alone: it is the one control here
// that belongs to no ticket.
#Preview("Ticket band — nothing open") {
    TicketBand(
        reading: WorkChromeProjection.reading(of: WorkFixture.room, in: .allOpen, showing: nil),
    )
    .frame(width: ArgoTicketDetail.idealWidth)
    .argoDeckSurface()
    .argoAppearance()
}
