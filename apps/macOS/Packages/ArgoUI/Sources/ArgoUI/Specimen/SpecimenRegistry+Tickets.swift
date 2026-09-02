import SwiftUI

/// The Tickets room (#812, #815, #816, #817, #818): the room at rest, its two vacancies, the
/// ticket's own states, the hero's tiers, the marks it spends on a Delivery, and the toolbar row's
/// three.
extension SpecimenRegistry {
    static let tickets: [SpecimenEntry] = [
        SpecimenEntry("ticketsRoom") { TicketsRoomSpecimen() },
        // Nothing bound: the room hides WHOLE — no sidebar, no list, no ticket, and a panel saying
        // nothing has been read rather than that there is nothing. `unbound.png`.
        SpecimenEntry("unboundTicketsRoom") { TicketsPanesSpecimen(reading: TicketsFixture.unbound)
        },
        // The provider answered, and the answer was nothing: the sidebar and its views stay, all
        // reading zero, and the deck says WHO answered. `empty.png`. The pair is the point — either
        // page alone lets a reader read "empty backlog" off a room nobody asked (#818).
        SpecimenEntry("emptyTicketsBacklog") {
            TicketsPanesSpecimen(reading: TicketsFixture.answeredEmpty)
        },
        // The view is what the DECK draws, not just a number in the rail — the one render that
        // shows the sidebar's selection reaching the pane beside it.
        SpecimenEntry("blockedTicketsView") {
            TicketsPanesSpecimen(reading: TicketsFixture.reading, seed: .init(opening: .blocked))
        },
        // The fifth view (#1075): a list nothing else in the room can reach. It is FLAT and in
        // last-touched order — no priority headers, which is the one place the room's own
        // structure changes — and every row states its own closure, so `resolved` and `ruled out`
        // are two answers rather than one word.
        SpecimenEntry("closedTicketsView") {
            TicketsPanesSpecimen(
                reading: TicketsFixture.closedRead, seed: .init(opening: .closed),
            )
        },
        // …and with a page behind it, which is the only state that draws `Load more`. Its own
        // render because the row is the whole bound made visible: it is drawn on the provider's
        // cursor and goes when the provider serves the last page.
        SpecimenEntry("closedTicketsMore") {
            TicketsPanesSpecimen(
                reading: TicketsFixture.closedMore, seed: .init(opening: .closed),
            )
        },
        // The `Closed` view before its own read has landed. The count is ABSENT rather than zero
        // and the deck says nothing has been read — opening onto `0` is the number that tells a
        // reader they have finished nothing, and nobody asked.
        SpecimenEntry("unreadClosedTickets") {
            TicketsPanesSpecimen(reading: TicketsFixture.reading, seed: .init(opening: .closed))
        },
        // The hero's three degraded tiers and its one-chip state (#817). Each is its own reading
        // rather than its own card: the tier is arithmetic over the backlog, so a specimen that
        // handed the card a literal would prove the card and not the room.
        SpecimenEntry("nothingUnblocked") {
            TicketsPanesSpecimen(reading: TicketsFixture.poolBlocked)
        },
        SpecimenEntry("everythingRunning") {
            TicketsPanesSpecimen(reading: TicketsFixture.poolRunning)
        },
        SpecimenEntry("oneEarnedChip") { TicketsPanesSpecimen(reading: TicketsFixture.oneChip) },
        // A parent FOLDED, open in the pane beside it (#814): the twist shut, its roll-up standing
        // in for the five rows it is holding, and the Children section naming them anyway. It is
        // seeded rather than clicked because everything opens open.
        SpecimenEntry("collapsedTicketsBacklog") {
            TicketsPanesSpecimen(
                reading: TicketsFixture.reading(showing: 607),
                seed: .init(folded: [607]),
            )
        },
        // A query narrowing the list (#873): #336 matched, and the two parents it hangs from are
        // kept as RAILS — demoted titles, and not counted in the `1 result` above them. The state
        // is seeded because the harness cannot type into the field.
        SpecimenEntry("searchedTicketsBacklog") {
            TicketsPanesSpecimen(reading: TicketsFixture.reading, seed: .init(query: "canvas"))
        },
        // The query matched nothing, which is a fact about the QUERY: the stated empty is inside
        // the list pane and the row of controls stands, so the field can still be cleared.
        SpecimenEntry("unmatchedTicketsBacklog") {
            TicketsPanesSpecimen(reading: TicketsFixture.reading, seed: .init(query: "kubernetes"))
        },
        // Two live Sessions Argo could not place on a ticket (#894, amended #1074): `In progress`
        // draws its count AND what it is short by.
        SpecimenEntry("unjoinedTicketsProgress") {
            TicketsPanesSpecimen(reading: TicketsFixture.unjoinedClaims)
        },
        // The other half of that pair: NOBODY could read a link, so no join happened and the count
        // is absent with no shortfall beside it. What separates the two is what a reader has to be
        // able to see, so both are rendered.
        SpecimenEntry("unreadTicketsProgress") {
            TicketsPanesSpecimen(reading: TicketsFixture.unreadClaims)
        },
        // The claim mark on the row (#1074). #272 is claimed AND blocked here, which is the row no
        // other reading reaches.
        SpecimenEntry("claimedTicketsBacklog") {
            TicketsPanesSpecimen(reading: TicketsFixture.claimedAndBlocked)
        },
        // The same claim, read in a view that is not `In progress`. The mark is a fact about the
        // TICKET, so a reader scrolling `Blocked` sees it too — and `All open` alone cannot show
        // that.
        SpecimenEntry("claimedBlockedView") {
            TicketsPanesSpecimen(
                reading: TicketsFixture.claimedAndBlocked,
                seed: .init(opening: .blocked),
            )
        },
        // A ticket whose blocker was RULED OUT (#896). The mark carries the same count and spends
        // `state.failure` on it, because this one never clears itself — every other blocked row in
        // the room is waiting on something that can still land.
        SpecimenEntry("strandedTicketsBacklog") {
            TicketsPanesSpecimen(reading: TicketsFixture.stranded)
        },
        // A provider that served no dependency edges AT ALL, in the LIST (#896). Every row draws
        // the same nothing an unblocked row draws, which is the point: the row does not claim
        // `unblocked` over a reading nobody made, and only the sidebar — which can see the whole
        // set — is allowed to tell the two silences apart, by counting neither view.
        SpecimenEntry("edgelessTicketsBacklog") {
            TicketsPanesSpecimen(reading: TicketsFixture.edgeless)
        },
        SpecimenEntry("blockageMarks") { BlockageMarksSpecimen() },
        // The hero is a control now (#898), and hover and press are live input: this is the one
        // render that shows either. At rest carries the chevron, which is what says so before a
        // pointer arrives.
        SpecimenEntry("nextUpPointer") { SpecimenScene.centred { NextUpPointerSpecimen() } },
        // The room's Start, saying what it will send before it is pressed (#899) — and the ticket
        // that asks for nothing, which no fixture reaches on its own.
        SpecimenEntry("ticketStart") { SpecimenScene.centred { TicketStartSpecimen() } },
        SpecimenEntry("deliveryDots") { DeliveryDotsSpecimen() },
        // The head's status pair, over a provider whose word IS the filing and one with words of
        // its own (#893). Every fixture spells "In progress", so no room render reaches the first.
        SpecimenEntry("statusPair") { SpecimenScene.centred { StatusPairSpecimen() } },
        // A parent, deep: two Deliveries stacked, nine children rolled up over the five that are
        // open, and six blockers of which four are already closed and still named.
        SpecimenEntry("deepTicket") {
            TicketDetailSpecimen(reading: TicketsFixture.reading(showing: 607))
        },
        // `deep.png` is a WHOLE-room shot, so the pane above is not the whole of it: this opens
        // the room on the same parent.
        SpecimenEntry("deepTicketsRoom") {
            TicketsPanesSpecimen(reading: TicketsFixture.reading(showing: 607))
        },
        // A provider that exposes no dependency edges. The `Blocked by` section is ABSENT, not
        // empty — nobody has told us there are no blockers.
        SpecimenEntry("edgelessTicket") { TicketDetailSpecimen(reading: TicketsFixture.edgeless) },
        SpecimenEntry("deliveryChips") { DeliveryChipsSpecimen() },
        // A CLOSED ticket, open in the pane (#895). It is in no listing and no sidebar view, so the
        // only way here is a link — and the head sets the provider's `Closed` beside Argo's own
        // `resolved`, which is the pair #893 exists to draw.
        SpecimenEntry("closedTicket") {
            TicketDetailSpecimen(reading: TicketsFixture.reading(showing: 264))
        },
        // A link followed to a number nothing has been read for: while the read is in flight, and
        // after one that came back with nothing. Not an empty pane, which means "nothing selected".
        SpecimenEntry("unreadTicketNumber") {
            TicketDetailSpecimen(reading: TicketsFixture.reading(showing: 9001))
        },
        // The fact strip's floor: a ticket the provider named and said nothing else about. Every
        // absent fact is left out, and Argo's own bucket is the one that survives.
        SpecimenEntry("unreadTicket") { TicketDetailSpecimen(reading: TicketsFixture.unread) },
        // The room's chrome alone, in its three states — the window's one row of controls over the
        // heading the list keeps. At rest it is read off `ticketsRoom` above; these two are the
        // vacancies, which differ in nothing BUT the chrome.
        SpecimenEntry("ticketsChrome") { TicketsChromeSpecimen(reading: TicketsFixture.reading) },
        SpecimenEntry("emptyTicketsChrome") {
            TicketsChromeSpecimen(reading: TicketsFixture.answeredEmpty)
        },
        SpecimenEntry("unboundTicketsChrome") {
            TicketsChromeSpecimen(reading: TicketsFixture.unbound)
        },
        // The row over a query that matched NOTHING. The list is empty and the three controls that
        // narrow it stand anyway — a field that removed itself here is one nobody could clear.
        SpecimenEntry("unmatchedTicketsChrome") {
            TicketsChromeSpecimen(reading: TicketsFixture.reading, matching: "kubernetes")
        },
        // What New ticket opens (#872): two fields and one act, at the panel's own width. Empty,
        // which is the state it is met in — a typed one is the same sheet with prose in it.
        SpecimenEntry("newTicketComposer") { NewTicketComposerSpecimen() },
    ] + writeControls

    /// The room's one provider-port write control, in each state a failing write leaves it in
    /// (#275). Mapped from the fixture list, so a state is added by adding a row to it.
    private static let writeControls: [SpecimenEntry] = WriteControlSpecimen.states.map { state in
        SpecimenEntry(state.name) {
            SpecimenScene.centred {
                // The repair is inert but PRESENT: §7 makes the disabled reading point at a
                // Reconnect, so a render without it would prove the wrong shape.
                NewTicketButton(
                    creation: TicketsToolbarIntents.Creation(control: state.control, reconnect: {}),
                )
            }
        }
    }
}
