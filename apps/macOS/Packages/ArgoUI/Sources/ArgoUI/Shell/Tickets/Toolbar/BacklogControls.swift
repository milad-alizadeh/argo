import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The list's own control: the menu that says how it is ordered.
///
/// In the window's row rather than over the column it names: this room has one list, and the
/// controls that act on it read in scope order along one line rather than at three heights.
struct BacklogControls: View {
    var body: some View {
        ArgoIconButtonGroup {
            BacklogMenu()
        }
    }
}

#Preview("Backlog controls") {
    BacklogControls()
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
