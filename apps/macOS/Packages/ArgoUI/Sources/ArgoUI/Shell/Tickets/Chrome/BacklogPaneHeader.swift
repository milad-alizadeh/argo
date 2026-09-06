import ArgoDesign
import SwiftUI

/// The LIST pane's own header band: New ticket at the pane's leading edge, the search field at its
/// trailing one (#1242).
///
/// Both act on the list, which is why both are here rather than in a window-wide row — a control
/// placed relative to the window's trailing edge and a pane whose leading edge the reader can drag
/// are two independent numbers, and they coincided by luck.
struct BacklogPaneHeader: View {
    /// How far the band climbs into the window's strip, measured by the deck and handed down.
    var reach: CGFloat = 0
    var creation = TicketsChromeIntents.Creation()
    /// What the list-scoped control is, and `nil` where it does not stand. **Absence and not a
    /// Bool**: the field goes with the list it searches, so an empty backlog loses it where New
    /// ticket survives — and every value the field needs is inside the thing that is absent,
    /// rather than sitting beside a flag that says to ignore them.
    var narrowing: Narrowing?

    /// Whether a render has asked for the field to open focused — see
    /// `BacklogSearchField.opensFocused`. Read off the environment rather than passed down the
    /// room: it is a property of the SHOT and not of the room, and a slot for it on every value
    /// between here and the window would be a slot the app must remember to leave false.
    @Environment(\.argoOpensSearchFocused) private var opensFocused

    /// Everything the field on this band holds (#1317). One value because it is one control's
    /// worth of state, and because the band's own slot list is at the 4-parameter cap.
    struct Narrowing {
        var query: Binding<String> = .constant("")
        /// How wide the list pane is right now — what bounds the field once it widens for a
        /// question, and what the offer under it takes its own width from.
        var pane: CGFloat = ArgoBacklogList.width
        /// The question this band can raise, and where the one in flight has got to.
        var asking = BacklogAsk()
        /// What the query has matched, and which tickets an ask would read instead.
        var counts = Counts()

        /// What the two lines of the offer count. A pair, because they are only meaningful
        /// together: the offer exists to state the difference between them.
        struct Counts {
            /// Rows the query itself matched.
            var matches = 0
            /// The room's listing, by number — what an ask reads, and what the offer counts. The
            /// numbers and not a count: the line the reader is shown and the set the question is
            /// asked over come off one array, so they cannot disagree.
            var listing: [Int] = []
        }
    }

    var body: some View {
        TicketsPaneHeader(reach: reach, inset: ArgoBacklogList.bandInsetX) {
            NewTicketButton(creation: creation)
        } trailing: {
            if let narrowing {
                field(narrowing)
            }
        }
    }

    private func field(_ narrowing: Narrowing) -> some View {
        BacklogSearchField(
            query: narrowing.query,
            pane: narrowing.pane,
            ask: { narrowing.asking.ask(narrowing.query.wrappedValue, narrowing.counts.listing) },
            opensFocused: opensFocused,
        )
        // Hung off the FIELD and not the band, which is what makes it move with the pane's seam
        // rather than with the window (#1242): its top edge sits `snug` below the field's bottom.
        //
        // TOP-aligned and pushed down by the field's own height, NOT bottom-aligned with an
        // alignment guide. The guide was tried and the render showed why it cannot work here: an
        // overlay's guide is resolved against the host's, so the offer bottom-aligned to the field
        // and grew UPWARD — covering the field it belongs to and running off the top of the
        // window. The field is one known height (`ArgoControlBox.vessel`, #1242), so the drop is
        // arithmetic rather than a guide.
        .overlay(alignment: .topTrailing) {
            if offers(narrowing) {
                BacklogAskAffordance(
                    matches: narrowing.counts.matches,
                    reads: narrowing.counts.listing.count,
                )
                .frame(width: ArgoTicketsChrome.askWidth(inPaneOf: narrowing.pane))
                .offset(y: ArgoControlBox.vessel + ArgoSpacing.snug)
            }
        }
    }

    /// Whether the offer stands: the field is holding a question, and no question is already in
    /// flight. It is NOT gated on focus — a reader who typed a question and looked away has not
    /// stopped meaning it, and an offer that vanished on focus would be one they could never read.
    private func offers(_ narrowing: Narrowing) -> Bool {
        narrowing.asking.state == .unasked
            && BacklogQueryIntentProjection.kind(of: narrowing.query.wrappedValue) == .question
    }
}

#Preview("Backlog pane header") {
    BacklogPaneHeader(narrowing: BacklogPaneHeader.Narrowing())
        .frame(width: ArgoBacklogList.width)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Backlog pane header — an empty backlog keeps New ticket") {
    BacklogPaneHeader()
        .frame(width: ArgoBacklogList.width)
        .argoDeckSurface()
        .argoAppearance()
}
