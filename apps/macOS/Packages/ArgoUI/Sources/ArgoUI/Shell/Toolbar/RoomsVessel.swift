import SwiftUI

/// The room switcher as one interactive native Liquid Glass vessel, pinned to the toolbar's
/// trailing edge. The glass is the toolbar's — applying it here would merge nothing and would make
/// a merged scope cluster indistinguishable from two adjacent capsules.
///
/// Tabs rather than a `Picker`: `.pickerStyle(.segmented)` renders a segment's text OR its image
/// and silently drops the other, so the symbol every room declares never reached the screen.
struct RoomsVessel: View {
    @Binding var selection: CockpitRoom

    var body: some View {
        HStack(spacing: ArgoSpacing.hair) {
            ForEach(CockpitRoom.allCases) { room in
                RoomTab(room: room, isSelected: room == selection) { selection = room }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Rooms")
    }
}

/// One room. Selection is the same tonal device the rest of the shell reads depth from — a wash
/// and a lit rim, never a branded fill.
private struct RoomTab: View {
    @Environment(\.argo) private var argo

    let room: CockpitRoom
    let isSelected: Bool
    let select: () -> Void

    var body: some View {
        Button(action: select) {
            Label(room.title, systemImage: room.symbol)
                .labelStyle(.argo(ArgoTypography.control))
                .foregroundStyle(isSelected ? argo.color.text.primary : argo.color.text.tertiary)
                .padding(.horizontal, ArgoSpacing.base)
                // Hair, not tight: the toolbar sets the capsule's height, and a selected tab
                // taller than its own line breaks out through the glass rather than sitting in it.
                .padding(.vertical, ArgoSpacing.hair)
                // After the padding, never before it: a background applied to the label alone
                // sizes to the glyphs and leaves the wash hugging the text.
                .background(selectionWash)
                .contentShape(.rect(cornerRadius: ArgoRadius.control))
        }
        .buttonStyle(.plain)
        .help("\(room.title) — \(room.shortcutDescription)")
        .accessibilityLabel("\(room.title), \(room.shortcutDescription)")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var selectionWash: some View {
        RoundedRectangle(cornerRadius: ArgoRadius.control)
            .fill(argo.color.surface.selected)
            .overlay {
                RoundedRectangle(cornerRadius: ArgoRadius.control)
                    .strokeBorder(argo.color.edge.subtle, lineWidth: ArgoStroke.border)
            }
            .opacity(isSelected ? 1 : 0)
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
