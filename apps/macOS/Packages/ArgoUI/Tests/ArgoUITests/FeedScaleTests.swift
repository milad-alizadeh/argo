@testable import ArgoUI
import Foundation
import Testing

/// What survives a session at the length a real one reaches.
///
/// A six-hour run is hundreds of events, and every rule this feed is made of — the collapsed run,
/// the fold of looking, the gallery, the qualifier that tells two same-named files apart — is a
/// pass over the WHOLE stream. Each of them is cheap on the eight-event fixture the vocabulary
/// suites use and none of them was ever asked what it costs at four hundred.
@Suite("Feed at scale")
struct FeedScaleTests {
    /// The projection is what stands between a growing transcript and the screen, and it runs
    /// again from the top every time the record grows. The budget is deliberately loose — this is
    /// a gate against a pass that went quadratic, not a stopwatch on a machine under load.
    @Test
    func `a real session's worth of events projects in well under a frame`() {
        let events = CockpitPresentation.Session.longTranscript
        let started = ContinuousClock.now

        let rows = FeedProjection.rows(from: events)

        #expect(ContinuousClock.now - started < .milliseconds(16))
        #expect(!rows.isEmpty)
    }

    /// The fixture has to actually BE long, or every claim above it is a claim about a short feed
    /// with a confident name.
    @Test
    func `the scale fixture is hundreds of events`() {
        #expect(CockpitPresentation.Session.longTranscript.count > 400)
    }

    /// Cost has to grow with the record, not with the square of it. Ten times the events for
    /// roughly ten times the work is the whole claim — the tolerance is wide because a clock on a
    /// shared machine is noisy, and narrow enough that an accidental nested pass fails it.
    @Test
    func `ten times the events costs nothing like a hundred times the work`() {
        let once = CockpitPresentation.Session.longTranscript
        let tenfold = (0 ..< 10).flatMap { _ in once }

        let short = elapsed { _ = FeedProjection.rows(from: once) }
        let long = elapsed { _ = FeedProjection.rows(from: tenfold) }

        #expect(long < short * 40)
    }

    /// The reader's own claim, in rows rather than events: hundreds of them, and the folds have
    /// taken a real share off without emptying the feed.
    @Test
    func `hundreds of events become hundreds of rows, folds and all`() {
        let rows = FeedProjection.longRows

        #expect(rows.count > 200)
        #expect(rows.count < CockpitPresentation.Session.longTranscript.count)
    }

    /// The rules the feed is made of are all about where a run BREAKS, so a scale fixture in which
    /// none of them fires is a scale fixture that proves nothing about a long feed.
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
