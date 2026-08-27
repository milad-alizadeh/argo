@testable import ArgoUI
import Testing

/// What the five sheets #773 cut out of `ArgoLayout` claim about their own surface. None of them
/// spells a step of `ArgoSpacing`, so `RhythmTests`' ladder assertion has nothing to say about
/// them — every member is a slot sized to the sentence it holds. What holds a slot honest is the
/// reason on its declaration, and this suite is those reasons made assertable.
///
/// It sits beside `RhythmTests` rather than inside it because that file is at its length cap, and
/// it makes the SAME cross-population claims that file warns against splitting away — a rail
/// bounded by `ArgoLayout.railWidths`, a panel by `windowMinimumWidth`. Those are the assertions
/// this suite exists for, not an accident of where it landed.
@Suite("The measures that live beside their surface")
struct SurfaceMeasureTests {
    /// The rail opens somewhere it can also be dragged to, and collapses somewhere it cannot. The
    /// asymmetry is the sheet's own claim: collapsing is not dragging, so the seam's floor does
    /// not bound the collapsed width, and this is what keeps the two from being read as one range.
    @Test
    func `the rail opens inside the seam's limits and collapses below them`() {
        #expect(ArgoLayout.railWidths.contains(ArgoAgentsRail.width))
        #expect(ArgoAgentsRail.collapsedWidth < ArgoLayout.railWidths.lowerBound)
        #expect(ArgoAgentsRail.collapsedWidth > 0)
    }

    /// A chip that could not grow past its resting width would truncate the reading it exists to
    /// carry; one with no ceiling would take the deck's whole leading edge.
    @Test
    func `the connection chip may grow past where it rests, and only so far`() {
        let slot = ArgoToolbarVessel.connectionSlotWidth

        #expect(ArgoToolbarVessel.connectionSlotMaximumWidth > slot)
        #expect(ArgoToolbarVessel.connectionSlotMaximumWidth < ArgoLayout.sidebarMinimumWidth * 2)
    }

    /// Everything the toolbar draws inside its own glass has to fit in it — the scope capsule's
    /// divider and a drawer row's ⋯ slot included.
    @Test
    func `what the toolbar draws inside a vessel fits inside that vessel`() {
        #expect(ArgoToolbarVessel.scopeDividerHeight < ArgoToolbarVessel.height)
        #expect(ArgoToolbarVessel.rowMenuWidth < ArgoToolbarVessel.height)
        // The drawer hangs off the toolbar, so it answers to the window rather than to the vessel.
        #expect(ArgoToolbarVessel.projectDrawerWidth < ArgoLayout.sidebarMaximumWidth)
    }

    /// A gauge, not a control: the bar has to stay thin enough that a tick standing proud of it
    /// still reads as an overshoot rather than as the fill's own edge.
    @Test
    func `the context bar reads as a gauge and its ticks stand clear of it`() {
        #expect(ArgoContextBar.tickOvershoot > 0)
        #expect(ArgoContextBar.height <= ArgoContextBar.tickOvershoot * 2)
        #expect(ArgoContextBar.height < ArgoLayout.deckTabSlotHeight)
    }

    /// The guide's two columns hold different things — a threshold is a number, a term is words —
    /// and both have to leave room for the sentence beside them inside one panel.
    @Test
    func `the guide's term column is wider than its thresholds, and both fit the panel`() {
        let columns = ArgoContextBar.guideTermWidth + ArgoContextBar.guideThresholdWidth

        #expect(ArgoContextBar.guideTermWidth > ArgoContextBar.guideThresholdWidth)
        #expect(columns < ArgoContextBar.guideWidth)
        // The instrument is what opens the guide, so the guide is the wider of the two.
        #expect(ArgoContextBar.guideWidth > ArgoContextBar.instrumentWidth)
    }

    /// The code is a slot inside the panel, so the panel is what bounds it — a fixed slot wider
    /// than what holds it would push its own button off the card.
    @Test
    func `the device code's slot fits the panel it stands in`() {
        #expect(ArgoConnectPanel.deviceCodeWidth < ArgoConnectPanel.width)
        // Connect opens over the window rather than beside it, so it clears the narrowest one.
        #expect(ArgoConnectPanel.width < ArgoLayout.windowMinimumWidth)
    }

    /// A FLOOR, so the reader's own sidebar size setting can raise it. What it must not do is
    /// stand taller than the chrome the roster hangs under.
    @Test
    func `the roster's foot is a floor a sidebar row can clear`() {
        #expect(ArgoRosterFoot.minimumHeight > 0)
        #expect(ArgoRosterFoot.minimumHeight < ArgoToolbarVessel.height)
    }

    /// The dot is not a rung of the icon scale: a filled disc puts every point of its size on the
    /// page where a glyph spends most of its box on counters and stems, so it reads below the
    /// floor the smallest SYMBOL rung sits at. That is the whole reason it is off the ladder, and
    /// the reason has to be assertable or the next reader will file it as a rung.
    @Test
    func `the state dot is drawn smaller than any symbol rung`() {
        #expect(ArgoIconSize.statusDot < ArgoIconSize.chevron.rawValue)
        #expect(ArgoIconSize.allCases.allSatisfy { $0.rawValue > ArgoIconSize.statusDot })
    }
}
