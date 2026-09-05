import ArgoDesign
@testable import AtlasView
import CoreGraphics
import Testing

/// The city standing up (#1421): the clock, the wave across the plan, and the curve one box climbs.
///
/// The curve is asserted here rather than looked at, because the only other copy of it is in
/// `AtlasVolume.metal` and nothing compiles the two against each other. What this suite can hold is
/// the SHAPE: still at the start, exactly its height at the end, over its height in between, and a
/// box at the edge of the plan starting after one at the middle.
@Suite("Atlas — the city rising out of its plates")
struct AtlasRiseTests {
    private let plan = CGSize(width: 620, height: 400)

    @Test func `the rise is laid out the way the shader reads it`() {
        #expect(MemoryLayout<AtlasRise>.offset(of: \.clock) == 0)
        #expect(MemoryLayout<AtlasRise>.offset(of: \.share) == 4)
        #expect(MemoryLayout<AtlasRise>.offset(of: \.reach) == 8)
        #expect(MemoryLayout<AtlasRise>.offset(of: \.floor) == 12)
        #expect(MemoryLayout<AtlasRise>.stride == 16)
    }

    /// The stagger the shader spreads across the plan is the contract's, not a number of the map's
    /// own — the ticket says the durations come from the roles, and this is where that is kept.
    @Test func `the stagger crosses as the contract's own share of the clock`() {
        let rise = AtlasRise(clock: 0.5, over: plan)

        #expect(rise.share == Float(ArgoMotion.risen.staggerShare))
    }

    /// A plan with no ground still divides by something. One NaN in the vertex stage takes the
    /// whole city with it, so the guard is the point rather than the value.
    @Test func `a plan with no ground still has a reach to divide by`() {
        let rise = AtlasRise(clock: 0.5, over: .zero)

        #expect(rise.reach >= 1)
    }

    /// The corner of the plan is exactly one reach from its middle, which is what makes the wave a
    /// plan measurement: the same box starts at the same point of the clock at any zoom.
    @Test func `the wave runs 0 at the middle of the plan and 1 at its corner`() {
        let rise = AtlasRise(clock: 0, over: plan)
        let centre = SIMD2<Float>(310, 200)

        #expect(rise.wave(to: centre, from: centre) == 0)
        #expect(abs(rise.wave(to: SIMD2<Float>(0, 0), from: centre) - 1) < 0.001)
    }

    /// Past the corner is still the corner. A cast shadow is thrown OUTWARD off its file, so a box
    /// at the edge of the plan has a decal sitting past it — and a distance over 1 would start it
    /// after the clock had already run out.
    @Test func `a point past the corner is held at the far end of the wave`() {
        let rise = AtlasRise(clock: 0, over: plan)

        #expect(rise.wave(to: SIMD2<Float>(-400, -400), from: SIMD2<Float>(310, 200)) == 1)
    }

    @Test func `every box is flat on its plate before the clock starts`() {
        let rise = AtlasRise(clock: 0, over: plan)

        for wave in stride(from: Float(0), through: 1, by: 0.1) {
            #expect(rise.growth(at: wave) == 0)
        }
    }

    /// The settled frame is the MEASURED height, not whatever the curve left: the last thing the
    /// overshoot does is come back to 1, and every box is there at the end of the clock.
    @Test func `every box stands at its own height once the clock has run out`() {
        let rise = AtlasRise(clock: 1, over: plan)

        for wave in stride(from: Float(0), through: 1, by: 0.1) {
            #expect(rise.growth(at: wave) == 1)
        }
    }

    /// The still, and what Reduce Motion cuts to.
    @Test func `the settled rise stands every box at its height`() {
        #expect(AtlasRise.settled.growth(at: 0) == 1)
        #expect(AtlasRise.settled.growth(at: 1) == 1)
    }

    /// The city opens from its centre. The claim is the ORDER, not two numbers: at any one moment
    /// in the stagger a box at the middle of the plan is further up than one at the edge.
    @Test func `the middle of the plan is already up while the edge has not started`() {
        let rise = AtlasRise(clock: ArgoMotion.risen.staggerShare, over: plan)

        #expect(rise.growth(at: 0) > 0)
        #expect(rise.growth(at: 1) == 0)
    }

    /// The overshoot, which is the whole difference between a city arriving and a city inflating.
    /// Asserted as "there is a moment above its height", because the moment itself is the curve's
    /// business and the claim is that the box passes its roof and comes back.
    @Test func `a box passes its own height before it settles onto it`() {
        let overshot = stride(from: 0.0, through: 1.0, by: 0.01)
            .contains { AtlasRise(clock: $0, over: plan).growth(at: 0) > 1 }

        #expect(overshot)
    }

    /// Nothing sinks. A back ease that undershot at the foot would pull a box THROUGH the plate it
    /// stands on, which the map has no way to draw.
    @Test func `no box ever stands below its plate`() {
        for step in stride(from: 0.0, through: 1.0, by: 0.01) {
            let rise = AtlasRise(clock: step, over: plan)
            for wave in stride(from: Float(0), through: 1, by: 0.1) {
                #expect(rise.growth(at: wave) >= 0)
            }
        }
    }

    /// FLAT is the map's own floor, never nothing. A roof on the exact plane of the plate under it
    /// is two coplanar faces for the depth buffer to tear apart, and a rise that started at zero
    /// would put every box in the map on that plane at once — which is what the first render of
    /// this showed, as a shredded far corner (`AtlasElevation.floorShare`).
    @Test func `a box that has not started stands at the map's floor, not on the plate`() {
        let rise = AtlasRise(clock: 0, over: plan)

        #expect(rise.height(of: 60, at: 0) == rise.floor)
        #expect(rise.floor > 0)
    }

    /// A hand-written plan may stand a box below the floor — the tiler never does — and the rise
    /// must not lift such a box before dropping it back.
    @Test func `a box shorter than the floor climbs no higher than its own height`() {
        let rise = AtlasRise(clock: 0, over: plan)

        #expect(rise.height(of: 0, at: 0) == 0)
    }

    @Test func `a settled box stands at exactly what it measured`() {
        let rise = AtlasRise(clock: 1, over: plan)

        #expect(rise.height(of: 60, at: 0) == 60)
        #expect(rise.height(of: 60, at: 1) == 60)
    }
}
