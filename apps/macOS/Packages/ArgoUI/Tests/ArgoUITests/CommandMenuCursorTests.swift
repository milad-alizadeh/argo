import ArgoEngine
@testable import ArgoUI
import Testing

/// The `/` menu is navigable and selectable by keyboard alone (#685), which is a behaviour rather
/// than a look — so it is asserted here and not left to a render.
@Suite("Command menu cursor")
struct CommandMenuCursorTests {
    @Test
    func `it starts on the first row`() {
        var cursor = CommandMenuCursor()
        cursor.settle(over: rows)

        #expect(cursor.marked == "/ask-argo")
    }

    @Test
    func `down and up walk the list`() {
        var cursor = CommandMenuCursor()
        cursor.settle(over: rows)
        cursor.down(over: rows)
        #expect(cursor.marked == "/code-review")

        cursor.up(over: rows)
        #expect(cursor.marked == "/ask-argo")
    }

    /// It does not wrap. A list of seventy-odd things that jumped back to the top would read as the
    /// cursor having been lost rather than as having reached the end.
    @Test
    func `it stops at both ends rather than wrapping`() {
        var cursor = CommandMenuCursor()
        cursor.settle(over: rows)
        cursor.up(over: rows)
        #expect(cursor.marked == "/ask-argo")

        cursor.down(over: rows)
        cursor.down(over: rows)
        cursor.down(over: rows)
        #expect(cursor.marked == "/implement")
    }

    /// Held by command and not by index, because filtering reorders the list underneath: a cursor
    /// on an index would land on whatever row inherited the number.
    @Test
    func `it stays on its row while that row survives a filter`() {
        var cursor = CommandMenuCursor()
        cursor.settle(over: rows)
        cursor.down(over: rows)

        cursor.settle(over: [rows[1], rows[2]])
        #expect(cursor.marked == "/code-review")
    }

    @Test
    func `it goes back to the top when its row is filtered away`() {
        var cursor = CommandMenuCursor()
        cursor.settle(over: rows)
        cursor.down(over: rows)

        cursor.settle(over: [rows[0]])
        #expect(cursor.marked == "/ask-argo")
    }

    /// An empty list leaves nothing marked, which is what leaves ⏎ to the field — a line nothing
    /// matched still sends as written (decision 8).
    @Test
    func `an empty list marks nothing, so Return stays the field's`() {
        var cursor = CommandMenuCursor()
        cursor.settle(over: rows)
        cursor.settle(over: [])

        #expect(cursor.marked == nil)
        #expect(cursor.row(in: []) == nil)
    }

    private let rows = CommandMenuProjection.menu(
        for: "/",
        in: CommandCatalog(
            commands: [
                Command(name: "ask-argo", description: nil, origin: .project),
                Command(name: "code-review", description: nil, origin: .project),
                Command(name: "implement", description: nil, origin: .project),
            ],
            builtins: .read,
        ),
    )?.rows ?? []
}
