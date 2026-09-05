@testable import ArgoUI
import Testing

/// The one curve the roster's two live marks share (`cockpit-roster-row.md`, rule 8 as amended by
/// #1403). Every claim here is about the NUMBER the modifier resolves to: a still cannot show a
/// rise and fall, and a curve asserted in prose cannot be failed for drifting.
@Suite("The breath")
struct BreathingGlowTests {
    private func breath(phase: Double, peak: Double = 1, parked: Double? = nil) -> BreathingGlow {
        BreathingGlow(phase: phase, peak: peak, parked: parked)
    }

    /// Equal ends are what makes the loop's re-entry invisible: the phase snaps back to 0 between
    /// passes, and a curve whose ends differed would snap the light with it.
    @Test(arguments: [0.0, 1.0])
    func `a pass starts and ends at the floor`(phase: Double) {
        #expect(breath(phase: phase).strength == BreathingGlow.resting)
    }

    @Test
    func `the middle of a pass is full strength`() {
        #expect(breath(phase: 0.5).strength == 1)
    }

    /// It may not blink: a light that reaches zero says a Turn started and stopped rather than one
    /// that is running.
    @Test(arguments: stride(from: 0.0, through: 1.0, by: 0.05).map(\.self))
    func `the breath never leaves the band between its floor and full`(phase: Double) {
        let strength = breath(phase: phase).strength

        #expect(strength >= BreathingGlow.resting)
        #expect(strength <= 1)
    }

    /// Reduce Motion loses the MOVEMENT and not the state, and what "the state" is differs by
    /// surface — so a still answers to where its own surface parks and to nothing on the curve.
    @Test(arguments: [0.0, 0.25, 0.5, 0.75])
    func `a still breath ignores the phase entirely`(phase: Double) {
        // The dot's halo, which parks at the breath's own floor.
        #expect(breath(phase: phase, parked: BreathingGlow.resting).strength == BreathingGlow
            .resting)
        // The Plan's segment, which is the mark itself and parks at full.
        #expect(breath(phase: phase, parked: 1).strength == 1)
    }

    /// The one that would go unnoticed: a segment parked at the floor draws UNDER the completed
    /// steps beside it, saying the step nobody can act on is the brighter one.
    @Test
    func `a parked segment never draws dimmer than a step that is done`() {
        #expect(breath(phase: 0, parked: 1).strength > BreathingGlow.resting)
    }

    /// The two marks differ in PEAK and in nothing else — the dot's halo is light and cools with
    /// the wait, the Plan's segment is ink and does not.
    @Test
    func `the peak scales the whole curve and never the floor's share of it`() {
        let dim = breath(phase: 0.5, peak: 0.6)
        let full = breath(phase: 0.5)

        // `strength` is the shared curve; `peak` is applied over it, so the shape is identical.
        #expect(dim.strength == full.strength)
        #expect(dim.peak == 0.6)
    }
}
