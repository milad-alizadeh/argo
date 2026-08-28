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
        SpecimenEntry("deliveryDots") { DeliveryDotsSpecimen() },
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
