import SwiftUI

/// The widths the reader has dragged the deck's movable seams to — a preference of the WINDOW, so
/// passed in rather than owned among the zones. The zone layout is rebuilt whenever the deck
/// changes Session, and a seam owned inside that subtree loses its drag on every switch.
struct DeckSeams {
    /// How wide the agents rail opens.
    var rail: Binding<CGFloat>
    /// What the reader dragged the evidence panel to. `nil` until they do — the panel opens at its
    /// share of the deck, which depends on a width nothing knows until it is laid out.
    var panel: Binding<CGFloat?>

    /// Seams nothing remembers, for a `#Preview` with no shell above it to hold them.
    static let unheld = DeckSeams(
        rail: .constant(ArgoLayout.agentsRailWidth),
        panel: .constant(nil),
    )
}
