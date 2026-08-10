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
    /// Cost has to grow with the record, not with the square of it — which is what the projection
    /// did until this ticket, because the pass that tells two same-named files apart asked every
    /// path about every other one.
    ///
    /// A RATIO and not a stopwatch, deliberately. An absolute budget on a shared runner measures
    /// the runner; the shape of the curve is the claim, and it is the one a loaded machine cannot
    /// change. The tolerance is wide for the same reason, and still nowhere near the hundredfold
    /// a quadratic pass produces.
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

        #expect(CockpitPresentation.Session.longTranscript.count > 400)
        #expect(rows.count > 200)
        #expect(rows.count < CockpitPresentation.Session.longTranscript.count)
    }

    /// The fixture is as long as a real long session, and this is a gate rather than a note.
    ///
    /// A performance fixture that is short is worse than none: it answers the smoothness question
    /// about a feed nobody has, and it answers it favourably. Four genuine Claude Code transcripts
    /// projected to 380 / 585 / 1168 / 5718 rows; this fixture stood at 301, which put it BELOW the
    /// shortest of them. The floor is the middle of that range — a long day, not the worst day —
    /// and the number is here so shortening the fixture to make a render cheaper fails the suite
    /// rather than quietly weakening every claim about scale.
    @Test
    func `the long feed is as long as a real long session`() {
        #expect(FeedProjection.longRows.count > 1000)
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
