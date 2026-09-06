import ArgoDesign
import SwiftUI

/// Every room's sidebar, as the one view that places the strip over the room's own content.
///
/// The strip is the WINDOW's control and lands at the same point in every room, so which point
/// that is cannot be three sidebars' answer. It was: each room wrote its own stack around
/// `RoomStrip`, all three writing the same inset, and the strip still parted between them by 8pt
/// — the rooms are staged as siblings in one column (`CockpitView.sidebar`), and a room further
/// down that stage started one implicit gap lower than the room above it. The gap is closed where
/// the stage is built; this is what keeps it closed, because a fourth room composed here cannot
/// place its strip anywhere else. `RoomSidebarPlacementTests` holds both halves.
///
/// `spacing: .flush` and no padding of its own: the inset around the strip is `RoomStrip`'s, and
/// what sits under it is the room's own pane, drawn to the column's edges.
struct RoomSidebar<Content: View>: View {
    /// Which room the window is in. A binding, because the strip switches the whole window and the
    /// sidebar composed here is only the pane it starts in.
    @Binding var room: CockpitRoom

    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            RoomStrip(selection: $room)
            content
        }
    }
}
