@testable import ArgoUI
import CoreGraphics
import Testing

/// How a segment is measured around what it holds. A mark-only room tab (#690) takes a fixed slot
/// rather than a word's measure, and this is the arithmetic that makes its wash nest inside the
/// vessel instead of sitting in it as a stretched pill.
@Suite("Toolbar segment")
struct ToolbarSegmentTests {
    /// The wash is a `Capsule`, so its end caps take half the slot's HEIGHT as a radius.
    /// Concentric with the vessel means that radius plus the inset the vessel holds it off the rim
    /// by equals the vessel's own radius — anything else and the two curves visibly disagree, which
    /// is what a reader sees as a mismatched corner radius.
    @Test
    func `a mark's wash nests concentrically inside the vessel`() {
        let capRadius = ToolbarSegment.markSlotHeight / 2
        let vesselRadius = ArgoToolbarVessel.height / 2

        #expect(capRadius + ArgoSpacing.snug == vesselRadius)
    }

    /// The inset is one token, so the wash sits the same distance from the rim on every side. Read
    /// off the vertical, which the slot's height decides, against the horizontal the vessel sets.
    @Test
    func `a mark's wash is held off the rim by the same inset on every side`() {
        let verticalInset = (ArgoToolbarVessel.height - ToolbarSegment.markSlotHeight) / 2

        #expect(verticalInset == ArgoSpacing.snug)
    }

    /// A broad mark — `apple.terminal` — needs more width than height, because `ArgoGlyph` fixes
    /// HEIGHT and lets width follow. A square slot pinched it against its own wash.
    @Test
    func `a mark's slot is wider than it is tall, and clears the ink either way`() {
        #expect(ToolbarSegment.markSlotWidth > ToolbarSegment.markSlotHeight)
        #expect(ToolbarSegment.markSlotHeight > ArgoIconSize.control.rawValue)
    }
}
