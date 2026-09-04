import AppKit
import ArgoAtoms
@testable import ArgoUI
import Testing

/// A laid-out reading for the cursor's two suites — which row carries it, and how the reader gets
/// one at all. Shared because both are about the same reading, and a second copy of it would be a
/// second answer to what the reader was doing before the case started.
@MainActor enum FeedCursorFixture {
    static let rows = [
        FeedRow(id: 0, content: .prompt(text: "Run the visual contract suite.", shots: [])),
        FeedRow(id: 1, content: .message("Two rows failed.")),
        FeedRow(id: 2, content: .message("Both are the same wash.")),
    ]

    /// The reading, plus the two things a case has to be able to state about it: the handle, which
    /// the coordinator holds weakly, and how the reader is working.
    struct Reading {
        let coordinator: FeedTableCoordinator
        let handle: FeedTableHandle
        let reader: ArgoFocusVisibility
    }

    /// A reading the reader is working by keyboard, which is the state every arrow key arrives in:
    /// a key only reaches the table once the table is first responder.
    ///
    /// The reader is the case's own, never `ArgoFocusVisibility.shared` — these run in parallel,
    /// and a shared answer would make them depend on each other's order.
    static func reading(byKeyboard: Bool = true) async -> Reading {
        let handle = FeedTableHandle()
        let coordinator = await FeedTableFixture.laidOut(
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

    /// The reading in a window, which is what every claim about ARRIVING at it needs: a responder
    /// change is not a change at all without one.
    struct Arrival {
        let coordinator: FeedTableCoordinator
        let table: FeedTableView
        let window: NSWindow
    }

    static func arrival(byKeyboard: Bool = true) async throws -> Arrival {
        let coordinator = await reading(byKeyboard: byKeyboard).coordinator
        let scroller = try #require(coordinator.scroller)
        let table = try #require(coordinator.table)
        let window = NSWindow(
            contentRect: scroller.frame,
            styleMask: [.titled],
            backing: .buffered,
            defer: true,
        )
        window.contentView?.addSubview(scroller)
        return Arrival(coordinator: coordinator, table: table, window: window)
    }
}
