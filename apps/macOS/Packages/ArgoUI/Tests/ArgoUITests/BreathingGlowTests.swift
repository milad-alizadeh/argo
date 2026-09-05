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

    /// The one that would go unnoticed. A still is the ONLY reading of a live step a Reduce Motion
    /// reader ever gets, so it has to be the full `interaction.accentBright` the design's table
    /// gives that step — parked at the breath's floor instead, it would draw at 40% of that ink and
    /// read as the dimmest thing on a bar whose completed steps are all at full.
    @Test
    func `a segment parked for Reduce Motion draws at its full ink`() {
        #expect(breath(phase: 0, parked: 1).opacity == 1)
        #expect(breath(phase: 0, parked: BreathingGlow.resting).opacity < 1)
    }

    /// The two marks share the curve and differ in where its ends sit — the dot's halo is light
    /// and cools with the wait, the Plan's segment is ink and does not. `peak` scales what the
    /// reader sees without bending the shape.
    @Test
    func `the peak scales what is drawn and leaves the curve's shape alone`() {
        let dim = breath(phase: 0.5, peak: 0.6)
        let full = breath(phase: 0.5)

        #expect(dim.strength == full.strength)
        #expect(dim.opacity == 0.6)
        #expect(full.opacity == 1)
    }

    /// The trough is where the two marks are furthest apart, and it is the reading the design's
    /// rule 8 states: neither reaches zero, and the dot's halo bottoms out under the segment's.
    @Test
    func `a cooled halo draws under an ink mark at the same point of the pass`() {
        let halo = breath(phase: 0, peak: 0.3)
        let ink = breath(phase: 0)

        #expect(halo.opacity < ink.opacity)
        #expect(halo.opacity > 0)
    }
}
