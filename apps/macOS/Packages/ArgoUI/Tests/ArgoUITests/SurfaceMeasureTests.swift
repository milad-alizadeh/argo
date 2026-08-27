@testable import ArgoUI
import Testing

/// What a measure sheet beside its surface claims about that surface. None of the five here names
/// a step of `ArgoSpacing` — every member is a slot sized to the sentence it holds — so
/// `RhythmTests`' ladder assertion has nothing to hold them to. What holds a slot honest is the
/// reason on its declaration, and these are those reasons made assertable.
///
/// A member with nothing to be read against is deliberately absent. `ArgoRosterFoot.minimumHeight`
/// is a floor macOS raises from the reader's own sidebar setting, so the only claim available is
/// that it is positive, and a test proving that earns nothing.
@Suite("The measures that live beside their surface")
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
        #expect(ArgoToolbarVessel.rowMenuWidth < ArgoToolbarVessel.height)
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

    /// The dot is not a rung of the icon scale: a filled disc puts every point of its size on the
    /// page where a glyph spends most of its box on counters and stems, so it reads below the
    /// floor the smallest SYMBOL rung sits at. The reason has to be assertable, or the next reader
    /// files it as a rung.
    @Test
    func `the state dot is drawn smaller than any symbol rung`() {
        #expect(ArgoIconSize.allCases.allSatisfy { $0.rawValue > ArgoIconSize.statusDot })
    }

    // MARK: - The Work room

    /// The room's three panes tile the ideal window by construction, so the assertable claim is
    /// that 520 leaves the third of them something to be: the design calls the ticket's 480 its
    /// tightest number, and a wider list is what would take it below readable.
    @Test
    func `the backlog leaves the ticket beside it a pane`() {
        #expect(ArgoTicketDetail.idealWidth > ArgoLayout.feedMinimumWidth)
        #expect(ArgoTicketDetail.idealWidth < ArgoBacklogList.width)
    }

    /// The list is the wider pane, which is the whole reason the backlog left the rail: the design
    /// rejected four rooms that put provider-owned text in a narrow column.
    @Test
    func `the backlog is wider than the rail it moved out of`() {
        #expect(ArgoBacklogList.width > ArgoLayout.sidebarMaximumWidth)
    }

    /// Both are FLOORS macOS raises from the reader's own sidebar setting, so the assertable claim
    /// is the relation: a backlog row carries a title at `body` and a view row a name at `rowMeta`,
    /// so the row holding the larger type is the taller of the two.
    @Test
    func `a backlog row is floored taller than a sidebar view row`() {
        #expect(ArgoBacklogList.rowHeight > ArgoWorkSidebar.viewRowHeight)
        #expect(ArgoBacklogList.rowHeight > ArgoTypography.body.lineBox)
        #expect(ArgoWorkSidebar.viewRowHeight > ArgoTypography.rowMeta.lineBox)
    }

    /// The glyph column exists so every view name starts on one vertical, which it can only do if
    /// it is wider than the marks it holds.
    @Test
    func `the sidebar's glyph column holds the mark it is drawn for`() {
        #expect(ArgoWorkSidebar.glyphWidth > ArgoIconSize.inline.rawValue)
    }

    /// The twist's slot holds the mark drawn in it, the same way the sidebar's glyph column does —
    /// a leaf keeps the slot, so a slot narrower than its mark would put every dot on a different
    /// vertical the moment a parent appeared.
    @Test
    func `the twist's slot holds the chevron drawn in it`() {
        #expect(ArgoBacklogList.twistWidth > ArgoIconSize.chevron.rawValue)
    }

    /// A step that did not clear the twist would put a child's dot under its parent's twist rather
    /// than under its id, which is the one thing the design says the step is sized for.
    @Test
    func `one indent step carries a child's dot past its parent's twist`() {
        #expect(ArgoBacklogList.indentStep > ArgoBacklogList.twistWidth)
    }

    /// The cap is an inset cap, not a depth cap: level three shares level two's, and the two below
    /// it still differ, or the nesting would read as one flat band.
    @Test
    func `the indent caps at two steps and moves for every step under it`() {
        let step = ArgoBacklogList.indentStep
        // Compared OUTSIDE the macro, deliberately: `#expect` reports a `CGFloat` against a
        // locally SUMMED `CGFloat` as unequal where the two are bit-identical, so the second step
        // is settled here and the macro is handed the answer.
        let secondStepMatchesTheFirst = ArgoBacklogList.indent(atDepth: 2)
            == ArgoBacklogList.indent(atDepth: 1) + step

        #expect(ArgoBacklogList.indent(atDepth: 0) == .zero)
        #expect(ArgoBacklogList.indent(atDepth: 1) == step)
        #expect(secondStepMatchesTheFirst)
        #expect(ArgoBacklogList.indent(atDepth: 3) == ArgoBacklogList.indent(atDepth: 2))
        #expect(ArgoBacklogList.indent(atDepth: 9) == ArgoBacklogList.indent(atDepth: 2))
    }

    /// A rule between two facts on one line, not a divider under the line: it has to stand shorter
    /// than the taller of the two words it separates, or it reads as a break in the column.
    @Test
    func `the status pair's rule is shorter than the words it parts`() {
        #expect(ArgoTicketDetail.statusDividerHeight < ArgoTypography.control.lineBox * 2)
        #expect(ArgoTicketDetail.statusDividerHeight > 0)
    }

    /// The vacancy panel is two centred sentences, not prose, so it is set narrower than the
    /// measure a paragraph of Argo's own reading runs to.
    @Test
    func `the vacancy panel is narrower than a body of prose`() {
        #expect(ArgoWorkRoomVacancy.panelWidth < ArgoFeedRow.column)
    }

    /// It is a frame rather than a ceiling, so it has to fit the tightest deck the shell allows —
    /// the minimum window with the sidebar dragged to its widest.
    @Test
    func `the vacancy panel fits the narrowest deck the shell allows`() {
        #expect(
            ArgoWorkRoomVacancy.panelWidth
                < ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMaximumWidth,
        )
    }
}
