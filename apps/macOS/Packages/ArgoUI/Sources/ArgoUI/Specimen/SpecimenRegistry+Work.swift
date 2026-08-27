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
        SpecimenEntry("deliveryDots") { DeliveryDotsSpecimen() },
    ]
}
