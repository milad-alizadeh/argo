import SwiftUI

/// The room's half of the asking surface (#1317) — what the sheet draws, and what the field on the
/// band above the list is handed.
///
/// Its own file rather than more of `TicketsRoom`, which is at `type_body_length`: the room's job
/// is the two panes and the values above them, and a question is one thing those panes now carry
/// rather than another pane.
@MainActor
extension TicketsRoom {
    /// The answer, over the ticket pane's content — the wait as well as the prose, because the
    /// wait is where the reader spends most of a four-to-eleven-second interaction (#1315).
    ///
    /// **The list is neither cleared nor dimmed while this stands.** It still holds the honest
    /// answer to the query, and the question has not answered anything yet: a reader who asks
    /// something and watches their tickets vanish has lost what they were looking at to an answer
    /// that has not arrived. Nothing here reaches the list, which is how that stays true.
    ///
    /// **ONE `BacklogAnswerSheet`, built from one value.** Drawn as two branches of a `switch` it
    /// was two views to SwiftUI: the prose landing replaced the sheet rather than filling it, so
    /// `risen` reset and the whole thing re-rose under the reader — the one thing the sheet's own
    /// head exists to prevent. The state's `question` and `prose` are read off one case each so
    /// the identity cannot depend on which state it is in.
    @ViewBuilder var answer: some View {
        if let question = held.field.asking.state.question {
            BacklogAnswerSheet(
                question: question,
                reads: held.field.listing.count,
                prose: held.field.asking.state.prose,
                wasRead: held.field.asking.state.wasRead,
                stop: held.field.asking.stop,
                close: held.field.asking.close,
                // The same question, off the sheet's own foot — the one act that does not need
                // the field, since the question is on the sheet in front of the reader.
                again: { held.field.asking.ask(question, held.field.listing) },
            )
        }
    }

    /// What the band's field is handed, in a list pane of `pane` points.
    ///
    /// `matches` comes off the same room value the heading counts from, so the offer's line and
    /// the heading's `n results` can never be two answers about one list; `listing` comes down
    /// from above the room, where it was taken off the reading the rows were built from.
    func narrowing(in pane: CGFloat) -> BacklogPaneHeader.Narrowing {
        BacklogPaneHeader.Narrowing(
            query: held.field.query,
            pane: pane,
            asking: held.field.asking,
            counts: BacklogPaneHeader.Narrowing.Counts(
                matches: room.narrowing?.matches ?? 0,
                listing: held.field.listing,
            ),
        )
    }
}
