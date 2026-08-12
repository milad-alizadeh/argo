import SwiftUI

/// The deck's ONE chrome row, since the identity band above it was deleted (#693): the tabs on the
/// leading edge, and `TabLineInstruments` on the trailing one.
///
/// The tabs themselves are still a placeholder (#401–#404). The line keeps its height regardless —
/// every zone below the canopy is inset by it.
struct SessionTabLine: View {
    /// Absent when nothing is selected. The line holds its height and says nothing.
    let header: SessionHeaderProjection.Header?
    /// Hand the shown Session's work to a fresh one. Inert by default, so a specimen draws the
    /// button and spawns nothing.
    var handOff: () async -> Void = {}

    var body: some View {
        HStack(spacing: ArgoSpacing.loose) {
            // The slot takes whatever width the instruments leave, which is what puts the tabs on
            // the leading edge once they are real.
            DeckSlot(zone: .tabs)
            TabLineInstruments(header: header, handOff: handOff)
        }
        .padding(.horizontal, ArgoSpacing.section)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview("Tab line — instruments over a managed Session, at the narrowest deck") {
    SessionTabLine(header: SessionHeaderFixture.header(for: .managed))
        .frame(
            width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth,
            height: ArgoLayout.deckTabSlotHeight,
        )
        .argoDeckSurface()
        .argoAppearance()
}
