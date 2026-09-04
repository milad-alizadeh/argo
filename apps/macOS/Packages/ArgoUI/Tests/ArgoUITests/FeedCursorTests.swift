import AppKit
@testable import ArgoUI
import Testing

/// Which row in the reading carries the keyboard cursor, and what takes it away again.
///
/// Which row is the table's own `focusedRow`, written by an arrow key and by the deck handing the
/// keyboard back, and by no click path. How the reader comes to have one at all is the other half,
/// and it is `FeedCursorArrivalTests`.
@Suite("Feed keyboard cursor")
@MainActor
struct FeedCursorTests {
    private static let rows = FeedCursorFixture.rows

    @Test
    func `a reading nobody has arrowed through carries no cursor`() async {
        let coordinator = await FeedCursorFixture.reading().coordinator

        #expect(coordinator.cursorRow == nil)
    }

    /// Not one step past it: the reader can see that row, so a first press that skipped it would
    /// read as the key having missed.
    @Test
    func `the first press down shows the cursor on the topmost row in view`() async {
        let coordinator = await FeedCursorFixture.reading().coordinator

        coordinator.step(focusBy: 1)

        #expect(coordinator.cursorRow == 0)
    }

    /// A reading following the newest row is arrowed UP to start reading back through it, so up
    /// reaches for the other end of the view.
    @Test
    func `the first press up shows the cursor on the last row in view`() async {
        let coordinator = await FeedCursorFixture.reading().coordinator

        coordinator.step(focusBy: -1)

        #expect(coordinator.cursorRow == Self.rows.count - 1)
    }

    @Test
    func `arrowing down again moves the cursor one row on`() async {
        let coordinator = await FeedCursorFixture.reading().coordinator
        coordinator.step(focusBy: 1)

        coordinator.step(focusBy: 1)

        #expect(coordinator.cursorRow == 1)
    }

    @Test
    func `the cursor stops at the last row rather than running off the end`() async {
        let coordinator = await FeedCursorFixture.reading().coordinator

        for _ in 0 ..< Self.rows.count + 3 {
            coordinator.step(focusBy: 1)
        }

        #expect(coordinator.cursorRow == Self.rows.count - 1)
    }

    /// A ring left on a row while the composer holds the keys points at the surface the reader is
    /// not working.
    @Test
    func `the cursor goes out when the keyboard leaves the reading`() async {
        let coordinator = await FeedCursorFixture.reading().coordinator
        coordinator.step(focusBy: 1)

        coordinator.noteKeyboard(false)

        #expect(coordinator.cursorRow == nil)
    }

    /// The row is kept rather than forgotten, so a reader who clicks back into the reading arrows
    /// on from where they were rather than from the top of the window.
    @Test
    func `the keyboard coming back lands on the row it left`() async {
        let coordinator = await FeedCursorFixture.reading().coordinator
        coordinator.step(focusBy: 1)
        coordinator.step(focusBy: 1)
        coordinator.noteKeyboard(false)

        coordinator.noteKeyboard(true)

        #expect(coordinator.cursorRow == 1)
    }

    /// The deck's own way home: Escape out of the panel names the row that opened it, and the
    /// reader who left by a key gets the cursor back on it.
    @Test
    func `the deck handing the keyboard back puts the cursor on the row it names`() async {
        let coordinator = await FeedCursorFixture.reading().coordinator
        coordinator.table?.currentEvent = { FeedEventFixture.escape() }

        coordinator.focus(onto: Self.rows[2].id)

        #expect(coordinator.cursorRow == 2)
    }

    /// The other way out of the panel. The row is named exactly as Escape names it, and the reader
    /// who reached for the close button asked for no ring (#1180).
    @Test
    func `the panel closed under the pointer hands back no cursor`() async {
        let coordinator = await FeedCursorFixture.reading().coordinator
        guard let table = coordinator.table else {
            Issue.record("the fixture built no table")
            return
        }
        table.currentEvent = { FeedEventFixture.click(in: table) }

        coordinator.focus(onto: Self.rows[2].id)

        #expect(coordinator.cursorRow == nil)
    }

    /// A surface with no events at all — a specimen, a preview — states the press instead of
    /// having one. Without this the cursor stills come out ringless, which no unit case can see
    /// and only a render can (`FeedPreview.seedCursor`).
    @Test
    func `a hand-back that states the key draws the cursor with no event behind it`() async {
        let coordinator = await FeedCursorFixture.reading().coordinator
        coordinator.table?.currentEvent = { nil }

        coordinator.focus(onto: Self.rows[2].id, byKey: true)

        #expect(coordinator.cursorRow == 2)
    }

    /// The whole of #533 in one case: a reader who arrowed, then reached for the mouse, must not
    /// be left looking at a keyboard cursor. The click lands in a reading the keyboard is already
    /// in, so no responder change reports it and only `mouseDown` can.
    @Test
    func `a click in the reading takes the cursor out of it`() async {
        let coordinator = await FeedCursorFixture.reading().coordinator
        coordinator.step(focusBy: 1)
        guard let table = coordinator.table else {
            Issue.record("the fixture built no table")
            return
        }

        table.mouseDown(with: FeedEventFixture.click(in: table))

        #expect(coordinator.cursorRow == nil)
    }

    /// The way back: the pointer took the cursor out, and a key is the reader asking for it again.
    @Test
    func `arrowing after a click brings the cursor back`() async {
        let coordinator = await FeedCursorFixture.reading().coordinator
        guard let table = coordinator.table else {
            Issue.record("the fixture built no table")
            return
        }
        table.mouseDown(with: FeedEventFixture.click(in: table))

        table.keyDown(with: FeedEventFixture.arrowDown())

        #expect(coordinator.cursorRow == 0)
    }
}
