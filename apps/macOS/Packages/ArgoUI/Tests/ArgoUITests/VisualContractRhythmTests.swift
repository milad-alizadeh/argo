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

    /// A share and not a length, so the filament tracks the measure the way a bubble does. It is a
    /// MINORITY of it: a pass that fills most of the column stops reading as one thing travelling.
    @Test
    func `the working filament is a fraction of the measure it crosses`() {
        #expect(ArgoFeedRow.workingThreadShare > 0)
        #expect(ArgoFeedRow.workingThreadShare < 0.5)
    }

    /// The travel is stated in the filament's OWN lengths, and both ends have to clear the lane —
    /// the ion fades in and out at the measure's edges rather than appearing mid-air. The far end
    /// is measured against the widest lane there is, which is the column over its own length.
    @Test
    func `the filament starts and ends entirely outside the lane`() {
        let travel = ArgoFeedRow.workingThreadTravel
        let lanesPerFilament = 1 / ArgoFeedRow.workingThreadShare

        // Its leading edge is still short of the lane's start.
        #expect(travel.lowerBound <= -1)
        // Its trailing edge is already past the lane's end.
        #expect(travel.upperBound >= lanesPerFilament)
    }

    /// Edge to edge is the requirement, not a detail: the thread cancels the row gutter and runs
    /// the whole column, because a signal about the whole column should touch both of its edges.
    /// The two numbers are the design's own, so moving either sends you back to it.
    @Test
    func `the working thread's lane is the column, not the text column inside it`() {
        let text = ArgoFeedRow.column - ArgoFeedRow.inset * 2

        #expect(text == 672)
        #expect(ArgoFeedRow.column == 720)
        #expect(abs(ArgoFeedRow.column * ArgoFeedRow.workingThreadShare - 216) < 0.001)
    }

    /// Parked, the ion has no travel to be read by, so it glows lower — at full strength a still
    /// bar across the measure reads as a rule somebody drew.
    @Test
    func `the parked filament glows below the moving one`() {
        #expect(ArgoFeedRow.workingThreadStillGlow < ArgoElevation.bloom.opacity)
        #expect(ArgoFeedRow.workingThreadStillGlow > 0)
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

    /// The other way a rung can be worth something. A glow sits ON what casts it, so it is the
    /// offset that tells the two apart — and a rung must not try to be both.
    @Test
    func `a glow is the one rung that draws without floating`() {
        let glowing = ArgoElevation.all.filter(\.elevation.glows).map(\.name)
        #expect(glowing == ["bloom"])
        #expect(ArgoElevation.all.allSatisfy { !($0.elevation.glows && $0.elevation.castsShadow) })
    }

    /// The cap is on DARKNESS under a surface, so it is the cast shadows it bounds. A glow is the
    /// ion's own light and reads as absent long before 0.45.
    @Test
    func `the shadows that exist stay soft`() {
        for rung in ArgoElevation.all {
            #expect(rung.elevation.blur <= 28)
            guard rung.elevation.castsShadow else { continue }
            #expect(rung.elevation.opacity <= 0.45)
        }
    }

    // MARK: - Motion

    /// The ceiling asks how long a reader waits for a transition to finish, and a loop never
    /// finishes — its period is a rhythm, not a wait. So it is the non-repeating roles the ceiling
    /// is about.
    @Test
    func `no motion role outlasts feedback`() {
        for role in ArgoMotion.all where !role.motion.repeats {
            #expect(role.motion.duration <= ArgoMotion.durationCeiling)
        }
    }

    /// Reduce Motion has no shorter answer for a loop, so a repeating role must stop rather than
    /// hurry. A `reducedDuration` on one would repeat forever at a faster period.
    @Test
    func `a repeating role stops under Reduce Motion rather than shortening`() {
        for role in ArgoMotion.all where role.motion.repeats {
            #expect(role.motion.reducedDuration == nil)
            #expect(role.motion.resolved(reduceMotion: true) == nil)
        }
    }

    /// The one loop is a bound, not a door. D12 lets a live operational signal repeat for exactly
    /// as long as its operation lasts; a second repeating role is a decision, not a detail.
    @Test
    func `exactly one role loops`() {
        #expect(ArgoMotion.all.filter(\.motion.repeats).map(\.name) == ["working"])
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
