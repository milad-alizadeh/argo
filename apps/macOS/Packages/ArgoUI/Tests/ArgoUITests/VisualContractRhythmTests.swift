@testable import ArgoUI
import Testing

/// What the contract claims about SHAPE rather than colour: measures and durations, fixed across
/// every appearance.
@Suite("Visual contract — rhythm, depth and motion")
struct VisualContractRhythmTests {
    // MARK: - The feed's rhythm

    @Test
    func `prose is set more openly than the rest of the cockpit is packed`() {
        // A feed is read rather than scanned, so its line height clears the shell's dense default.
        #expect(ArgoFeedRow.lineHeight > ArgoTypography.body.lineBox)
        #expect(ArgoFeedRow.proseLineSpacing > 0)
    }

    /// The number itself is typographic; the contract holds only that it bounds the deck.
    @Test
    func `the reading has a measure the deck cannot widen`() {
        #expect(ArgoFeedRow.column > ArgoLayout.feedMinimumWidth)
        #expect(ArgoFeedRow.column < ArgoLayout.windowMinimumWidth)
    }

    /// Asserted at the narrowest window the app allows — a wider deck can only help.
    @Test
    func `the feed keeps a usable width at the narrowest deck with the panel open`() {
        let deck = ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth
        let widest = ArgoLayout.evidencePanelLimits(in: deck).upperBound

        #expect(widest >= ArgoLayout.evidencePanelMinimumWidth)
        #expect(deck - widest >= ArgoLayout.feedMinimumWidth)
    }

    @Test
    func `a prompt's bubble is most of the column and never all of it`() {
        #expect(ArgoFeedRow.bubbleShare > 0.5)
        #expect(ArgoFeedRow.bubbleShare < 1)
    }

    /// A run of calls is one piece of work.
    @Test
    func `a run of calls sits closer together than two things the agent said`() {
        #expect(ArgoFeedRow.callStep < ArgoFeedRow.gap)
    }

    @Test
    func `the step before prose is the tightest in the feed`() {
        // A label and the prose under it are one block.
        #expect(ArgoFeedRow.stepBeforeProse < ArgoFeedRow.gap)
        #expect(ArgoFeedRow.stepBeforeProse < ArgoFeedRow.inset)
    }

    @Test
    func `every feed metric is a step the rhythm already carries`() {
        // Except the two that are typographic rather than spatial: a line height and a reading
        // measure answer to the type ramp, not the spacing ladder.
        let ladder = Set(ArgoSpacing.all.map(\.value))
        #expect(ladder.isSuperset(of: [
            ArgoFeedRow.inset, ArgoFeedRow.gap, ArgoFeedRow.stepBeforeProse,
            ArgoFeedRow.callStep, ArgoFeedRow.callGap,
        ]))
    }

    // MARK: - Depth

    @Test
    func `only genuinely floating surfaces cast a shadow`() {
        let shadowed = ArgoElevation.all.filter(\.elevation.castsShadow).map(\.name)
        #expect(shadowed == ["popover", "dragged"])
    }

    @Test
    func `the shadows that exist stay soft`() {
        for rung in ArgoElevation.all {
            #expect(rung.elevation.opacity <= 0.45)
            #expect(rung.elevation.blur <= 28)
        }
    }

    // MARK: - Motion

    @Test
    func `no motion role outlasts feedback`() {
        for role in ArgoMotion.all {
            #expect(role.motion.duration <= ArgoMotion.durationCeiling)
        }
    }

    @Test
    func `the Reduce Motion variant never takes longer than the full one`() {
        for role in ArgoMotion.all {
            guard let reduced = role.motion.reducedDuration else { continue }
            #expect(reduced <= role.motion.duration)
        }
    }

    @Test
    func `every role resolves under Reduce Motion without a call site deciding`() {
        for role in ArgoMotion.all {
            let full = role.motion.resolved(reduceMotion: false)
            #expect(full != nil)
            // A nil reduced animation is a decision, not a gap: the change lands instantly.
            #expect(role.motion.resolved(reduceMotion: true) == nil || role.motion
                .reducedDuration != nil)
        }
    }
}
