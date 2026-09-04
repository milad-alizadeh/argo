import ArgoDesign
import CoreGraphics

/// What floats over the reading's bottom edge, and therefore what the rows under it owe.
///
/// One value rather than a Bool per float, because four surfaces read this edge — the gutter under
/// the last row, the fade that lets rows run beneath a vessel, the way back to the newest row, and
/// the floats themselves. Asked separately they came to disagree: the pill floated over the edge
/// and the gutter was measured for the vessel alone, so the last row was read through the pill's
/// glass (#1225).
///
/// What it CANNOT say is how tall the vessel actually stands: `ArgoComposerVessel.feedClearance` is
/// a sampled measure, and a field grown past it takes the pill up with it while the gutter below
/// stays put. Measuring the vessel means reading a height back out of the layout and into the
/// table's insets, which is its own change; the fixed measure covers the field's whole growth
/// ceiling but one line.
package struct FeedBottomEdge: Equatable {
    /// Nothing floats there — the reading runs to the deck's own foot.
    package static let bare = FeedBottomEdge()

    /// Whether a vessel floats over the edge: a composer, or a Permission prompt. See
    /// `DeckVessel.isFloating`.
    package var hasVessel = false
    /// Whether the plan's pill floats there, riding on the vessel's top edge when there is one.
    package var hasPlanPill = false

    /// The scroll room under the last row, so a reading never ends underneath a float. The two
    /// costs ADD because the pill sits on top of the vessel rather than beside it. Only the pill's
    /// term is derived; the vessel's is the sampled one this type's note above records.
    package var clearance: CGFloat {
        let vessel = hasVessel ? ArgoComposerVessel.feedClearance : ArgoSpacing.section
        return vessel + (hasPlanPill ? ArgoPlanPill.footprint : 0)
    }

    /// How far the way back to the newest row lifts. Stacked above every other float rather than
    /// beside them: side by side, a narrow deck draws the centred pill and the trailing capsule on
    /// top of each other.
    package var tailLift: CGFloat {
        clearance + ArgoSpacing.base
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(hasVessel: Bool = false, hasPlanPill: Bool = false) {
        self.hasVessel = hasVessel
        self.hasPlanPill = hasPlanPill
    }
}
