import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Foundation
import Testing

/// The one case that reads a REAL transcript: does the checked-in synthetic still stand for the
/// Session it was made from?
///
/// Nothing else can ask it. The real file is gitignored — the repository is public and a
/// transcript is somebody's own words — so every gate over a settled document runs on the
/// synthetic, and this is what says the synthetic is worth running them on. A local recording,
/// like the figures beside it, and never a CI gate.
///
/// A machine without the file records a NAMED skip and prints why, because the failure this
/// fixture exists to prevent is a gate that exits green having looked at nothing.
@Suite(
    "Settled session against the real transcript",
    .serialized,
    .enabled(if: SettledSessionReading.realIsPresent),
)
struct SettledSessionFigureRecording {
    /// Every counted fact, both files, one comparison — the same one `argo-synthesise` makes
    /// before it writes. A fixture generated from a transcript that has since grown is caught here
    /// rather than by a cost gate measuring a document nobody has.
    @Test
    func `the synthetic still holds the real Session's shape`() async throws {
        let real = try await SettledSessionReading
            .shape(of: SettledSessionReading.lines(of: SettledSessionFixture.real))
        let synthetic = try await SettledSessionReading
            .shape(of: SettledSessionReading.lines(of: SettledSessionFixture.synthetic))
        let differences = real.differences(against: synthetic)

        print("FIGURE settled-session-real records=\(real.counts["records"] ?? 0) "
            + "rows=\(real.counts["rows"] ?? 0) differences=\(differences.count)")
        #expect(differences.isEmpty, "\(differences)")
    }

    /// What the whole-document pass costs over the REAL Session — the figure ADR-0030's three
    /// seconds were agreed against, which no machine without the transcript can record.
    ///
    /// A figure and not a gate: the gate is `SettledSessionCostTests`, on the synthetic, because a
    /// budget nothing on CI can measure is a budget that never fails. This is what says the
    /// synthetic stands for the real Session in COST as well as in shape.
    @Test
    func `the real Session's own settle pass`() async throws {
        let lines = try SettledSessionReading.lines(of: SettledSessionFixture.real)
        let rows = await FeedProjection.rows(from: TranscriptReader().read(lines: lines))
        let stamp = await FeedMeasureStamp(
            of: FeedTableFixture.model(showing: rows), atWidth: ArgoFeedRow.column,
        )

        let serial = await MainActor.run {
            cpuSeconds {
                for index in rows.indices {
                    _ = FeedMeasurePass.height(at: index, of: stamp)
                }
            }
        }
        let waited = await elapsedSeconds { _ = await FeedMeasurePass.settle(stamp) }

        print("FIGURE settled-session-real-pass rows=\(rows.count) "
            + "serial-cpu=\((serial * 1000).rounded() / 1000)s "
            + "wall=\((waited * 1000).rounded() / 1000)s "
            + "budget=\(PerfBudgets.settledDocument)s")
        #expect(serial < PerfBudgets.settledDocument)
    }
}
