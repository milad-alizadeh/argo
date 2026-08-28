import SwiftUI

/// The room switcher at the top of the sidebar, under the titlebar rather than in it
/// (`cockpit-work-room.md`, #805). Xcode's navigator selector: a control belongs over the thing it
/// changes, and the room changes both panes but STARTS in this one.
///
/// **The only rooms picker in the window (#816)**, and every room's rather than the Work room's —
/// which is why it lives beside `ShellSidebar` rather than under `Work/`.
///
/// The stock segmented `Picker`, dressed by nothing. macOS draws it in Liquid Glass already, and it
/// carries arrow keys, focus and its own VoiceOver announcement — all of which a restyled row of
/// buttons would lose to say nothing new.
struct RoomStrip: View {
    @Binding var selection: CockpitRoom

    var body: some View {
        Picker("Rooms", selection: $selection) {
            ForEach(CockpitRoom.allCases) { room in
                Text(room.title)
                    // The word is on the segment; the shortcut is not, and this is the only place
                    // a reader meets it outside the Navigate menu.
                    .help(room.tooltip)
                    .accessibilityLabel(room.voiceOverLabel)
                    .tag(room)
            }
        }
        .pickerStyle(.segmented)
        .labelsHidden()
        // The inset is the STRIP's, not each sidebar's. Both rooms place it at the head of their
        // own pane, and a picker that lands a few points apart between them reads as two controls
        // (#816).
        .padding(.horizontal, ArgoSpacing.comfortable)
        .padding(.vertical, ArgoSpacing.base)
    }
}

#Preview("Room strip") {
    @Previewable @State var room = CockpitRoom.work

    RoomStrip(selection: $room)
        .frame(width: ArgoLayout.sidebarMinimumWidth)
        .argoAppearance()
}
