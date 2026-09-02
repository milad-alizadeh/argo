import ArgoFixtures
@testable import ArgoSpecimens
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
    /// Said in the PATHS that pass looked at and never in the seconds it took, which is ADR-0028
    /// Rule 8's first instruction. The seconds it used to be said in sit beside
    /// `PerfBudgets.labellingLooks`, gated by nothing.
    ///
    /// The fold is EXACTLY `copies` rather than a bound, because that many copies of a reading
    /// name the same DISTINCT paths: an indexed pass looks once at each of ten times the addresses
    /// and then at the same rivals it found once. One that asked every path which others share its
    /// name looks at all of them at every address, a hundred times as many.
    ///
    /// **Narrower than the quotient it replaces, and ADR-0028's #1066 amendment says so.** The old
    /// assertion ran `FeedProjection.rows(from:)` on both arms, so the projection stage, the four
    /// folds and `offering` were held against superlinear growth as a side effect of it. This one
    /// measures the labelling pass alone — the only one of them the claim above ever named, and
    /// the only one that could ask every path about every other one. It is also that pass's own
    /// tally, as every count in this suite is, so a rewrite scanning the whole list per address
    /// without counting its own looks would not be seen.
    @Test
    func `ten times the addresses is ten times the looks, not a hundred`() {
        let once = FeedProjection.contents(of: TranscriptFixtures.longTranscript)
        let tenfold = (0 ..< Self.copies).flatMap { _ in once }

        let short = FeedProjection.toldApart(once)
        let long = FeedProjection.toldApart(tenfold)

        // The recorded count exactly and not a floor: a tally that had stopped seeing the rivalry
        // term — the term the quadratic is in — folds by ten just as happily.
        #expect(short.looks == PerfBudgets.labellingLooks)
        // And the reading really does hold a rival, so the pass has something to tell apart.
        #expect(short.contents.contains { Self.isQualified($0) })
        #expect(long.looks == short.looks * Self.copies)
    }

    /// Ten times the record, which is the length the claim is about. The fixture's own multiple,
    /// never a tolerance.
    private static let copies = 10

    /// A file the pass had to name by more than its leaf, which is what says two of them shared a
    /// name in this reading.
    private static func isQualified(_ content: FeedRow.Content) -> Bool {
        guard case let .call(call) = content, case let .file(file) = call.subject
        else { return false }
        return file.qualifier != nil
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
