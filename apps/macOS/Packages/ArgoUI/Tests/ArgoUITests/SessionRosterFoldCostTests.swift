import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// What a fold COSTS the Roster, said in rows (ADR-0028 Rule 8).
///
/// A count and never the milliseconds it takes: a seconds-side budget is unbound on a loaded
/// machine (#1024), and the claim here is exact rather than bounded — the rows a directory of
/// runs spends do not follow how many runs it holds.
@Suite("Session roster fold cost")
struct SessionRosterFoldCostTests {
    private let loop = RosterFoldFixture.loop

    /// `from` keeps the ids of three folders apart: a Session id is unique on the roster, and a
    /// fixture that repeated one would fold two runs into the same entry.
    private func runs(
        _ count: Int, at directory: String, from first: Int = 0,
    )
        -> [CockpitPresentation.Session] {
        RosterFoldFixture.runs(count, at: directory, from: first)
    }

    @Test
    func `a directory of runs costs one row, at any number of runs`() {
        #expect(SessionRosterProjection.rows(from: runs(180, at: loop)).count == 1)
        #expect(SessionRosterProjection.rows(from: runs(1800, at: loop)).count == 1)
    }

    /// The scope claim, exact: one pass settles the folds over the whole list, so the roster's
    /// height is one row per fold plus one per Session drawn on its own — and nothing in it is
    /// per-run. A fold decided per row instead would be the local-event-causing-global-work
    /// mistake #963 tracks.
    @Test
    func `the roster is one row per fold plus one per Session drawn on its own`() {
        let folded = (0 ..< 3).flatMap { runs(60, at: "\(loop)/loop-\($0)", from: $0 * 1000) }
        let steered = (0 ..< 4).map {
            RosterSessionFixture.session(id: "steered-\($0)")
        }

        let rows = SessionRosterProjection.rows(from: folded + steered)

        #expect(rows.count == 3 + 4)
    }
}
