@testable import ArgoUI
import CoreGraphics
import Testing

/// What the pill's measures claim about the surfaces around them.
///
/// Its own suite rather than a section of `VisualContractTests`, because the claims are about a
/// relationship: how far the pill stands off the DOCK, how its list measures against the FEED it
/// opens over. They guard the tokens, not the pixels — whether the pill is drawn where these say
/// is the `planPill` render's question.
@Suite("The plan pill's measures")
struct PlanPillContractTests {
    /// The pill floats over the deck rather than sitting in it, and the lift is the only thing
    /// that says so. Flush to the separator it would read as part of the dock's own row; taller
    /// than the dock it would be a second row rather than a thing above one.
    @Test
    func `the pill stands clear of the dock without becoming a row of its own`() {
        #expect(ArgoPlanPill.lift > 0)
        #expect(ArgoPlanPill.lift < ArgoLayout.deckDockHeight)
    }

    /// A list as wide as the reading it opens over stops being a note about the feed and starts
    /// being a second column of it.
    @Test
    func `the list stays narrower than the feed it opens over`() {
        #expect(ArgoPlanPill.listWidth < ArgoFeedRow.column)
    }

    /// It still has to fit the narrowest column the deck can produce, or the one state where the
    /// reader most needs the plan is the one where it hangs off the edge.
    @Test
    func `the list fits the narrowest feed column the deck allows`() {
        #expect(ArgoPlanPill.listWidth <= ArgoLayout.feedMinimumWidth)
    }

    /// The list is one thing. Spacing its steps like paragraphs would break a plan into a set of
    /// unrelated notes — which is the reading taking it out of the feed was meant to end.
    @Test
    func `two steps sit closer together than two things the agent said`() {
        #expect(ArgoPlanPill.stepStep < ArgoFeedRow.gap)
    }

    /// The pill's own line takes one and the list's steps take two: a pill that wrapped would stop
    /// being a pill, and a list that truncated every entry mid-clause would be unreadable.
    @Test
    func `a step in the list is given more room than the pill's one line`() {
        #expect(ArgoPlanPill.stepLines > 1)
    }

    /// The mark column is wide enough for the marks that sit in it, and no wider — a gutter that
    /// outgrew its glyph would set the words off on their own.
    @Test
    func `a step's mark column fits the rung its mark is drawn at`() {
        #expect(ArgoPlanPill.markWidth >= ArgoIconSize.inline.rawValue)
        #expect(ArgoPlanPill.markWidth < ArgoFeedRow.markerWidth)
    }

    @Test
    func `every gap in the pill is a step the rhythm already carries`() {
        // The sizes are not, and are not meant to be: a ring's diameter, a list's measure and a
        // mark's column answer to what they contain, and snapping them to the spacing ladder
        // would be arithmetic dressed as a rule.
        let ladder = Set(ArgoSpacing.all.map(\.value))
        #expect(ladder.isSuperset(of: [
            ArgoPlanPill.lift, ArgoPlanPill.gap, ArgoPlanPill.insetX, ArgoPlanPill.insetY,
            ArgoPlanPill.listGap, ArgoPlanPill.listInsetX, ArgoPlanPill.listInsetY,
            ArgoPlanPill.stepStep,
        ]))
    }

    /// Three marks for three states, and each has to be a different mark: a list where two
    /// statuses drew the same glyph would carry its reading in the ink alone.
    @Test
    func `each step status carries a mark of its own`() {
        let marks = [ArgoSymbol.stepPending, ArgoSymbol.stepInProgress, ArgoSymbol.stepCompleted]
        #expect(Set(marks).count == marks.count)
    }
}
