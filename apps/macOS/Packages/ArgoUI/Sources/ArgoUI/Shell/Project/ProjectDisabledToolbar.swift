import SwiftUI

/// What the window's bar carries while the Project is disabled: the Project vessel, and nothing
/// else.
///
/// Not `ShellToolbar`. New Session is refused in a folder that is not there, and no room is open
/// for an evidence panel to belong to — a second thing to read on a screen whose whole claim is
/// that there is ONE thing wrong.
///
/// The Project vessel stays because it is the only way to another Project: a reader trapped on the
/// error state of one Project could not switch to a Project that is fine.
struct ProjectDisabledToolbar: ToolbarContent {
    package let reading: ProjectVesselReading
    package let rows: [ProjectMenuProjection.Row]
    let actions: CockpitActions

    var body: some ToolbarContent {
        ToolbarItem(placement: .navigation) {
            ProjectVessel(reading: reading, rows: rows, actions: actions)
        }
    }
}

extension ProjectDisabledToolbar {
    /// Projected here rather than handed in, on `ScopeVessel`'s own terms: nothing below a bar
    /// reads a presentation.
    init(presentation: CockpitPresentation, actions: CockpitActions) {
        self.init(
            reading: ProjectVesselReading(presentation: presentation),
            rows: ProjectMenuProjection.rows(from: presentation),
            actions: actions,
        )
    }
}
