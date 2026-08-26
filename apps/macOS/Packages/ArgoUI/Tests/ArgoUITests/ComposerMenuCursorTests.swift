import ArgoEngine
@testable import ArgoUI
import Testing

/// Both composer menus are navigable and selectable by keyboard alone (#685, #687), which is a
/// behaviour rather than a look — so it is asserted here and not left to a render.
@Suite("Composer menu cursor")
struct ComposerMenuCursorTests {
    @Test
    func `it starts on the first row`() {
        var cursor = ComposerMenuCursor()
        cursor.settle(over: ids)

        #expect(cursor.marked == "/ask-argo")
    }

    @Test
    func `down and up walk the list`() {
        var cursor = ComposerMenuCursor()
        cursor.settle(over: ids)
        cursor.down(over: ids)
        #expect(cursor.marked == "/code-review")

        cursor.up(over: ids)
        #expect(cursor.marked == "/ask-argo")
    }

    /// It does not wrap. A list of seventy-odd things that jumped back to the top would read as the
    /// cursor having been lost rather than as having reached the end.
    @Test
    func `it stops at both ends rather than wrapping`() {
        var cursor = ComposerMenuCursor()
        cursor.settle(over: ids)
        cursor.up(over: ids)
        #expect(cursor.marked == "/ask-argo")

        cursor.down(over: ids)
        cursor.down(over: ids)
        cursor.down(over: ids)
        #expect(cursor.marked == "/implement")
    }

    /// Held by command and not by index, because filtering reorders the list underneath: a cursor
    /// on an index would land on whatever row inherited the number.
    @Test
    func `it stays on its row while that row survives a filter`() {
        var cursor = ComposerMenuCursor()
        cursor.settle(over: ids)
        cursor.down(over: ids)

        cursor.settle(over: [ids[1], ids[2]])
        #expect(cursor.marked == "/code-review")
    }

    @Test
    func `it goes back to the top when its row is filtered away`() {
        var cursor = ComposerMenuCursor()
        cursor.settle(over: ids)
        cursor.down(over: ids)

        cursor.settle(over: [ids[0]])
        #expect(cursor.marked == "/ask-argo")
    }

    /// An empty list leaves nothing marked, which is what leaves ⏎ to the field — a line nothing
    /// matched still sends as written (decision 8).
    @Test
    func `an empty list marks nothing, so Return stays the field's`() {
        var cursor = ComposerMenuCursor()
        cursor.settle(over: ids)
        cursor.settle(over: [])

        #expect(cursor.marked == nil)
        #expect(cursor.row(in: [] as [CommandMenuProjection.Row]) == nil)
    }

    /// One cursor serves both menus (#687), so it has to answer over the `@` menu's rows too —
    /// keyed by path there, where the `/` menu keys by command.
    @Test
    func `the same cursor walks the file menu, keyed by path`() {
        let rows = WorkspaceFileProjection.menu(
            for: "@",
            in: ["README.md", "docs/adr/ADR-0024.md"],
            touched: [],
        )?.rows ?? []
        var cursor = ComposerMenuCursor()
        cursor.settle(over: rows.map(\.id))
        cursor.down(over: rows.map(\.id))

        #expect(cursor.row(in: rows)?.path == "docs/adr/ADR-0024.md")
    }

    /// The `@` tree is read asynchronously, so its rows land AFTER the keystroke that opened the
    /// menu, and the cursor has to settle again when they do. Settled only over the empty list it
    /// stayed nil, and ⏎ fell past both menus and sent the half-typed line.
    @Test
    func `a list that arrives late still gets the cursor on its top row`() {
        var cursor = ComposerMenuCursor()
        cursor.settle(over: [])
        #expect(cursor.marked == nil)

        cursor.settle(over: ids)

        #expect(cursor.marked == "/ask-argo")
    }

    private let ids = CommandMenuProjection.menu(
        for: "/",
        in: CommandCatalog(
            commands: [
                Command(name: "ask-argo", description: nil, origin: .project),
                Command(name: "code-review", description: nil, origin: .project),
                Command(name: "implement", description: nil, origin: .project),
            ],
            builtins: .read,
        ),
    )?.rows.map(\.id) ?? []
}
