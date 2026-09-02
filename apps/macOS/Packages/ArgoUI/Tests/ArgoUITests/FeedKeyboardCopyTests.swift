import AppKit
@testable import ArgoUI
import Testing

/// Edit ▸ Copy arriving at the reading (#767) — what makes the chip reachable without a pointer.
///
/// The row it takes is the focused one, and the words are the MENU's set rather than the drawn
/// chip's: a focused prompt answers the key even though a bubble draws no chip.
///
/// Serialized because the last case writes `NSPasteboard.general`.
@Suite("Feed copy by keyboard", .serialized)
@MainActor
struct FeedKeyboardCopyTests {
    private static let rows = [
        FeedRow(id: 0, content: .prompt(text: "Fix the seam", shots: [])),
        FeedRow(id: 1, content: .message("Done. The wash was sampled from the old study.")),
        FeedRow(id: 2, content: .call(RowKindFixture.answeredCall)),
    ]

    private static func reading() -> FeedTableCoordinator {
        FeedTableFixture.laidOut(
            rows,
            in: CGSize(width: 460, height: 800),
            through: FeedTableHandle(),
        )
    }

    @Test
    func `a reading nobody has arrowed through has nothing to take`() {
        let coordinator = Self.reading()

        #expect(coordinator.focusedWords == nil)
    }

    @Test
    func `the cursor's own row is what the key takes, verbatim`() {
        let coordinator = Self.reading()

        coordinator.step(focusBy: 1)
        coordinator.step(focusBy: 1)

        #expect(coordinator.focusedWords == "Done. The wash was sampled from the old study.")
    }

    /// The key is the menu's verb, and the menu offers a prompt.
    @Test
    func `a focused prompt answers the key`() {
        let coordinator = Self.reading()

        coordinator.step(focusBy: 1)

        #expect(coordinator.focusedWords == "Fix the seam")
    }

    /// A call is a line Argo composed from the record, so the key falls through rather than pasting
    /// Argo's own words.
    @Test
    func `a focused call has nothing to hand over`() {
        let coordinator = Self.reading()

        for _ in 1 ... 3 {
            coordinator.step(focusBy: 1)
        }

        #expect(coordinator.focusedRow == 2)
        #expect(coordinator.focusedWords == nil)
    }

    /// Edit ▸ Copy greys out where there is nothing to take.
    @Test
    func `the menu item is offered only where there is something to take`() {
        let coordinator = Self.reading()
        guard let table = coordinator.table else {
            Issue.record("the fixture built no table")
            return
        }
        let item = NSMenuItem(
            title: "Copy",
            action: #selector(FeedTableView.copy(_:)),
            keyEquivalent: "c",
        )

        #expect(table.validateUserInterfaceItem(item) == false)

        coordinator.step(focusBy: 1)

        #expect(table.validateUserInterfaceItem(item))
    }

    /// The whole path the key takes once the menu item claims it, pasteboard included. Restores
    /// what
    /// it found: this is the reader's own pasteboard.
    @Test
    func `the responder action puts the focused row's words on the pasteboard`() {
        let coordinator = Self.reading()
        let board = NSPasteboard.general
        let before = board.string(forType: .string)
        defer { before.map { ArgoPasteboard.put($0) } }

        coordinator.step(focusBy: 1)
        coordinator.step(focusBy: 1)
        coordinator.table?.copy(nil)

        #expect(board.string(forType: .string) == "Done. The wash was sampled from the old study.")
    }
}
