import SwiftUI

/// What the window becomes when the Project itself has gone bad. One state, because a missing
/// folder disables the Project whole (failure spec §6).
extension SpecimenRegistry {
    static let project: [SpecimenEntry] = [
        // The WHOLE window, through the same view the app builds, rather than the error state on
        // its own: what has to be settled is that no room, no roster and no rail is left lit
        // beside it, and that the toolbar's scope vessel is still the way to a Project that is
        // fine. `ProjectDisabledScreen`'s own `#Preview` is the close read of the panel.
        SpecimenEntry("projectDisabled") { RosterSpecimen(presentation: .unreachablePreview) },
    ]
}
