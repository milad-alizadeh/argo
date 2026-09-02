import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The active Project as the leading half of the scope vessel: its symbol, its full name and the
/// system's own indicator. Clicking it opens the Project menu.
///
/// **A plain pull-down (#875).** It was a `Button` opening a `.popover` on a drawer that drew its
/// own heading, its own rows and its own active fill — none of which a menu cannot do, and all of
/// which had to be kept working by hand. `.borderlessButton` rather than the bordered default: this
/// sits inside the toolbar item's own Liquid Glass capsule, and a second bezel in there is the
/// hand-drawn ground again in the system's handwriting. It is Xcode's branch control's style.
///
/// No state dot: nothing derives the per-Project worst-state rollup yet (#164).
package struct ProjectVessel: View {
    @Environment(\.argo) private var argo

    package let reading: ProjectVesselReading
    package let rows: [ProjectMenuProjection.Row]
    let actions: CockpitActions

    package var body: some View {
        Menu {
            ProjectMenu(rows: rows, actions: actions)
        } label: {
            // The menu rows' role, not a control role: one size for the Project name here and in
            // the menu, and a rung above the branch beside it.
            Label {
                // A folder can be named anything. Truncated, not clipped — `.fixedSize()` would
                // hand the bar a control as wide as the name and the frame below would then cut a
                // letter in half.
                Text(reading.name)
                    .lineLimit(1)
                    .truncationMode(.tail)
            } icon: {
                ArgoGlyph(reading.mark, .control)
            }
            .labelStyle(.argo(ArgoTypography.rowTitle))
        }
        .menuStyle(.borderlessButton)
        // A `Menu` paints its label from the TINT; a `foregroundStyle` around it loses.
        .tint(argo.color.text.primary)
        .frame(maxWidth: ArgoToolbarVessel.projectVesselMaximumWidth, alignment: .leading)
        .help(reading.help)
        .accessibilityLabel(reading.announcement)
        .accessibilityHint(ProjectVesselReading.hint)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        reading: ProjectVesselReading,
        rows: [ProjectMenuProjection.Row],
        actions: CockpitActions,
    ) {
        self.reading = reading
        self.rows = rows
        self.actions = actions
    }
}
