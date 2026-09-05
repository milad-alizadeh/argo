@testable import ArgoUI
import Testing

/// When a click has to re-point the deck at the row it is already on (#1247, #10).
///
/// Every other move reaches the deck by `last` changing. This is the one that does not, so it is
/// the one a list has to be told about.
@Suite("A click on the row the deck already draws")
struct RowSelectionDeckTests {
    private let visible = ["a", "b", "c"]

    @Test
    func `clicking the drawn row again is a second act`() {
        var selection = RowSelection<String>()
        selection.click("b")

        let retried = selection.clicked(.plain, on: "b", over: visible)

        #expect(retried)
    }

    @Test
    func `clicking a different row moves the deck by itself`() {
        var selection = RowSelection<String>()
        selection.click("b")

        let retried = selection.clicked(.plain, on: "c", over: visible)

        #expect(!retried)
        #expect(selection.last == "c")
    }

    /// Growing a selection over the drawn row is not a click on it, so nothing is retried.
    @Test
    func `a shift-click across the drawn row retries nothing`() {
        var selection = RowSelection<String>()
        selection.click("a")

        let retried = selection.clicked(.extending, on: "c", over: visible)

        #expect(!retried)
        #expect(selection.last == "a")
    }

    @Test
    func `a cmd-click on the drawn row retries nothing`() {
        var selection = RowSelection<String>()
        selection.click("b")

        let retried = selection.clicked(.toggling, on: "b", over: visible)

        #expect(!retried)
    }
}
