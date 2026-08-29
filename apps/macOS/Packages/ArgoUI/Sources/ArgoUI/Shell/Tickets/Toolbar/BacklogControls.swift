import SwiftUI

/// The list's own control: the menu that holds every way of ordering it.
///
/// **The funnel beside it is gone (#900).** It drew Mail's own filter mark, and it was bound to an
/// empty closure in the shipping app — no sheet, no popover, no state, and nothing downstream
/// reading a filter because nothing ever wrote one. A mark that draws live and does nothing costs a
/// reader a click and a theory about the room every time they meet it, and the room already has its
/// two narrowings: the sidebar's four views choose the set, and the search field narrows within it.
/// The rule that stood between the two marks went with it — it existed only to stop the pair
/// reading as one control, and one mark is not a pair.
///
/// In the window's row rather than over the column it orders: this room has one list, and the
/// controls that act on it read in scope order along one line rather than at three heights.
struct BacklogControls: View {
    var grouping: () -> Void = {}

    var body: some View {
        ToolbarVessel {
            BacklogMenu(grouping: grouping)
        }
    }
}

#Preview("Backlog controls") {
    BacklogControls()
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
