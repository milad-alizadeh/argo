import AppKit
@testable import ArgoUI
import Testing

/// The keyboard cursor in the reading: which row carries it, and when there is one at all.
///
/// The feed needs no pointer gate the way the drawer does (#533). Focus here is the table's own
/// `focusedRow`, written by an arrow key and by the deck handing the keyboard back — a click
/// reaches a row's controls and moves it nowhere. What the cursor does need is the keyboard to
/// still be IN the reading, which is what these cases are mostly about.
@Suite("Feed keyboard cursor")
@MainActor
struct FeedCursorTests {
    private static let rows = [
        FeedRow(id: 0, content: .prompt("Run the visual contract suite.")),
        FeedRow(id: 1, content: .message("Two rows failed.")),
        FeedRow(id: 2, content: .message("Both are the same wash.")),
    ]

    /// A laid-out reading with the keyboard already in it, which is the state every arrow key
    /// arrives in: a key only reaches the table once the table is first responder.
    private static func reading() -> (FeedTableCoordinator, FeedTableHandle) {
        let handle = FeedTableHandle()
        let coordinator = FeedTableFixture.laidOut(
            rows,
            in: CGSize(width: 460, height: 800),
            through: handle,
        )
        coordinator.noteKeyboard(true)
        return (coordinator, handle)
    }

    @Test
    func `a reading nobody has arrowed through carries no cursor`() {
        let (coordinator, _) = Self.reading()

        #expect(coordinator.cursorRow == nil)
    }

    /// Not one step past it: the reader can see that row, so a first press that skipped it would
    /// read as the key having missed.
    @Test
    func `the first press down shows the cursor on the topmost row in view`() {
        let (coordinator, _) = Self.reading()

        coordinator.step(focusBy: 1)

        #expect(coordinator.cursorRow == 0)
    }

    /// A reading following the newest row is arrowed UP to start reading back through it, so up
    /// reaches for the other end of the view.
    @Test
    func `the first press up shows the cursor on the last row in view`() {
        let (coordinator, _) = Self.reading()

        coordinator.step(focusBy: -1)

        #expect(coordinator.cursorRow == Self.rows.count - 1)
    }

    @Test
    func `arrowing down again moves the cursor one row on`() {
        let (coordinator, _) = Self.reading()
        coordinator.step(focusBy: 1)

        coordinator.step(focusBy: 1)

        #expect(coordinator.cursorRow == 1)
    }

    @Test
    func `the cursor stops at the last row rather than running off the end`() {
        let (coordinator, _) = Self.reading()

        for _ in 0 ..< Self.rows.count + 3 {
            coordinator.step(focusBy: 1)
        }

        #expect(coordinator.cursorRow == Self.rows.count - 1)
    }

    /// A ring left on a row while the composer holds the keys points at the surface the reader is
    /// not working.
    @Test
    func `the cursor goes out when the keyboard leaves the reading`() {
        let (coordinator, _) = Self.reading()
        coordinator.step(focusBy: 1)

        coordinator.noteKeyboard(false)

        #expect(coordinator.cursorRow == nil)
    }

    /// The row is kept rather than forgotten, so a reader who clicks back into the reading arrows
    /// on from where they were rather than from the top of the window.
    @Test
    func `the keyboard coming back lands on the row it left`() {
        let (coordinator, _) = Self.reading()
        coordinator.step(focusBy: 1)
        coordinator.step(focusBy: 1)
        coordinator.noteKeyboard(false)

        coordinator.noteKeyboard(true)

        #expect(coordinator.cursorRow == 1)
    }

    /// The deck's own way home: closing the panel names the row that opened it.
    @Test
    func `the deck handing the keyboard back puts the cursor on the row it names`() {
        let (coordinator, _) = Self.reading()

        coordinator.focus(onto: Self.rows[2].id)

        #expect(coordinator.cursorRow == 2)
    }

    /// The wiring itself, against a real window: everything above states the keyboard's arrival
    /// directly, and this is the case that proves the table reports it.
    @Test
    func `the reading becoming first responder is the keyboard arriving`() {
        let (coordinator, _) = Self.reading()
        coordinator.noteKeyboard(false)
        guard let scroller = coordinator.scroller, let table = coordinator.table else {
            Issue.record("the fixture built no table")
            return
        }
        let window = NSWindow(
            contentRect: scroller.frame,
            styleMask: [.titled],
            backing: .buffered,
            defer: true,
        )
        window.contentView?.addSubview(scroller)
        coordinator.focus(onto: Self.rows[1].id)

        window.makeFirstResponder(table)

        #expect(coordinator.cursorRow == 1)
    }
}
