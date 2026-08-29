@testable import ArgoUI
import Testing

/// What survives a session at the length a real one reaches.
///
/// A six-hour run is hundreds of events, and every rule this feed is made of — the collapsed run,
/// the fold of looking, the gallery, the qualifier that tells two same-named files apart — is a
/// pass over the WHOLE stream, cheap on the eight-event fixture the vocabulary suites use.
@Suite("Feed at scale")
struct FeedScaleTests {
    /// Cost has to grow with the record, not with the square of it: the pass that tells two
    /// same-named files apart can easily ask every path about every other one.
    ///
    /// A RATIO, and 40x is not a tolerance to widen when this goes red: it is the gap between the
    /// ~10x a linear pass costs at tenfold the events and the ~100x a quadratic one does. It reads
    /// 9.1-9.9 here, loaded or idle.
    ///
    /// Both sides are the CPU the pass SPENT rather than the seconds that passed, taken as the
    /// cheapest of several runs — a wall clock on a shared machine measures the machine, and noise
    /// is one-sided, so the minimum is the estimate that holds under load.
    @Test
    func `ten times the events costs nothing like a hundred times the work`() {
        let once = TranscriptFixtures.longTranscript
        let tenfold = (0 ..< 10).flatMap { _ in once }

        let short = leastCPUSeconds { _ = FeedProjection.rows(from: once) }
        let long = leastCPUSeconds { _ = FeedProjection.rows(from: tenfold) }

        #expect(long < short * 40)
    }

    /// The folds take a real share off without emptying the feed.
    @Test
    func `hundreds of events become hundreds of rows, folds and all`() {
        let rows = FeedProjection.longRows

        #expect(TranscriptFixtures.longTranscript.count > 400)
        #expect(rows.count > 200)
        #expect(rows.count < TranscriptFixtures.longTranscript.count)
    }

    /// The rules the feed is made of are all about where a run BREAKS, so a scale fixture in which
    /// none of them fires proves nothing about a long feed.
    @Test
    func `the long feed exercises the folds it is meant to stress`() {
        let rows = FeedProjection.longRows

        #expect(FeedFixture.surveys(in: rows).count > 1)
        #expect(rows.contains { row in
            guard case let .call(call) = row.content else { return false }
            return call.ending.hasFailed
        })
    }
}
