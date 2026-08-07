import SwiftUI

/// The room switcher as one interactive native Liquid Glass vessel, pinned to the toolbar's
/// trailing edge. The glass is the toolbar's — applying it here would merge nothing and would make
/// a merged scope cluster indistinguishable from two adjacent capsules.
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
    }
}

#Preview("Rooms vessel") {
    @Previewable @State var room = CockpitRoom.sessions

    RoomsVessel(selection: $room)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
