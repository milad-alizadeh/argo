import ArgoDesign
import SwiftUI

/// Every room's sidebar, as the one view that places the strip over the room's own content.
///
/// The strip is the WINDOW's control and lands at the same point in every room, so which point
/// that is cannot be three sidebars' answer. Placing it here is half of that; the other half is
/// the stage that mounts the rooms, and the reckoning is on `CockpitView.sidebar(tickets:)`.
/// `RoomSidebarPlacementTests` holds both.
///
/// `spacing: .flush` and no padding of its own: the inset around the strip is `RoomStrip`'s, and
/// what sits under it is the room's own pane, drawn to the column's edges. The strip is a SIBLING
/// of that pane rather than a safe-area inset over it, so a room whose pane scrolls scrolls under
/// nothing — the Atlas rail gave up an inset here to say the same thing the other rooms say.
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
