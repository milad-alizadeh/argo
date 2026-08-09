import SwiftUI

/// The widths the reader has dragged the deck's movable seams to.
///
/// One value rather than two loose bindings, because they are one thing: where this reader likes
/// their columns. That is a preference of the WINDOW and not a fact about the Session in it — which
/// is why they are passed in rather than owned down among the zones. The zone layout is rebuilt
/// whenever the deck changes Session, and a seam owned inside that subtree is a drag the reader has
/// to make again every time they click a different Session.
struct DeckSeams {
    /// How wide the agents rail opens.
    var rail: Binding<CGFloat>
    /// What the reader dragged the evidence panel to. `nil` until they do — the panel opens at its
    /// share of the deck, which depends on a width nothing knows until it is laid out.
    var panel: Binding<CGFloat?>

    /// Seams nothing remembers, for a `#Preview` with no shell above it to hold them. A drag in one
    /// of those has nowhere to be written down, which is honest: a preview is a still.
    static let unheld = DeckSeams(
        rail: .constant(ArgoLayout.agentsRailWidth),
        panel: .constant(nil),
    )
}
