import SwiftUI

/// A zone that is laid out but not yet built.
///
/// It says so in words because an unmarked blank region is indistinguishable from a real
/// surface that rendered nothing. It draws no fill of its own — the deck is one plane.
struct DeckSlot: View {
    @Environment(\.argo) private var argo

    let zone: DeckZone

    var body: some View {
        Text("\(zone.title) · placeholder")
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.text.disabled)
            .lineLimit(1)
            .fixedSize()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            // A mark longer than its slot is wide would otherwise overdraw the zone next door.
            .clipped()
            .accessibilityElement()
            .accessibilityLabel("\(zone.title), placeholder")
    }
}

#Preview("Deck slots") {
    VStack(spacing: ArgoSpacing.flush) {
        ForEach(DeckZone.allCases) { zone in
            DeckSlot(zone: zone)
            DeckSeparator()
        }
    }
    .frame(width: 420, height: 360)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Deck slot — a zone too narrow for its own name") {
    DeckSlot(zone: .rail)
        .frame(width: ArgoLayout.minimapLaneWidths.lowerBound, height: 320)
        .argoDeckSurface()
        .argoAppearance()
}
