@testable import ArgoUI
import Foundation
import Testing

/// The marks the lane draws when a session will not fit a mark a row — one a Turn (#1173).
///
/// Beside `MinimapRectTests` rather than inside it: the rows' own reported shapes and the coarse
/// marks are two SOURCES for the same lane, and each is worth reading on its own.
@MainActor
@Suite("Minimap Turn rects")
struct MinimapTurnRectTests {
    /// And a mark's PLACE is the row's, which is what makes the coarsening a second source for the
    /// marks rather than a second lane: every mapping between the lane and the reading — the lit
    /// rectangle, the click, the drag — is the same arithmetic at either granularity (#1173).
    @Test @MainActor
    func `a Turn's mark starts exactly where its first row does`() {
        let reading = MinimapReading(
            rows: MinimapGeometryTests.rows(Array(repeating: 40, count: 1031), turnedEvery: 10),
            columnWidth: 620,
            viewportHeight: 600,
        )
        let lane = MinimapGeometry(reading, lane: CGSize(width: 112, height: 600))
        let marks = lane.rects(in: 0 ... 600)

        #expect(marks.count == lane.turns.count)
        #expect(zip(marks, lane.turns).allSatisfy { mark, turn in
            mark.y == lane.rectY(row: turn.rows.lowerBound)
        })
    }

    /// And what a coarse mark SAYS across the lane: how much of the Turn is the one thing the mark
    /// is drawn in. A mark a Turn run to the full measure every time draws a long session as one
    /// solid slab, where a mark a row is ragged because prose is (#1173).
    @Test @MainActor
    func `a Turn's mark runs as far across as its largest part`() {
        let heights = Array(repeating: CGFloat(40), count: 1031)
        var rows = MinimapGeometryTests.rows(heights, turnedEvery: 10)
        // The second Turn half prose and half failed calls; every other Turn is all one thing.
        for at in 10 ..< 15 {
            rows[at].shape = .whole(.failure)
        }
        let lane = MinimapGeometry(
            MinimapReading(rows: rows, columnWidth: 620, viewportHeight: 600),
            lane: CGSize(width: 112, height: 600),
        )
        let marks = lane.rects(in: 0 ... 600)

        #expect(lane.granularity == .turns)
        #expect(marks[0].span == 0 ... 1)
        #expect(marks[1].span == 0 ... 0.5)
        // And the state is what colours it, whichever half is the larger.
        #expect(marks[1].ink == .failure)
    }

    /// The two facts a coarse mark carries answer different questions, and this is the case where
    /// they disagree: one failed call inside a long Turn colours the mark, and the mark still runs
    /// as far across as the Turn's LARGEST part. Coloured by the state's own share it would be a
    /// hairline, which is the thing the state rule exists to stop (#1173).
    @Test @MainActor
    func `a Turn holding one failure is drawn red at its largest part's width`() {
        let heights = Array(repeating: CGFloat(40), count: 1031)
        var rows = MinimapGeometryTests.rows(heights, turnedEvery: 10)
        rows[10].shape = .whole(.failure)
        let lane = MinimapGeometry(
            MinimapReading(rows: rows, columnWidth: 620, viewportHeight: 600),
            lane: CGSize(width: 112, height: 600),
        )
        let marks = lane.rects(in: 0 ... 600)

        #expect(marks[1].ink == .failure)
        // Nine rows of ten are the one other thing the Turn is, and that is the width.
        #expect(marks[1].span == 0 ... 0.9)
    }
}
