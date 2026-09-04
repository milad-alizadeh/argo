import ArgoEngine
@testable import ArgoUI
import Testing

/// Both composer menus are walkable and pickable by keyboard alone over the rows actually drawn
/// (#685, #687, #752) — so what ⏎ takes cannot fall out of step with the list on screen.
///
/// `ComposerMenuCursorTests` asserts the cursor by itself; this asserts it against a listing.
@Suite("Composer menu keyboard")
struct ComposerMenuKeyboardTests {
    @Test
    func `the cursor starts on the top row of the drawn listing`() throws {
        var menus = Self.opened(on: Self.line("/"))

        menus.settle(on: Self.line("/"))

        let rows = try #require(menus.listing(on: Self.line("/"))?.rows)
        #expect(menus.current == rows.first?.id)
    }

    @Test
    func `an arrow moves the cursor to the next row of the drawn listing`() throws {
        let line = Self.line("/")
        var menus = Self.opened(on: line)
        menus.settle(on: line)
        let listing = try #require(menus.listing(on: line))

        let walked = menus.walk(.walkDown, on: line)

        #expect(walked)
        #expect(menus.current == listing.rows[1].id)
        #expect(menus.picked(on: line) == listing.pick(listing.rows[1]))
    }

    /// `false` where there is no menu, so the field's own caret movement is untouched on every line
    /// that opens nothing.
    @Test
    func `an arrow over a line with no menu is left to the caret`() {
        var menus = ComposerMenus()

        let walked = menus.walk(.walkDown, on: Self.line("just some prose"))

        #expect(walked == false)
    }

    /// Tab takes the row Return would (#1181), so the two keys can never take different rows: the
    /// one spelling of the pick answers both.
    @Test
    func `the Tab key is not a walk, and takes what Return takes`() {
        let line = Self.line("/imp")
        var menus = Self.opened(on: line)
        menus.settle(on: line)

        #expect(menus.walk(.complete, on: line) == false)
        #expect(menus.picked(on: line) == ComposerMenu.Pick(text: "/implement ", dropping: 4))
    }

    @Test
    func `the Return key takes the row under the cursor`() throws {
        let line = Self.line("/imp")
        var menus = Self.opened(on: line)
        menus.settle(on: line)

        let picked = try #require(menus.picked(on: line))
        #expect(picked == ComposerMenu.Pick(text: "/implement ", dropping: 4))
    }

    /// A line nothing matched still sends as written (design decision 8).
    @Test
    func `a line that opens no menu picks nothing on Return`() {
        let menus = ComposerMenus()

        #expect(menus.picked(on: Self.line("just some prose")) == nil)
    }

    /// The bug that shipped: the `@` tree is read asynchronously, so its rows land after the
    /// keystroke that opened the menu. Settled only over the empty list the cursor stayed nil, and
    /// ⏎ fell past both menus and sent the half-typed line instead of picking the top row.
    @Test
    func `a tree that arrives late still puts Return on its top row`() throws {
        var menus = ComposerMenus()
        let line = Self.line("Have a look at @READ")
        menus.lineChanged(from: "", to: line)
        menus.settle(on: line)
        #expect(menus.picked(on: line) == nil)

        menus.workspaceAnswered(["README.md"])
        menus.settle(on: line)

        let picked = try #require(menus.picked(on: line))
        #expect(picked.text == "@README.md ")
    }

    /// A menu with its catalog answered, which is what every case above is about the rows of.
    private static func opened(on line: ComposerMenuLine) -> ComposerMenus {
        var menus = ComposerMenus()
        let asks = menus.lineChanged(from: "", to: line)
        menus.commandsAnswered(catalog, to: asks.generation)
        return menus
    }

    private static let catalog = CommandCatalog(
        commands: [
            Command(name: "implement", description: nil, origin: .project),
            Command(name: "code-review", description: nil, origin: .project),
        ],
        builtins: .read,
    )

    private static func line(_ text: String) -> ComposerMenuLine {
        ComposerMenuLine(text: text, canRunCommands: true, workspaceRoot: "/tmp/argo")
    }
}
