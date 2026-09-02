@testable import ArgoUI
import Testing

/// Where the lane breaks the reading into Turns.
///
/// Held as a suite because the boundaries are the one thing the lane and the feed must agree on
/// exactly: a block that ends a row early draws its Ion Blue line past the Turn it stands for, and
/// a hover then names the wrong prompt — which reads as a labelling bug, not as a boundary one.
@Suite("Minimap Turns")
struct MinimapTurnTests {
    private static func asked(_ words: String) -> MinimapRow {
        MinimapRow(height: 40, prompt: words)
    }

    private static func said() -> MinimapRow {
        MinimapRow(height: 40)
    }

    private static func ended() -> MinimapRow {
        MinimapRow(height: 8, endsTurn: true)
    }

    @Test
    func `a reading with nothing in it holds no Turns`() {
        #expect(MinimapTurn.extents(of: []).isEmpty)
    }

    @Test
    func `a Turn runs from what was asked to what answered it`() {
        let turns = MinimapTurn.extents(of: [Self.asked("Fix the seam"), Self.said(), Self.said()])
        #expect(turns == [MinimapTurn(rows: 0 ... 2, prompt: "Fix the seam")])
    }

    @Test
    func `a second prompt opens a second Turn and closes the one before it`() {
        let turns = MinimapTurn.extents(of: [
            Self.asked("First"), Self.said(), Self.asked("Second"), Self.said(),
        ])
        #expect(turns == [
            MinimapTurn(rows: 0 ... 1, prompt: "First"),
            MinimapTurn(rows: 2 ... 3, prompt: "Second"),
        ])
    }

    /// The stop-reason row is punctuation ON the Turn it ended, so it belongs to that Turn and not
    /// to the one after it. The feed draws it the same way, under the work rather than over the
    /// next prompt.
    @Test
    func `a stop-reason row closes the Turn it stands under`() {
        let turns = MinimapTurn.extents(of: [
            Self.asked("Ship it"), Self.said(), Self.ended(), Self.asked("Again"), Self.said(),
        ])
        #expect(turns == [
            MinimapTurn(rows: 0 ... 2, prompt: "Ship it"),
            MinimapTurn(rows: 3 ... 4, prompt: "Again"),
        ])
    }

    /// A resumed Session's record starts mid-conversation: the rows are there and the prompt that
    /// caused them is in a file nobody read. The stretch is still a Turn, and the lane still draws
    /// a block over it — a gap here would read as a session that did nothing.
    @Test
    func `a stretch that opens with no prompt is a Turn with no words`() {
        let turns = MinimapTurn.extents(of: [Self.said(), Self.ended(), Self.asked("Now what")])
        #expect(turns == [
            MinimapTurn(rows: 0 ... 1, prompt: nil),
            MinimapTurn(rows: 2 ... 2, prompt: "Now what"),
        ])
    }

    @Test
    func `rows after the last stop reason are the Turn still in flight`() {
        let turns = MinimapTurn.extents(of: [Self.asked("Go"), Self.ended(), Self.said()])
        #expect(turns.last == MinimapTurn(rows: 2 ... 2, prompt: nil))
    }

    @Test
    func `two stop reasons in a row are two Turns rather than one`() {
        let turns = MinimapTurn.extents(of: [Self.ended(), Self.ended()])
        #expect(turns == [
            MinimapTurn(rows: 0 ... 0, prompt: nil), MinimapTurn(rows: 1 ... 1, prompt: nil),
        ])
    }
}
