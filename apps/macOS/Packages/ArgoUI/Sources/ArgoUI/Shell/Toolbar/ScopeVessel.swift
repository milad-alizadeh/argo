import ArgoDesign
import SwiftUI

/// This Project, as one control on the toolbar (#1232).
///
/// No glass of its own: the single toolbar item hosting it supplies that, and one capsule around
/// the Project is the whole claim.
package struct ScopeVessel: View {
    let project: ProjectVesselReading
    /// The menu hangs off the Project, so its rows arrive with it.
    package let rows: [ProjectMenuProjection.Row]
    let actions: CockpitActions

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        project: ProjectVesselReading,
        rows: [ProjectMenuProjection.Row],
        actions: CockpitActions,
    ) {
        self.project = project
        self.rows = rows
        self.actions = actions
    }

    package var body: some View {
        ProjectVessel(reading: project, rows: rows, actions: actions)
            // The toolbar draws the glass but not the room inside it. Without this the folder mark
            // sat ~3.5pt off its own rim while the Rooms vessel next to it breathed at 8.5 — two
            // capsules on one bar, at two densities.
            .padding(.horizontal, ArgoSpacing.snug)
    }
}

package extension ScopeVessel {
    /// Where THIS vessel projects a presentation. The disabled window's narrower bar has its own
    /// (`ProjectDisabledToolbar`).
    init(presentation: CockpitPresentation, actions: CockpitActions) {
        self.init(
            project: ProjectVesselReading(presentation: presentation),
            rows: ProjectMenuProjection.rows(from: presentation),
            actions: actions,
        )
    }
}
