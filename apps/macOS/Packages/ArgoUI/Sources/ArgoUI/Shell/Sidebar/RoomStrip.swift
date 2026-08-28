import SwiftUI

/// The room switcher at the top of the sidebar, under the titlebar rather than in it
/// (`cockpit-work-room.md`, #805). Xcode's navigator selector: a control belongs over the thing it
/// changes, and the room changes both panes but STARTS in this one.
///
/// **The only rooms picker in the window (#816)**, and every room's rather than the Tickets room's
/// —
/// which is why it lives beside `ShellSidebar` rather than under `Work/`.
///
/// The platform's own segmented control, dressed by nothing — `RoomSegments` is AppKit's, reached
/// for the one property SwiftUI's `Picker` never exposes. It carries arrow keys, focus, its own
/// VoiceOver announcement and whatever material the running system draws, all of which a restyled
/// row of buttons would lose to say nothing new.
///
/// **It fills the strip.** A control that hugs its three words leaves the widest sidebar with a
/// picker floating in the middle of it, and the segments are then three different widths — which
/// reads as three unrelated buttons rather than one switch across the pane.
struct RoomStrip: View {
    @Binding var selection: CockpitRoom

    var body: some View {
        RoomSegments(selection: $selection)
            .frame(maxWidth: .infinity)
            // The inset is the STRIP's, not each sidebar's. Both rooms place it at the head of
            // their own pane, and a picker that lands a few points apart between them reads as two
            // controls (#816).
            .padding(.horizontal, ArgoSpacing.comfortable)
            .padding(.vertical, ArgoSpacing.base)
    }
}

#Preview("Room strip") {
    @Previewable @State var room = CockpitRoom.tickets

    RoomStrip(selection: $room)
        .frame(width: ArgoLayout.sidebarMinimumWidth)
        .argoAppearance()
}
