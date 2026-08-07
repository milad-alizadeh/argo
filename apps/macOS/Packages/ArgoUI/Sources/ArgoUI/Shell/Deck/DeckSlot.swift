import SwiftUI

/// A zone that is laid out but not yet built.
///
/// It says so in words because an unmarked blank region is indistinguishable from a real
/// surface that rendered nothing. It draws no fill of its own — the deck is one plane.
struct DeckSlot: View {
    @Environment(\.argo) private var argo

    let zone: DeckZone

    var body: some View {
        mark
            .rotationEffect(.degrees(zone.marksVertically ? -90 : 0))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            // A rotation reserves no layout space, so a mark longer than its slot is short
            // would otherwise overdraw the zone next door.
            .clipped()
            .accessibilityElement()
            .accessibilityLabel("\(zone.title), placeholder")
    }

    /// Laid out at its natural width and then turned, so a narrow lane reads down its length
    /// instead of wrapping across its neighbour.
    private var mark: some View {
        Text("\(zone.title) · placeholder")
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.text.disabled)
            .lineLimit(1)
            .fixedSize()
    }
}

#Preview("Deck slots") {
    VStack(spacing: ArgoSpacing.flush) {
        ForEach(DeckZone.allCases) { zone in
            DeckSlot(zone: zone)
            DeckSeam()
        }
    }
    .frame(width: 420, height: 360)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Deck slot — a lane too narrow for its own name") {
    DeckSlot(zone: .minimap)
        .frame(width: ArgoLayout.minimapLaneWidth, height: 320)
        .argoDeckSurface()
        .argoAppearance()
}
