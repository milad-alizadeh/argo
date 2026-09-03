import ArgoDesign
import SwiftUI

/// The deck's one chrome row: the Ticket link, then the tabs, on the leading edge —
/// `TabLineInstruments` on the trailing one. The tabs are still a placeholder (#401–#404); the
/// Ticket link is the one thing ahead of them that draws (#1092).
package struct SessionTabLine: View {
    /// Absent when nothing is selected. The line holds its height and says nothing — every zone
    /// below the canopy is inset by it.
    let header: SessionHeaderProjection.Header?
    var handOff: () async -> Void = {}

    package var body: some View {
        HStack(spacing: ArgoSpacing.loose) {
            SessionIssueLink(row: header?.issue)
            // The slot takes what the instruments leave, which is what holds the tabs leading.
            DeckSlot(zone: .tabs)
            TabLineInstruments(header: header, handOff: handOff)
        }
        .padding(.horizontal, ArgoSpacing.section)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        header: SessionHeaderProjection.Header?,
        handOff: @escaping () async -> Void = {},
    ) {
        self.header = header
        self.handOff = handOff
    }
}

// The width the instruments are squeezed to at the narrowest deck the window allows.
