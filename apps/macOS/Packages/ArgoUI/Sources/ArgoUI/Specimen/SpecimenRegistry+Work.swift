import SwiftUI

/// The Work room: the room at rest, its two room-level degradations, the one mark it spends on a
/// Delivery (#812), the ticket pane's own states (#815) and the toolbar row's three (#816).
extension SpecimenRegistry {
    static let work: [SpecimenEntry] = [
        SpecimenEntry("workRoom") { WorkRoomSpecimen() },
        // Nothing bound: no views, no list, no ticket. Distinct from the entry below, and
        // deliberately so — conflating the two tells a reader their backlog is empty when in fact
        // nobody asked.
        SpecimenEntry("unboundWorkRoom") { WorkPanesSpecimen(reading: WorkFixture.unbound) },
        // The provider answered, and the answer was nothing: the views stay, all reading zero.
        SpecimenEntry("emptyWorkBacklog") { WorkPanesSpecimen(reading: WorkFixture.answeredEmpty) },
        // The view is what the DECK draws, not just a number in the rail — the one render that
        // shows the sidebar's selection reaching the pane beside it.
        SpecimenEntry("blockedWorkView") {
            WorkPanesSpecimen(reading: WorkFixture.reading, opening: .blocked)
        },
        SpecimenEntry("deliveryDots") { DeliveryDotsSpecimen() },
        // A parent, deep: two Deliveries stacked, nine children rolled up over the five that are
        // open, and six blockers of which four are already closed and still named.
        SpecimenEntry("deepTicket") {
            TicketDetailSpecimen(reading: WorkFixture.reading(showing: 607))
        },
        // `deep.png` is a WHOLE-room shot, so the pane above is not the whole of it: this opens
        // the room on the same parent.
        SpecimenEntry("deepWorkRoom") {
            WorkPanesSpecimen(reading: WorkFixture.reading(showing: 607))
        },
        // A provider that exposes no dependency edges. The `Blocked by` section is ABSENT, not
        // empty — nobody has told us there are no blockers.
        SpecimenEntry("edgelessTicket") { TicketDetailSpecimen(reading: WorkFixture.edgeless) },
        SpecimenEntry("deliveryChips") { DeliveryChipsSpecimen() },
        // The fact strip's floor: a ticket the provider named and said nothing else about. Every
        // absent fact is left out, and Argo's own bucket is the one that survives.
        SpecimenEntry("unreadTicket") { TicketDetailSpecimen(reading: WorkFixture.unread) },
        // The toolbar row alone, in its three states (#816). At rest it is read off `workRoom`
        // above, over the panes it places its controls against; these two are the vacancies, which
        // differ in nothing BUT the row.
        SpecimenEntry("workToolbar") { WorkToolbarSpecimen(reading: WorkFixture.reading) },
        SpecimenEntry("emptyWorkToolbar") {
            WorkToolbarSpecimen(reading: WorkFixture.answeredEmpty)
        },
        SpecimenEntry("unboundWorkToolbar") { WorkToolbarSpecimen(reading: WorkFixture.unbound) },
    ]
}
