import ArgoFixtures
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
}
