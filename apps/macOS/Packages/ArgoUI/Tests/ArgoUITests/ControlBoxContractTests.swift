import ArgoDesign
@testable import ArgoUI
import Testing

/// What the one box an icon button is drawn in claims (#1243).
///
/// The glyph scale settled how large a mark is and left the CONTROL round it to four surfaces,
/// which measured four boxes. These are the claims that keep the fifth from being added quietly.
@Suite("The icon button's box")
struct ControlBoxContractTests {
    /// A button is a box round a mark, so it is bigger than the mark. Read against the rung the
    /// atom draws at rather than a number, because that is the one it will always hold.
    @Test
    func `the box stands clear of the mark it is drawn round`() {
        #expect(ArgoControlBox.icon > ArgoIconSize.control.rawValue)
    }

    /// The drawn box and the hit target are different things and neither may be read as the other.
    /// What is assertable is the direction: a control that is PAINTED is at least as large as the
    /// invisible square a bare mark answers clicks over, or the app would draw buttons smaller than
    /// the things that are not buttons.
    @Test
    func `a drawn button is no smaller than the square a bare mark answers over`() {
        #expect(ArgoControlBox.icon >= ArgoLayout.controlHitTarget)
    }

    /// The claim the whole ticket turns on: a lone icon carrying its own container stands exactly
    /// as tall as every other container on the shell's band — because it is the same arithmetic,
    /// not because two numbers happen to agree. The shell row's 36pt circle beside the Tickets
    /// row's 30pt capsule is what this stops coming back.
    @Test
    func `a button in a container of its own is the band's own height`() {
        #expect(ArgoControlBox.vessel == ArgoToolbarVessel.height)
        #expect(ArgoControlBox.vessel > ArgoControlBox.icon)
    }

    /// The inset belongs to the vessel and the gap to the segments inside it, so the segments sit
    /// closer to each other than either sits to the capsule's edge — which is what makes two marks
    /// read as one control rather than as two beside each other.
    @Test
    func `segments of one vessel sit closer to each other than to its edge`() {
        #expect(ArgoControlBox.vesselGap < ArgoControlBox.vesselInset)
    }

    /// A rule the full height of the box would meet the inset and cut the capsule across, which is
    /// a boundary between two vessels rather than between two segments of one.
    @Test
    func `the rule between segments stops short of the capsule`() {
        #expect(ArgoControlBox.vesselRuleHeight < ArgoControlBox.icon)
    }

    /// The float over the feed keeps a box of its own, and this is the direction it keeps it in.
    /// Its number answers to the plan pill's lane, so what is assertable here is that the exception
    /// is a bigger control and never a smaller one — a float under the settled box would be an icon
    /// button that had simply been missed.
    @Test
    func `the feed's float keeps a box of its own, and it is larger`() {
        #expect(ArgoFeedRow.tailDiameter > ArgoControlBox.icon)
    }
}
