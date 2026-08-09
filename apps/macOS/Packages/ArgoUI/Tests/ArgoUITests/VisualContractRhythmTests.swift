@testable import ArgoUI
import Testing

/// What the contract claims about SHAPE rather than colour: the feed reads as a column of prose,
/// depth comes from tone and edge rather than shadow, and no motion outlasts feedback.
///
/// Split from the colour claims because they answer to different things — these are measures and
/// durations, fixed across every appearance, where a palette is what an appearance changes.
@Suite("Visual contract — rhythm, depth and motion")
struct VisualContractRhythmTests {
    // MARK: - The feed's rhythm

    @Test
    func `prose is set more openly than the rest of the cockpit is packed`() {
        // A feed is read rather than scanned, so its line height clears the dense default the
        // rest of the shell is built at. Below it, the column stops being a column of prose.
        #expect(ArgoFeedRow.lineHeight > ArgoTypography.body.size * ArgoFeedRow
            .naturalLineHeightRatio)
        #expect(ArgoFeedRow.proseLineSpacing > 0)
    }

    /// A feed is read start to finish, so it answers to a measure the way a page does. The number
    /// itself is typographic; what the contract holds is that it is a bound the deck cannot widen,
    /// and that it is not so tight the column never reaches it.
    @Test
    func `the reading has a measure the deck cannot widen`() {
        #expect(ArgoFeedRow.column > ArgoLayout.feedMinimumWidth)
        #expect(ArgoFeedRow.column < ArgoLayout.windowMinimumWidth)
    }

    /// The AC: the split does not starve the column. Asserted against the panel's own ceiling at
    /// the narrowest window the app allows, because that is the case where the two floors and the
    /// minimap have the least room to share — a wider deck can only help.
    @Test
    func `the feed keeps a usable width at the narrowest deck with the panel open`() {
        let deck = ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth
        let widest = ArgoLayout.evidencePanelLimits(in: deck).upperBound

        #expect(widest >= ArgoLayout.evidencePanelMinimumWidth)
        #expect(deck - widest >= ArgoLayout.feedMinimumWidth)
    }

    /// Prose takes the whole column; the bubble does not. It is somebody speaking INTO the
    /// session, and one that filled the column would stop reading as a thing that was said — but
    /// a strip beside full-width paragraphs stops reading as half of one conversation.
    @Test
    func `a prompt's bubble is most of the column and never all of it`() {
        #expect(ArgoFeedRow.bubbleShare > 0.5)
        #expect(ArgoFeedRow.bubbleShare < 1)
    }

    /// A run of calls is one piece of work. If it were spaced like prose, a turn's five edits would
    /// read as five unrelated events — the tightening is what keeps them one.
    @Test
    func `a run of calls sits closer together than two things the agent said`() {
        #expect(ArgoFeedRow.callStep < ArgoFeedRow.gap)
    }

    @Test
    func `the step before prose is the tightest in the feed`() {
        // A label and the prose under it are one block; two rows are two. If those two steps ever
        // meet, the label starts reading as a row of its own.
        #expect(ArgoFeedRow.stepBeforeProse < ArgoFeedRow.gap)
        #expect(ArgoFeedRow.stepBeforeProse < ArgoFeedRow.inset)
    }

    @Test
    func `every feed metric is a step the rhythm already carries`() {
        // Except the two that are typographic rather than spatial: a line height and a reading
        // measure answer to the type ramp, and snapping them to the spacing ladder would be
        // arithmetic dressed as a rule.
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
