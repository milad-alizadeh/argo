import ArgoUI
import SwiftUI

/// The asking surface (#1317) — the three states of `docs/designs/backlog-question/`.
///
/// Its own file rather than more of `SpecimenRegistry+Tickets`, which is at `file_length`: these
/// three share one seeded question and one fixture, and they are the set `/pixel-review` shoots.
extension SpecimenRegistry {
    /// The question the three #1317 states are seeded with. Ends in a mark AND opens on an
    /// interrogative, so it reads as a question by either clause of the rule — a specimen should
    /// not be the only place a single clause is exercised.
    ///
    /// It is longer than the field, which is the point: the TAIL is what stays visible, because
    /// that is where the caret is.
    static let question = "which ticket is about spacing on the chart?"

    static let backlogQuestion: [SpecimenEntry] = [
        // The asking surface, #1317 — the three states of `docs/designs/backlog-question/`.
        //
        // The QUESTION is the seed in all three: the field reads it as one, so it wears the wand
        // and stands at `askWidth` rather than at 210. The plain-term states above are seeded the
        // same way and are unchanged by it, which is the point — the ask is found, never switched
        // to, and a reader who types a term meets exactly the field that shipped.
        //
        // `found` — the offer under the field, with Search still on the return key. The list is
        // the honest arithmetic for the query: `chart` matches nothing, and that empty stands
        // while the ask is being offered.
        SpecimenEntry("foundTicketsQuestion") {
            TicketsPanesSpecimen(
                reading: TicketsFixture.reading,
                seed: .init(query: Self.question),
            )
        },
        // `asking` — and what the wait must NOT do to the list. The rows behind the sheet are the
        // same rows `found` draws: not cleared, not dimmed, not moved. A reader who asks something
        // and watches their tickets vanish has lost what they were looking at to an answer that
        // has not arrived.
        SpecimenEntry("askingTicketsQuestion") {
            TicketsPanesSpecimen(
                reading: TicketsFixture.reading,
                seed: .init(query: Self.question, asking: .asking(question: Self.question)),
            )
        },
        // `answered` — prose over the ticket pane's CONTENT, with that pane's band still standing
        // above it. `Start` is reachable in this shot, which is the whole reason the sheet stops
        // where it does (#1242).
        SpecimenEntry("answeredTicketsQuestion") {
            TicketsPanesSpecimen(
                reading: TicketsFixture.reading,
                seed: .init(
                    query: Self.question,
                    asking: .answered(
                        question: Self.question,
                        prose: TicketsPanesSpecimen.prose,
                        read: true,
                    ),
                ),
            )
        },
    ]
}
