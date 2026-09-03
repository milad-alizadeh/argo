import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// The gate ADR-0030 Rule 3 states: the largest Session Argo has ever been given is measured whole,
/// before a row of it is drawn, in at most three seconds.
///
/// It runs on the checked-in synthetic — 4 800 records, 459 rows, the real Session's shape with
/// none of its words (#1117) — because the repository is public and a transcript is somebody's own
/// words. That is what makes this a gate rather than one that exits green because nothing looked:
/// the fixture is in git, so CI measures a document rather than skipping.
///
/// In SECONDS, which every other budget in this package refuses — and measured as thread CPU over
/// the document taken SERIALLY, which is the one reading of those seconds a shared box cannot
/// falsify.
///
/// The wall clock is what ADR-0030's three seconds are about, and a wall clock is exactly what this
/// suite may not gate on: it runs beside two thousand other cases, and the same pass that takes
/// 0.1 s alone takes 11 s while the rest of the suite has the cores. Thread CPU over one thread is
/// load-tolerant (`cpuSeconds`) and it is also an UPPER BOUND on the number the ADR names: the
/// shipped pass splits the same rows across cores, so what one thread spends on all of them is
/// more than what the reader waits, never less. A serial cost inside the budget is a parallel wait
/// inside it on any machine.
///
/// The wall clock rides along as a figure and gates nothing (ADR-0028 Rule 8).
@Suite("Settled session cost", .serialized)
@MainActor
struct SettledSessionCostTests {
    /// The deck column at the width the reading actually wraps across, less a point — a measure of
    /// this suite's OWN.
    ///
    /// `ProseMetrics` keys its wrapped answers by the measure they were taken at, and those stores
    /// are shared with the two thousand other cases in this process. At the column itself the
    /// typesetting this case is timing would be answered by whatever measured there before it,
    /// which is a cold walk timed warm.
    private static let width = ArgoFeedRow.column - 1

    /// The same, for the case that only counts rows: a width of its own, so it cannot warm the one
    /// the case above is timing.
    private static let countedWidth = ArgoFeedRow.column - 2

    @Test
    func `the largest Session is settled inside the budget`() async throws {
        let rows = try await Self.rows()
        #expect(rows.count > 400, "the fixture stopped being the largest Session's shape")
        let stamp = FeedMeasureStamp(
            of: FeedTableFixture.model(showing: rows), atWidth: Self.width,
        )
        // COLD, and a single sample: a first pass over an empty store IS the measurement, and a
        // first open of a Session is the wait ADR-0030 bounds. The hosting rulers a face's line box
        // needs are inside it and belong there — they are paid once per process, on the first
        // document of a launch, and this case is that document.
        let serial = cpuSeconds {
            for index in rows.indices {
                _ = FeedMeasurePass.height(at: index, of: stamp)
            }
        }
        let waited = await elapsedSeconds { _ = await FeedMeasurePass.settle(stamp) }

        print("FIGURE settled-session-pass rows=\(rows.count) "
            + "serial-cpu=\((serial * 1000).rounded() / 1000)s "
            + "wall=\((waited * 1000).rounded() / 1000)s "
            + "budget=\(PerfBudgets.settledDocument)s")
        #expect(serial < PerfBudgets.settledDocument)
    }

    /// And the document it produced is one every row of the fixture has a height in — a budget met
    /// by measuring less than the whole document would be no budget at all.
    @Test
    func `the pass the budget is about measures every row of the fixture`() async throws {
        let rows = try await Self.rows()
        let stamp = FeedMeasureStamp(
            of: FeedTableFixture.model(showing: rows), atWidth: Self.countedWidth,
        )

        let document = try #require(await FeedMeasurePass.settle(stamp))

        #expect(document.count == rows.count)
        #expect(document.everyHeight.allSatisfy { $0 > 0 })
    }

    /// The fixture as the feed reads it.
    private static func rows() async throws -> [FeedRow] {
        let lines = try SettledSessionReading.lines(of: SettledSessionFixture.synthetic)
        return await FeedProjection.rows(from: TranscriptReader().read(lines: lines))
    }
}
