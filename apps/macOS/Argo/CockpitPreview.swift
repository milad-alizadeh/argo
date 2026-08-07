import ArgoUI
import SwiftUI

// Previews of `ArgoUI`'s own views build only that package, and the `AccentColor` asset lives
// in this app target — so anything the system accent drives (the sidebar's selection capsule
// above all) renders there as the OS default blue no matter what the catalogue says. This
// preview lives on THIS side of that line, so it is the one that tells the truth about
// selection, focus rings and accented controls. Check colour here, not in the package canvas.
#Preview("Cockpit — selection colour (accent-accurate)") {
    @Previewable @State var room = CockpitRoom.sessions

    CockpitView(
        presentation: .preview,
        room: $room,
        actions: CockpitActions(refreshCheckout: {}, retryConnection: {}),
    )
    .frame(width: 1280, height: 800)
}
