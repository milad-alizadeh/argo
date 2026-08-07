import ArgoUI
import SwiftUI

// The only canvas that tells the truth about selection and focus colour: `AccentColor` lives
// in this target, and a preview of an `ArgoUI` view builds the package alone, so it falls back
// to the OS accent there.
#Preview("Cockpit — selection colour (accent-accurate)") {
    @Previewable @State var room = CockpitRoom.sessions

    CockpitView(
        presentation: .preview,
        room: $room,
        actions: CockpitActions(refreshCheckout: {}, retryConnection: {}),
    )
    .frame(width: 1280, height: 800)
}
