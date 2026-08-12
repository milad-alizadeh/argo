import SwiftUI

/// The assembled deck, and the two things that ride over it without being the reading: the plan
/// pill and the floating controls.
extension SpecimenRegistry {
    static let deck: [SpecimenEntry] = [
        SpecimenEntry("deck") { DeckSpecimen() },
        // The shell, not `SessionsDeck` — the assembled container is the plane plus its zones.
        SpecimenEntry("sessionsDeck") { InstrumentDeckShell(room: .sessions) },
        SpecimenEntry("planPill") { PlanSpecimen(plan: PlanFixture.working) },
        // Reachable only by hovering or tabbing.
        SpecimenEntry("openPlanPill") {
            PlanSpecimen(plan: PlanFixture.working, isRevealed: true)
        },
        SpecimenEntry("unstartedPlanPill") {
            PlanSpecimen(plan: PlanFixture.unstarted, isRevealed: true)
        },
        SpecimenEntry("floatingControls") { FloatingControlsSpecimen() },
        // A shipping gate: the three stay legible and pressable with the optical response gone.
        SpecimenEntry("flatFloatingControls") { FloatingControlsSpecimen(isFlat: true) },
    ]
}
