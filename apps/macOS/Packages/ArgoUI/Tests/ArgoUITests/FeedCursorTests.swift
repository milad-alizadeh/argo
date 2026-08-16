import AppKit
@testable import ArgoUI
import Testing

/// The keyboard cursor in the reading: which row carries it, and when there is one at all.
///
/// Which row is the table's own `focusedRow`, written by an arrow key and by the deck handing the
/// keyboard back, and by no click path. Whether there is one at all is the harder half and the one
/// #533 is about: the reading has to hold the keyboard AND the keyboard has to be what the reader
/// is working with, because a click makes this the first responder every bit as much as a Tab.
@Suite("Feed keyboard cursor")
@MainActor
struct FeedCursorTests {
    private static let rows = [
        FeedRow(id: 0, content: .prompt("Run the visual contract suite.")),
        FeedRow(id: 1, content: .message("Two rows failed.")),
        FeedRow(id: 2, content: .message("Both are the same wash.")),
    ]

    /// A laid-out reading, plus the two things a case has to be able to state about it: the
    /// handle, which the coordinator holds weakly, and how the reader is working.
    private struct Reading {
        let coordinator: FeedTableCoordinator
        let handle: FeedTableHandle
        let reader: ArgoFocusVisibility
    }

    /// A reading the reader is working by keyboard, which is the state every arrow key arrives in:
    /// a key only reaches the table once the table is first responder.
    ///
    /// The reader is this case's own, never `ArgoFocusVisibility.shared` — these run in parallel,
    /// and a shared answer would make them depend on each other's order.
    private static func reading(byKeyboard: Bool = true) -> Reading {
        let handle = FeedTableHandle()
        let coordinator = FeedTableFixture.laidOut(
            rows,
            in: CGSize(width: 460, height: 800),
            through: handle,
        )
        let reader = ArgoFocusVisibility()
        reader.note(byKeyboard ? .keyDown : .leftMouseDown)
        coordinator.table?.reader = reader
        coordinator.noteKeyboard(byKeyboard)
        return Reading(coordinator: coordinator, handle: handle, reader: reader)
    }

    @Test
    func `a reading nobody has arrowed through carries no cursor`() {
        let coordinator = Self.reading().coordinator

        #expect(coordinator.cursorRow == nil)
    }

    /// Not one step past it: the reader can see that row, so a first press that skipped it would
    /// read as the key having missed.
    @Test
    func `the first press down shows the cursor on the topmost row in view`() {
        let coordinator = Self.reading().coordinator

        coordinator.step(focusBy: 1)

        #expect(coordinator.cursorRow == 0)
    }

    /// A reading following the newest row is arrowed UP to start reading back through it, so up
    /// reaches for the other end of the view.
    @Test
    func `the first press up shows the cursor on the last row in view`() {
        let coordinator = Self.reading().coordinator

        coordinator.step(focusBy: -1)

        #expect(coordinator.cursorRow == Self.rows.count - 1)
    }

    @Test
    func `arrowing down again moves the cursor one row on`() {
        let coordinator = Self.reading().coordinator
        coordinator.step(focusBy: 1)

        coordinator.step(focusBy: 1)

        #expect(coordinator.cursorRow == 1)
    }

    @Test
    func `the cursor stops at the last row rather than running off the end`() {
        let coordinator = Self.reading().coordinator

        for _ in 0 ..< Self.rows.count + 3 {
            coordinator.step(focusBy: 1)
        }

        #expect(coordinator.cursorRow == Self.rows.count - 1)
    }

    /// A ring left on a row while the composer holds the keys points at the surface the reader is
    /// not working.
    @Test
    func `the cursor goes out when the keyboard leaves the reading`() {
        let coordinator = Self.reading().coordinator
        coordinator.step(focusBy: 1)

        coordinator.noteKeyboard(false)

        #expect(coordinator.cursorRow == nil)
    }

    /// The row is kept rather than forgotten, so a reader who clicks back into the reading arrows
    /// on from where they were rather than from the top of the window.
    @Test
    func `the keyboard coming back lands on the row it left`() {
        let coordinator = Self.reading().coordinator
        coordinator.step(focusBy: 1)
        coordinator.step(focusBy: 1)
        coordinator.noteKeyboard(false)

        coordinator.noteKeyboard(true)

        #expect(coordinator.cursorRow == 1)
    }

    /// The deck's own way home: closing the panel names the row that opened it.
    @Test
    func `the deck handing the keyboard back puts the cursor on the row it names`() {
        let coordinator = Self.reading().coordinator

        coordinator.focus(onto: Self.rows[2].id)

        #expect(coordinator.cursorRow == 2)
    }

    /// The whole of #533 in one case: a reader who arrowed, then reached for the mouse, must not
    /// be left looking at a keyboard cursor. The click lands in a reading the keyboard is already
    /// in, so no responder change reports it and only `mouseDown` can.
    @Test
    func `a click in the reading takes the cursor out of it`() {
        let coordinator = Self.reading().coordinator
        coordinator.step(focusBy: 1)
        guard let table = coordinator.table else {
            Issue.record("the fixture built no table")
            return
        }

        table.mouseDown(with: Self.click(in: table))

        #expect(coordinator.cursorRow == nil)
    }

    /// The other half, against a real window: a click that lands in a reading the keyboard was NOT
    /// in makes the table first responder exactly as a Tab does, and only one of the two is a
    /// reader asking for a cursor.
    @Test
    func `the keyboard arriving under a pointer draws no cursor`() {
        let coordinator = Self.reading(byKeyboard: false).coordinator
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

        #expect(coordinator.cursorRow == nil)
    }

    /// The way back: the pointer took the cursor out, and a key is the reader asking for it again.
    @Test
    func `arrowing after a click brings the cursor back`() {
        let coordinator = Self.reading().coordinator
        guard let table = coordinator.table else {
            Issue.record("the fixture built no table")
            return
        }
        table.mouseDown(with: Self.click(in: table))

        table.keyDown(with: Self.arrowDown())

        #expect(coordinator.cursorRow == 0)
    }

    /// A real left-click at the table's own origin. Synthesised rather than stated, because the
    /// claim above is about what `NSTableView` does with a press.
    private static func click(in table: NSTableView) -> NSEvent {
        NSEvent.mouseEvent(
            with: .leftMouseDown,
            location: table.bounds.origin,
            modifierFlags: [],
            timestamp: 0,
            windowNumber: 0,
            context: nil,
            eventNumber: 0,
            clickCount: 1,
            pressure: 1,
        ) ?? NSEvent()
    }

    /// A real down-arrow press, for the same reason: the claim is about what the table does with
    /// the key, not about what `step(focusBy:)` does when called.
    private static func arrowDown() -> NSEvent {
        NSEvent.keyEvent(
            with: .keyDown,
            location: .zero,
            modifierFlags: [.function, .numericPad],
            timestamp: 0,
            windowNumber: 0,
            context: nil,
            characters: "\u{F701}",
            charactersIgnoringModifiers: "\u{F701}",
            isARepeat: false,
            keyCode: 125,
        ) ?? NSEvent()
    }
}
