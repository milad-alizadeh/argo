@testable import ArgoUI
import Testing

/// The pass count is the multiplier every per-pass cost in the cockpit is read against, so the
/// figure that matters is the BUSIEST second rather than the mean: sixty passes landing inside one
/// frame and then nothing for a minute averages to one a second, which is the reading that would
/// hide the storm this exists to find.
@Suite("Frame probe — body passes per second")
struct FrameProbePassTests {
    static func summary(
        frames: [Double],
        passes: [Double],
        costs: [Double],
    )
        -> FrameProbeSummary {
        FrameProbeSummary(stamps: frames, passes: passes, passCosts: costs, displayMaxFPS: 60)
    }

    @Test func `no passes is no passes, not a division`() {
        #expect(FrameProbeSummary.busiestSecond([]) == 0)
    }

    /// Whole-second bucketing would answer 1 here, because the two stamps sit either side of the
    /// boundary. They are 20ms apart.
    @Test func `a burst across a whole-second boundary is still a burst`() {
        #expect(FrameProbeSummary.busiestSecond([10.99, 11.01]) == 2)
    }

    /// The window is a second WIDE, so a stamp exactly a second later is inside it and the one
    /// after that is not.
    @Test func `the window holds a full second and no more`() {
        #expect(FrameProbeSummary.busiestSecond([0, 1.0]) == 2)
        #expect(FrameProbeSummary.busiestSecond([0, 1.5]) == 1)
    }

    @Test func `the busiest second is found wherever it sits, not only at the start`() {
        let quiet = [0.0, 2.0, 4.0]
        let storm = [9.0, 9.1, 9.2, 9.3, 9.4]
        #expect(FrameProbeSummary.busiestSecond(quiet + storm) == 5)
    }

    /// Stamps arrive in order from one main-actor counter, but the reduction sorts rather than
    /// trusting that: a summary read back off disk has whatever order the file had.
    @Test func `stamps out of order still find the burst`() {
        #expect(FrameProbeSummary.busiestSecond([9.4, 0.0, 9.1, 4.0, 9.2]) == 3)
    }

    /// The whole point of the counter: a run where the cockpit re-derives many times per drawn
    /// frame is reported as such, rather than folded into an average that reads as calm.
    @Test func `passes are rated over the frame window, so the rate is the multiplier`() {
        let reduced = Self.summary(
            frames: (0 ..< 3).map { 100 + Double($0) * 0.5 },
            passes: (0 ..< 30).map { 100 + Double($0) * 0.03 },
            costs: Array(repeating: 2, count: 30),
        )
        #expect(reduced.passes.count == 30)
        #expect(reduced.passes.perSecond == 30)
        #expect(reduced.passes.peakPerSecond == 30)
    }

    /// Rate and cost answer different questions and the summary must not let one stand in for the
    /// other: these two runs spend the same share of the main thread, and only one of them is
    /// fixed by making the fold cheaper.
    @Test func `a cheap pass run and an expensive one are told apart at the same total`() {
        let frames = [100.0, 101.0]
        let often = Self.summary(
            frames: frames,
            passes: (0 ..< 30).map { 100 + Double($0) * 0.03 },
            costs: Array(repeating: 2, count: 30),
        )
        let heavy = Self.summary(frames: frames, passes: [100.0], costs: [60])
        #expect(often.passCosts.msPerSecond == heavy.passCosts.msPerSecond)
        #expect(often.passCosts.medianMS == 2)
        #expect(heavy.passCosts.medianMS == 60)
        #expect(often.passes.perSecond > heavy.passes.perSecond)
    }

    @Test func `a window with no passes reports no cost rather than dividing by none`() {
        let reduced = Self.summary(frames: [100.0, 101.0], passes: [], costs: [])
        #expect(reduced.passes.stamps.isEmpty)
        #expect(reduced.passes.perSecond == 0)
        #expect(reduced.passCosts.msPerSecond == 0)
        #expect(reduced.passCosts.medianMS == 0)
        #expect(reduced.passCosts.maxMS == 0)
    }

    /// The raw arrays are what a reader recomputes from with the launch discarded, so they are
    /// kept whole rather than reduced away.
    @Test func `every pass and its cost survive into the summary`() {
        let reduced = Self.summary(
            frames: [100.0, 101.0],
            passes: [100.0, 100.5],
            costs: [12, 3],
        )
        #expect(reduced.passes.stamps == [100.0, 100.5])
        #expect(reduced.passCosts.eachMS == [12, 3])
    }
}

/// The counter ships in every build and is inert in all but one: `ARGO_FRAME_PROBE=1`. The suite
/// runs with that unset, so these two tests are the off arm and its control — a zero that only
/// means something beside a counter shown to record when it is reached.
@Suite("Frame probe — the pass counter is inert unless armed")
@MainActor
struct FrameProbePassInertTests {
    @Test func `with the probe off, a pass is derived and nothing is appended`() {
        #expect(FrameProbe.isEnabled == false)
        let before = FrameProbe.shared.countedPasses.count
        var derived = 0
        let value = FrameProbePass.counting { derived += 1; return 7 }
        #expect(value == 7)
        #expect(derived == 1)
        #expect(FrameProbe.shared.countedPasses.count == before)
        #expect(FrameProbe.shared.countedPassCosts.count == before)
    }

    /// The control. Without it the test above passes just as well against a counter whose arrays
    /// are never written at all, which is the bug it is meant to be able to see.
    @Test func `the same arrays do grow when a pass is recorded`() {
        let probe = FrameProbe()
        probe.countPass(opened: 100, until: 100.25)
        #expect(probe.countedPasses == [100])
        #expect(probe.countedPassCosts == [250])
    }
}
