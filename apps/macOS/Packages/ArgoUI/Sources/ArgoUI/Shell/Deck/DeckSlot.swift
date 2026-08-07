import SwiftUI

/// A zone that is laid out but not yet built.
///
/// It says so in words rather than standing empty: an unmarked blank region is
/// indistinguishable from a real surface that rendered nothing, and telling those two apart in
/// a screenshot is the whole reason the container ships before the surfaces do.
///
/// It draws no fill and no frame of its own — the deck is one plane, and a slot that tinted
/// itself would read as the card D10 rules out.
struct DeckSlot: View {
    @Environment(\.argo) private var argo

    let zone: DeckZone
    /// Set for a zone narrower than its own name. The mark is laid out at its natural width and
    /// then turned, so a lane reads down its length instead of spilling across its neighbour.
    var verticalMark = false

    var body: some View {
        mark
            .rotationEffect(.degrees(verticalMark ? -90 : 0))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .accessibilityElement()
            .accessibilityLabel("\(zone.title), placeholder")
    }

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
        ForEach(Array(DeckZone.allCases.enumerated()), id: \.offset) { _, zone in
            DeckSlot(zone: zone)
            DeckSeam()
        }
    }
    .frame(width: 420, height: 360)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Deck slot — a lane too narrow for its own name") {
    DeckSlot(zone: .minimap, verticalMark: true)
        .frame(width: ArgoLayout.minimapLaneWidth, height: 320)
        .argoDeckSurface()
        .argoAppearance()
}
