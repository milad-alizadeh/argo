@testable import ArgoUI
import Testing

/// The ladder a long wait cools down. Every claim here is about a NUMBER rather than a render: a
/// still cannot show a period, and nobody can sit through six minutes to check one.
@Suite("The age of a wait")
struct WorkingAgeTests {
    /// The design's own table, as a table. Prose that omits the numbers cannot be failed for
    /// getting them wrong, so they are asserted rather than described.
    @Test
    func `the ladder is the four rungs the design states`() {
        #expect(ArgoWaitAge.all.map(\.after) == [0, 10, 60, 300])
        #expect(ArgoWaitAge.all.map(\.period) == [1.9, 2.8, 3.8, 4.9])
        #expect(ArgoWaitAge.all.map(\.glow) == [0.60, 0.49, 0.40, 0.30])
    }

    /// The whole point: no step anywhere on the ladder is faster or brighter than the one before
    /// it, so a wait that has gone on longer can only read as more settled.
    @Test
    func `no rung is warmer or quicker than the one above it`() {
        for (younger, older) in zip(ArgoWaitAge.all, ArgoWaitAge.all.dropFirst()) {
            #expect(older.after > younger.after)
            #expect(older.period > younger.period)
            #expect(older.glow < younger.glow)
        }
    }

    /// The first rung is what the surfaces already draw, so a short wait is unchanged by this
    /// ladder, and every other rung is a step down from a state somebody approved.
    @Test
    func `a fresh wait is exactly what the contract already said`() {
        let fresh = ArgoWaitAge.rung(at: 0)

        #expect(fresh.period == ArgoMotion.working.duration)
        #expect(fresh.glow == ArgoElevation.bloom.opacity)
        #expect(fresh.cooling == 1)
    }

    /// Each rung takes over AT its threshold, not after it — the boundary belongs to the colder
    /// rung, so a wait that has run ten seconds is already reading as one.
    @Test(arguments: [
        (0.0, 1.9), (9.9, 1.9), (10.0, 2.8), (59.9, 2.8),
        (60.0, 3.8), (299.9, 3.8), (300.0, 4.9), (3600.0, 4.9),
    ])
    func `a wait of this age reads at this period`(age: Double, period: Double) {
        #expect(ArgoWaitAge.rung(at: age).period == period)
    }

    /// A clock that has not started cannot draw a wait colder than a fresh one. The floor matters
    /// because a forced age and a measured one meet at the same lookup.
    @Test
    func `an age below the ladder reads as the first rung`() {
        #expect(ArgoWaitAge.rung(at: -1) == ArgoWaitAge.freshest)
    }

    /// The ladder has a floor as well as a ceiling: an hour and six minutes read the same, because
    /// a pass slow enough to stop reading as travel would say the Turn had stopped.
    @Test
    func `the ladder bottoms out rather than running on`() {
        #expect(ArgoWaitAge.coldest == ArgoWaitAge.rung(at: 3600))
        #expect(ArgoWaitAge.coldest == ArgoWaitAge.all[3])
        #expect(ArgoWaitAge.freshest == ArgoWaitAge.all[0])
    }

    /// The row's wash paints type rather than casting light, so it starts at full opacity and cools
    /// by the ladder's PROPORTION. Applying the thread's own numbers there would dim the approved
    /// render of a three-second call.
    @Test
    func `the row's wash cools by the same proportion rather than to the same number`() {
        let cooling = ArgoWaitAge.all.map(\.cooling)

        #expect(cooling.first == 1)
        #expect(cooling.last == ArgoWaitAge.coldest.glow / ArgoWaitAge.freshest.glow)
        for (younger, older) in zip(cooling, cooling.dropFirst()) {
            #expect(older < younger)
        }
    }

    /// An aged wait is the same ROLE at another period: a loop, at that rung's period, keeping the
    /// role's Reduce Motion answer.
    @Test(arguments: ArgoWaitAge.all)
    func `every rung is the one loop over its own period`(rung: ArgoWaitAge) {
        #expect(rung.motion.repeats)
        #expect(rung.motion.duration == rung.period)
        #expect(rung.motion.reducedDuration == ArgoMotion.working.reducedDuration)
    }

    /// The stills of #615 and #616 do not vary by age, and this is what says so: no rung of the
    /// ladder resolves to anything at all when movement is off.
    @Test(arguments: ArgoWaitAge.all)
    func `no rung animates under Reduce Motion`(rung: ArgoWaitAge) {
        #expect(rung.motion.resolved(reduceMotion: true) == nil)
        #expect(rung.motion.resolvedPass(reduceMotion: true) == nil)
        #expect(rung.motion.resolvedPass(reduceMotion: false) != nil)
    }

    /// A pass driven one at a time has to put the ion back at its start in a tick of its own, and
    /// that tick is spent off the surface. It has to be far shorter than the shortest pass, or the
    /// gap stops being a frame and starts being a stutter.
    @Test
    func `the gap between two passes is a frame, not a pause`() {
        #expect(ArgoMotion.passReentry > 0)
        #expect(ArgoMotion.passReentry < ArgoWaitAge.freshest.period / 10)
    }
}
