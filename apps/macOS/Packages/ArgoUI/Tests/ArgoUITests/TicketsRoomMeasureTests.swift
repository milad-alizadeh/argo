@testable import ArgoUI
import Testing

/// What a measure sheet beside one of the Tickets room's panes claims about that pane — everything
/// held here belongs to that room, where a surface the shell draws whatever room is open is
/// `SurfaceMeasureTests`.
@Suite("The measures that live beside the Tickets room's panes")
struct TicketsRoomMeasureTests {
    /// The room's three panes tile the ideal window by construction, so the assertable claim is
    /// that 520 leaves the third of them something to be: the design calls the ticket's 480 its
    /// tightest number, and a wider list is what would take it below readable.
    @Test
    func `the backlog leaves the ticket beside it a pane`() {
        #expect(ArgoTicketDetail.idealWidth > ArgoLayout.feedMinimumWidth)
        #expect(ArgoTicketDetail.idealWidth < ArgoBacklogList.width)
    }

    /// Both panes carry a band at their head (#836), and the list is what gives up width when the
    /// window cannot afford both — so the claim worth asserting is that the narrowest window still
    /// seats all three columns. Under this, a control in the ticket's band meets the window's edge.
    @Test
    func `the room's three columns fit the narrowest window`() {
        let columns = ArgoLayout.sidebarMinimumWidth
            + ArgoBacklogList.minimumWidth
            + ArgoLayout.feedMinimumWidth

        #expect(columns <= ArgoLayout.windowMinimumWidth)
    }

    /// The list yields and the ticket does not, which is what makes a clipped title the room's
    /// answer to a narrow window rather than an unreachable control.
    @Test
    func `the list gives up width before it reaches the ticket's floor`() {
        #expect(ArgoBacklogList.minimumWidth < ArgoBacklogList.width)
        #expect(ArgoBacklogList.minimumWidth > ArgoLayout.feedMinimumWidth)
    }

    /// The band is a FLOOR holding two lines — the title and the count under it — so a height that
    /// did not clear both would crop the half that stops the title lying about the filter.
    @Test
    func `the band clears the two lines it is drawn for`() {
        let lines = ArgoTypography.windowTitle.nominalLineBox
            + ArgoTypography.rowMeta.nominalLineBox

        #expect(ArgoBacklogList.bandHeight > lines)
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
        #expect(ArgoBacklogList.rowHeight > ArgoTicketsSidebar.viewRowHeight)
        #expect(ArgoBacklogList.rowHeight > ArgoTypography.body.nominalLineBox)
        #expect(ArgoTicketsSidebar.viewRowHeight > ArgoTypography.rowMeta.nominalLineBox)
    }

    /// The glyph column exists so every view name starts on one vertical, which it can only do if
    /// it is wider than the marks it holds.
    @Test
    func `the sidebar's glyph column holds the mark it is drawn for`() {
        #expect(ArgoTicketsSidebar.glyphWidth > ArgoIconSize.inline.rawValue)
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
        #expect(ArgoTicketDetail.statusDividerHeight < ArgoTypography.control.nominalLineBox * 2)
        #expect(ArgoTicketDetail.statusDividerHeight > 0)
    }

    /// The vacancy panel is two centred sentences, not prose, so it is set narrower than the
    /// measure a paragraph of Argo's own reading runs to.
    @Test
    func `the vacancy panel is narrower than a body of prose`() {
        #expect(ArgoTicketsRoomVacancy.panelWidth < ArgoFeedRow.column)
    }

    /// It is a frame rather than a ceiling, so it has to fit the tightest deck the shell allows —
    /// the minimum window with the sidebar dragged to its widest.
    @Test
    func `the vacancy panel fits the narrowest deck the shell allows`() {
        #expect(
            ArgoTicketsRoomVacancy.panelWidth
                < ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMaximumWidth,
        )
    }
}
