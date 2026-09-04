import ArgoDesign
import ArgoEngine
@testable import ArgoUI
import Testing

/// The resuming wait on the plinth (#1328) — `starting`'s twin, told apart only by `resuming` and
/// by its own words.
///
/// Its own suite for the reason `FeedStartupWaitTests` is beside `FeedWaitTests`: what it draws is
/// a case of the surface `FeedWaitTests` already covers end to end for a fresh spawn.
@Suite("Feed resume wait")
@MainActor
struct FeedResumeWaitTests {
    private static let resumed = SessionWaitSettled(wait: .resuming, tookMs: 4100)
    private static let neverResumed = SessionWaitSettled(
        wait: .resuming,
        tookMs: 650,
        failure: "the process exited with code 1",
    )

    /// A resume opens the SAME wait a fresh spawn does — `starting` status — so `resuming` is what
    /// tells the two apart.
    @Test
    func `a resume in flight raises the resuming plinth`() {
        let reading = FeedWaitTests.reading(status: .starting, resuming: true)

        #expect(reading.wait == .resuming)
        #expect(reading.feed.isEmpty)
    }

    /// `resuming` on its own says nothing: it is read only where the status is already `starting`,
    /// exactly as `starting` alone is unreachable off a Session Argo never started.
    @Test
    func `resuming with no starting status raises no plinth`() {
        #expect(FeedWaitTests.reading(status: .idle, resuming: true).wait == nil)
    }

    /// The resuming plinth is gone the moment its wait settles, exactly as the starting one is.
    @Test
    func `a settled resume leaves no plinth behind it`() {
        let reading = FeedWaitTests.reading(
            status: .idle,
            settledWaits: [Self.resumed],
            resuming: true,
        )

        #expect(reading.wait == nil)
        #expect(reading.feed.map(\.content) == [.settledWait(Self.resumed)])
    }

    /// A resume that failed lands its row in failure ink, no differently from a start that failed.
    @Test
    func `a resume that failed lands one row and no plinth`() {
        let reading = FeedWaitTests.reading(
            status: .ended,
            settledWaits: [Self.neverResumed],
            resuming: true,
        )

        #expect(reading.wait == nil)
        #expect(reading.feed.map(\.content) == [.settledWait(Self.neverResumed)])
    }

    /// The resume's own three tenses, a reader who saw `starting`'s has to find these too.
    @Test
    func `the resuming words say the same wait in three tenses`() {
        #expect(FeedWaitWords.resuming.running == "Resuming the session")
        #expect(FeedWaitWords.resuming.settled == "Resumed the session")
        #expect(FeedWaitWords.resuming.failed == "The session did not resume")
    }

    /// Taking the word off the screen must not take it off the screen reader.
    @Test
    func `the plinth keeps the resuming sentence the caption had`() {
        #expect(FeedWaitWords.resuming.spokenRunning == "The session is resuming")
    }

    /// The act, never the state: `retry`'s clockwise arrow is the chain picked up again.
    @Test
    func `the resuming wait takes the mark of the act`() {
        #expect(FeedWaitWords.resuming.symbol == ArgoSymbol.retry)
    }

    /// The resuming case answers the same way `starting` does: a wait `FeedWait` names has words.
    @Test
    func `resuming has words`() {
        #expect(FeedWaitWords(.resuming) == .resuming)
    }

    /// A settled resume takes a call's shape, exactly as a settled start does.
    @Test
    func `a settled resume takes a call's shape`() {
        #expect(FeedRow.Content.settledWait(Self.resumed).kind.isCall)
        #expect(FeedRow.Content.settledWait(Self.neverResumed).kind.isCall)
    }

    /// The lane must show a failed resume in the row's own ink, exactly as a failed start.
    @Test
    func `the lane draws a failed resume in the row's own ink`() {
        #expect(Self.resumed.laneInk == .boundary)
        #expect(Self.neverResumed.laneInk == .failure)
    }
}
