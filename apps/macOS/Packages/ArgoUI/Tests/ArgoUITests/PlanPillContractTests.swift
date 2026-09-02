import ArgoDesign
@testable import ArgoUI
import Testing

/// What the pill's measures claim about the surfaces around them. They guard the tokens, not the
/// pixels — whether the pill is drawn where these say is the `planPill` render's question.
@Suite("The plan pill's measures")
struct PlanPillContractTests {
    /// The lift is the only thing saying the pill floats over the deck rather than sitting in it.
    @Test
    func `the pill stands clear of the edge without leaving the reading's foot`() {
        #expect(ArgoPlanPill.lift > 0)
        #expect(ArgoPlanPill.lift < ArgoComposerVessel.feedClearance)
    }

    @Test
    func `the list stays narrower than the feed it opens over`() {
        #expect(ArgoPlanPill.listWidth < ArgoFeedRow.column)
    }

    @Test
    func `the list fits the narrowest feed column the deck allows`() {
        #expect(ArgoPlanPill.listWidth <= ArgoLayout.feedMinimumWidth)
    }

    @Test
    func `two steps sit closer together than two things the agent said`() {
        #expect(ArgoPlanPill.betweenSteps < ArgoFeedRow.gap)
    }

    /// The pill's own line takes one and the list's steps take two.
    @Test
    func `a step in the list is given more room than the pill's one line`() {
        #expect(ArgoPlanPill.stepLines > 1)
    }

    @Test
    func `a step's mark column fits the rung its mark is drawn at`() {
        #expect(ArgoPlanPill.markWidth >= ArgoIconSize.inline.rawValue)
        #expect(ArgoPlanPill.markWidth < ArgoFeedRow.markerWidth)
    }

    @Test
    func `every gap in the pill is a step the rhythm already carries`() {
        // The sizes are not, and are not meant to be: a ring's diameter, a list's measure and a
        // mark's column answer to what they contain.
        let ladder = Set(ArgoSpacing.all.map(\.value))
        #expect(ladder.isSuperset(of: [
            ArgoPlanPill.lift, ArgoPlanPill.gap, ArgoPlanPill.insetX, ArgoPlanPill.insetY,
            ArgoPlanPill.listGap, ArgoPlanPill.listInsetX, ArgoPlanPill.listInsetY,
            ArgoPlanPill.betweenSteps,
        ]))
    }

    /// A list where two statuses drew the same glyph would carry its reading in the ink alone.
    @Test
    func `each step status carries a mark of its own`() {
        let marks = [ArgoSymbol.stepPending, ArgoSymbol.stepInProgress, ArgoSymbol.stepCompleted]
        #expect(Set(marks).count == marks.count)
    }
}
