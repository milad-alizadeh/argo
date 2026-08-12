import SwiftUI

/// The room switcher as one interactive native Liquid Glass vessel, pinned to the toolbar's
/// trailing edge. The glass is the toolbar's — applying it here would merge nothing and would make
/// a merged scope cluster indistinguishable from two adjacent capsules.
///
/// Tabs rather than a `Picker`: `.pickerStyle(.segmented)` brings its own fill and its own measure,
/// so a segment cannot take the wash, the rim and the clearances the rest of the bar is built from.
struct RoomsVessel: View {
    @Binding var selection: CockpitRoom

    var body: some View {
        HStack(spacing: ArgoSpacing.hair) {
            ForEach(CockpitRoom.allCases) { room in
                RoomTab(room: room, isSelected: room == selection) { selection = room }
            }
        }
        // The selected tab's wash ran flush to the capsule's leading rim — welded to the glass
        // rather than inset within it. This is the clearance that makes it a segment INSIDE a
        // vessel, and it matches the scope capsule's on the other end of the bar.
        .padding(.horizontal, ArgoSpacing.snug)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Rooms")
    }
}

/// One room, drawn as its mark alone (#690) — the word it stopped drawing is in `room.tooltip`.
///
/// Selection is the same tonal device the rest of the shell reads depth from — a wash and a lit
/// rim, never a branded fill.
private struct RoomTab: View {
    @Environment(\.argo) private var argo

    let room: CockpitRoom
    let isSelected: Bool
    let select: () -> Void

    var body: some View {
        Button(action: select) {
            ArgoGlyph(room.symbol, .control)
                .foregroundStyle(isSelected ? argo.color.text.primary : argo.color.text.tertiary)
                .toolbarSegment(isSelected: isSelected)
        }
        .buttonStyle(.plain)
        .help(room.tooltip)
        .accessibilityLabel(room.voiceOverLabel)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

#Preview("Rooms vessel") {
    @Previewable @State var room = CockpitRoom.sessions

    RoomsVessel(selection: $room)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

#Preview("Rooms vessel — a trailing room selected") {
    @Previewable @State var room = CockpitRoom.code

    RoomsVessel(selection: $room)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
