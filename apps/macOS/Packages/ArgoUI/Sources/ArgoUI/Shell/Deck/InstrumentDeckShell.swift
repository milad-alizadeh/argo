import SwiftUI

/// The opaque plane filling the detail side of the split view, flush to the window.
///
/// Radius 0 and no glass by contract (D10, D40): it is the ground the glass canopy is read
/// against, so it is the one surface that must not borrow the canopy's material.
struct InstrumentDeckShell: View {
    let room: CockpitRoom

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .argoDeckSurface()
            .accessibilityElement(children: .contain)
            .accessibilityLabel("\(room.title) Instrument Deck")
    }

    /// Only Sessions has a zone layout so far. The other rooms are bare ground rather than a
    /// borrowed one — they get their own tickets, and a placeholder deck in Work would claim a
    /// structure nobody has decided.
    @ViewBuilder private var content: some View {
        switch room {
        case .sessions:
            SessionsDeck()
        case .work, .code:
            Color.clear
        }
    }
}

#Preview("Instrument Deck — Sessions") {
    InstrumentDeckShell(room: .sessions)
        .frame(width: 900, height: 620)
        .argoAppearance()
}

#Preview("Instrument Deck — a room with no zones yet") {
    InstrumentDeckShell(room: .work)
        .frame(width: 860, height: 620)
        .argoAppearance()
}
