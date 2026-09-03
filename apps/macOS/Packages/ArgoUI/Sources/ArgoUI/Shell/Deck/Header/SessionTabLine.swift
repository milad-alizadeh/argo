import ArgoDesign
import SwiftUI

/// The deck's one chrome row: the Ticket link, then the tabs, on the leading edge —
/// `TabLineInstruments` on the trailing one. The tabs are `DeckTabs` since #404; the Ticket link
/// is what sits ahead of them (#1092).
package struct SessionTabLine: View {
    /// Absent when nothing is selected. The line holds its height and says nothing — every zone
    /// below the canopy is inset by it.
    let header: SessionHeaderProjection.Header?
    var handOff: () async -> Void = {}

    /// Which pane the deck is reading. Held here rather than above, because the deck draws one
    /// pane: the day a second one ships (#269 is Delivery's) this rises to whoever holds the two.
    @State private var tab = DeckTab.opening

    package var body: some View {
        HStack(spacing: ArgoSpacing.loose) {
            SessionIssueLink(row: header?.issue)
            // The strip takes what the instruments leave, which is what holds the tabs leading.
            DeckTabs(selection: $tab)
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
