import SwiftUI

/// The deck's one chrome row: the tabs on the leading edge, `TabLineInstruments` on the trailing
/// one. The tabs are still a placeholder (#401–#404).
struct SessionTabLine: View {
    /// Absent when nothing is selected. The line holds its height and says nothing — every zone
    /// below the canopy is inset by it.
    let header: SessionHeaderProjection.Header?
    var handOff: () async -> Void = {}

    var body: some View {
        HStack(spacing: ArgoSpacing.loose) {
            // The slot takes what the instruments leave, which is what holds the tabs leading.
            DeckSlot(zone: .tabs)
            TabLineInstruments(header: header, handOff: handOff)
        }
        .padding(.horizontal, ArgoSpacing.section)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Every posture, with nothing-selected under them: an empty line and a line with no mark on it
/// are two different absences.
private struct SessionTabLineGallery: View {
    let width: CGFloat

    private var headers: [SessionHeaderProjection.Header] {
        SessionHeaderFixture.headers + [SessionHeaderFixture.needsInput]
    }

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            ForEach(Array(headers.enumerated()), id: \.offset) { _, header in
                SessionTabLine(header: header)
                    .frame(height: ArgoLayout.deckTabSlotHeight)
            }
            SessionTabLine(header: nil)
                .frame(height: ArgoLayout.deckTabSlotHeight)
        }
        .frame(width: width)
        .argoDeckSurface()
        .argoAppearance()
    }
}

#Preview("Tab line — every access posture, and nothing selected") {
    SessionTabLineGallery(width: 900)
}

// The width the instruments are squeezed to at the narrowest deck the window allows.
#Preview("Tab line — at the narrowest deck the window allows") {
    SessionTabLineGallery(width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth)
}
