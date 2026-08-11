@testable import ArgoUI
import Foundation
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
    /// A RATIO and not a stopwatch — an absolute budget on a shared runner measures the runner.
    /// The 40x tolerance is wide for the same reason, and still nowhere near the hundredfold a
    /// quadratic pass produces at tenfold the events.
    @Test
    func `ten times the events costs nothing like a hundred times the work`() {
        let once = CockpitPresentation.Session.longTranscript
        let tenfold = (0 ..< 10).flatMap { _ in once }

        let short = elapsed { _ = FeedProjection.rows(from: once) }
        let long = elapsed { _ = FeedProjection.rows(from: tenfold) }

        #expect(long < short * 40)
    }

    /// The folds take a real share off without emptying the feed.
    @Test
    func `hundreds of events become hundreds of rows, folds and all`() {
        let rows = FeedProjection.longRows

        #expect(CockpitPresentation.Session.longTranscript.count > 400)
        #expect(rows.count > 200)
        #expect(rows.count < CockpitPresentation.Session.longTranscript.count)
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

    private func elapsed(_ work: () -> Void) -> Duration {
        let started = ContinuousClock.now
        work()
        return ContinuousClock.now - started
    }
}
