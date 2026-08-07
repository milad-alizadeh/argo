import SwiftUI

/// The room switcher as one interactive native Liquid Glass vessel.
struct RoomsVessel: View {
    @Binding var selection: CockpitRoom

    var body: some View {
        Picker("Room", selection: $selection) {
            ForEach(CockpitRoom.allCases) { room in
                Label(room.title, systemImage: room.symbol)
                    .tag(room)
                    .help("\(room.title) — \(room.shortcutDescription)")
                    .accessibilityLabel("\(room.title), \(room.shortcutDescription)")
            }
        }
        .pickerStyle(.segmented)
        .labelStyle(.titleAndIcon)
        .argoText(ArgoTypography.control)
        .accessibilityLabel("Rooms")
        .glassEffect(.regular.interactive(), in: Capsule())
    }
}

#Preview("Rooms vessel") {
    @Previewable @State var room = CockpitRoom.sessions

    RoomsVessel(selection: $room)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
