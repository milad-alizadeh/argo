@testable import ArgoUI
import Testing

/// What a measure sheet beside one of the SHELL's own surfaces claims about that surface —
/// everything held here belongs to something the shell draws whatever room is open. The Tickets
/// room's panes are `TicketsRoomMeasureTests`, and a rendered diagram `MermaidMeasureTests`.
///
/// Not one of them names a step of `ArgoSpacing` — every member is a slot sized to the sentence it
/// holds — so `RhythmTests`' ladder assertion has nothing to hold them to. What holds a slot honest
/// is the reason on its declaration, and these are those reasons made assertable.
///
/// A member with nothing to be read against is deliberately absent. `ArgoRosterFoot.minimumHeight`
/// is a floor macOS raises from the reader's own sidebar setting, so the only claim available is
/// that it is positive, and a test proving that earns nothing.
@Suite("The measures that live beside the shell's own surfaces")
struct SurfaceMeasureTests {
    @Test
    func `the rail opens somewhere the seam could also be dragged to`() {
        #expect(ArgoLayout.railWidths.contains(ArgoAgentsRail.width))
    }

    /// Collapsing is not dragging, so the seam's floor does not bound the collapsed width. The
    /// asymmetry is the sheet's own claim, and this is what keeps the two from being read as one
    /// range.
    @Test
    func `the rail collapses below where the seam may be dragged`() {
        #expect(ArgoAgentsRail.collapsedWidth > 0)
        #expect(ArgoAgentsRail.collapsedWidth < ArgoLayout.railWidths.lowerBound)
    }

    /// The ceiling is what makes the resting width a resting width. Were they equal the chip could
    /// not grow, and a reading naming a provider, an identity and a state would be cut at the one
    /// place it must not be.
    @Test
    func `the connection chip may grow past where it rests`() {
        #expect(ArgoToolbarVessel.connectionSlotMaximumWidth > ArgoToolbarVessel
            .connectionSlotWidth)
    }

    /// The scope capsule's divider and a drawer row's ⋯ slot are both drawn inside the toolbar's
    /// own glass, so the vessel is what bounds them.
    @Test
    func `what the toolbar draws inside a vessel fits inside that vessel`() {
        #expect(ArgoToolbarVessel.scopeDividerHeight < ArgoToolbarVessel.height)
    }

    /// Without the overshoot a hairline inside a 3pt bar is indistinguishable from the fill's own
    /// edge, which is the whole reason the tick is stated separately from the bar.
    @Test
    func `a threshold tick stands clear of the bar it marks`() {
        #expect(ArgoContextBar.tickOvershoot > 0)
        #expect(ArgoContextBar.height <= ArgoContextBar.tickOvershoot * 2)
    }

    /// A threshold is a number and a term is words, so the column holding words is the wider one.
    @Test
    func `the guide's term column is wider than its threshold column`() {
        #expect(ArgoContextBar.guideTermWidth > ArgoContextBar.guideThresholdWidth)
    }

    /// Both columns are set against the meanings beside them, which is what the panel's width is
    /// for — a guide whose columns filled it would have nowhere left to say anything.
    @Test
    func `the guide's columns leave the panel room for the meanings beside them`() {
        let columns = ArgoContextBar.guideTermWidth + ArgoContextBar.guideThresholdWidth

        #expect(columns < ArgoContextBar.guideWidth)
    }

    /// The code is a fixed slot inside the panel rather than a fit, so the panel is what bounds
    /// it — a slot wider than what holds it would push its own button off the card.
    @Test
    func `the device code's slot fits the panel it stands in`() {
        #expect(ArgoConnectPanel.deviceCodeWidth < ArgoConnectPanel.width)
    }

    /// Connect opens OVER the window rather than beside it, so the narrowest window the app allows
    /// is the ceiling on how wide its longest row may be set.
    @Test
    func `the Connect panel fits the narrowest window`() {
        #expect(ArgoConnectPanel.width < ArgoLayout.windowMinimumWidth)
    }

    /// A ceiling on the disabled Project's prose, not a panel — it is set on the window's own
    /// ground, so the narrowest window the app allows is what bounds it, the same way it bounds
    /// the Connect panel above.
    @Test
    func `the disabled Project's reading fits the narrowest window`() {
        #expect(ArgoProjectDisabled.readingWidth < ArgoLayout.windowMinimumWidth)
    }

    /// The dot is not a rung of the icon scale: a filled disc puts every point of its size on the
    /// page where a glyph spends most of its box on counters and stems, so it reads below the
    /// floor the smallest SYMBOL rung sits at. The reason has to be assertable, or the next reader
    /// files it as a rung.
    @Test
    func `the state dot is drawn smaller than any symbol rung`() {
        #expect(ArgoIconSize.allCases.allSatisfy { $0.rawValue > ArgoIconSize.statusDot })
    }

    /// §5 forbids re-flowing the output, so the panel that holds it cannot be narrower than the
    /// widest sentence the shell already sets.
    @Test
    func `the raw output panel is wider than the widest sentence panel`() {
        #expect(ArgoRawOutputPanel.width > ArgoConnectPanel.width)
    }

    /// It opens as a popover over the window, so both measures have to fit the smallest window
    /// there is or the panel is cut by the screen rather than by its own scroll view.
    @Test
    func `the raw output panel fits the narrowest window it opens over`() {
        #expect(ArgoRawOutputPanel.width < ArgoLayout.windowMinimumWidth)
        #expect(ArgoRawOutputPanel.maxHeight < ArgoLayout.windowMinimumHeight)
    }
}
