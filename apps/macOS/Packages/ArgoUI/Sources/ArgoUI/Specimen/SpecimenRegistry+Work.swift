import SwiftUI

/// The Work room (#812): the room at rest, its two room-level degradations, and the one mark it
/// spends on a Delivery.
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
    ]
}
