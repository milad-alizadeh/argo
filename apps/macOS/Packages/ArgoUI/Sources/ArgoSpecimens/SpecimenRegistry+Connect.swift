import ArgoUI
import SwiftUI

/// The Connect flow's states: the way in, the panel in each shape it takes, and the chips the
/// window carries when a connection has gone bad.
///
/// The panel's states and the chips' are MAPPED from their fixtures. A state is added to the
/// fixture list and is renderable from that one edit, with no second list to drift from.
extension SpecimenRegistry {
    static let connect: [SpecimenEntry] = [
        // The first thing a new user sees, and the one screen here that asks for nothing. What it
        // has to settle is that three promises read as promises rather than as a feature grid, and
        // that nothing on it needs a tier explained first.
        SpecimenEntry("welcome") { SpecimenScene.centred { WelcomeScreen(start: {}) } },
        // Argo's own blindness, with every provider healthy: the state §8 governs, and the one
        // state of this chip nothing else in the deck renders.
        SpecimenEntry("observationFailed") {
            SpecimenScene.centred {
                SpecimenScene.observationChip(.failed(message: "Transcript unavailable"))
            }
        },
    ] + panels + chips

    private static let panels: [SpecimenEntry] = ConnectFixture.states.map { state in
        SpecimenEntry(state.name) {
            SpecimenScene.centred { ConnectPanel(reading: state.reading, actions: .inert) }
        }
    }

    /// One chip per level a connection fails at: a provider waited out, two rolled up to a count,
    /// and a grant that needs obtaining again — named, and with the one act on it.
    private static let chips: [SpecimenEntry] = ConnectionHealthSpecimen.states.map { state in
        SpecimenEntry(state.name) {
            SpecimenScene.centred { SpecimenScene.connectionChips(state.reading) }
        }
    }
}
