import SwiftUI

/// The assembled deck, and the two things that ride over it without being the reading: the plan
/// pill and the floating controls.
extension SpecimenRegistry {
    static let deck: [SpecimenEntry] = [
        SpecimenEntry("deck") { DeckSpecimen() },
        // The shell, not `SessionsDeck` — the assembled container is the plane plus its zones.
        SpecimenEntry("sessionsDeck") { InstrumentDeckShell(room: .sessions) },
        // The reading has to be long enough to reach the chrome bar, or there is nothing behind it
        // to blur and the entry proves only that a bar was drawn.
        SpecimenEntry("deckCanopy") {
            SpecimenScene.sessions(FeedProjection.longRows, held: FeedProjection.longHeldRowID)
        },
        // A shipping gate: the bar with the optical response gone, header and all.
        SpecimenEntry("flatDeckCanopy") {
            SpecimenScene.sessions(FeedProjection.longRows, held: FeedProjection.longHeldRowID)
                .argoWithoutTransparency()
        },
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
