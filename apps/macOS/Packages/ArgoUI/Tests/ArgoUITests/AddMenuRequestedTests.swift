import ArgoEngine
@testable import ArgoUI
import Testing

/// What picking one of `AddMenu`'s rows opens — the SAME full listing the corresponding sigil
/// would, off an empty query — and what puts that listing away again (design decision 11,
/// `cockpit-composer-picker.md`, #689).
///
/// Which rows `AddMenu` carries, and opening or closing the drawer itself, is `AddMenuTests`.
@Suite("Add menu — a requested listing")
struct AddMenuRequestedTests {
    @Test
    func `picking the files row opens the same listing @ would`() throws {
        var menus = ComposerMenus()
        menus.addOpened()

        let asks = menus.addMenuPicked(Self.filesRow)
        menus.workspaceAnswered(Self.tree)

        #expect(asks.files)
        #expect(menus.isAddMenuOpen == false)
        let listing = try #require(menus.listing(on: Self.line()))
        #expect(listing.sigil == .file)
        #expect(listing.rows.map(\.id) == Self.tree)
    }

    @Test
    func `picking the commands row opens the same listing slash would`() throws {
        var menus = ComposerMenus()
        menus.addOpened()

        let asks = menus.addMenuPicked(Self.commandsRow)
        menus.commandsAnswered(Self.catalog, to: asks.generation)

        #expect(asks.commands)
        #expect(menus.isAddMenuOpen == false)
        let listing = try #require(menus.listing(on: Self.line()))
        #expect(listing.sigil == .command)
        #expect(listing.rows.map(\.id) == ["/implement"])
    }

    /// The sigil was never typed, so a pick has nothing of its own to drop — unlike a typed `/` or
    /// `@`, which drops the sigil and whatever was typed after it.
    @Test
    func `a pick off a requested listing drops nothing`() throws {
        var menus = ComposerMenus()
        menus.addOpened()
        let asks = menus.addMenuPicked(Self.commandsRow)
        menus.commandsAnswered(Self.catalog, to: asks.generation)
        menus.settle(on: Self.line())

        let picked = try #require(menus.picked(on: Self.line()))

        #expect(picked == ComposerMenu.Pick(text: "/implement ", dropping: 0))
    }

    @Test
    func `the requested listing still reads a catalog nobody has fetched yet`() throws {
        var menus = ComposerMenus()
        menus.addOpened()

        menus.addMenuPicked(Self.commandsRow)

        let listing = try #require(menus.listing(on: Self.line()))
        #expect(listing.isReading)
    }

    // MARK: - What puts a requested listing away

    /// Typing means the reader moved from browsing to writing, so the requested listing goes —
    /// same as the field's own text now driving what opens.
    @Test
    func `typing after a requested listing closes it`() {
        var menus = ComposerMenus()
        menus.addOpened()
        let asks = menus.addMenuPicked(Self.commandsRow)
        menus.commandsAnswered(Self.catalog, to: asks.generation)

        menus.lineChanged(from: "", to: Self.line(text: "hello"))

        #expect(menus.listing(on: Self.line(text: "hello")) == nil)
    }

    @Test
    func `an Escape puts a requested listing away`() {
        var menus = ComposerMenus()
        menus.addOpened()
        let asks = menus.addMenuPicked(Self.commandsRow)
        menus.commandsAnswered(Self.catalog, to: asks.generation)

        let swallowed = menus.dismissed(on: Self.line())

        #expect(swallowed)
        #expect(menus.listing(on: Self.line()) == nil)
    }

    /// After the change, a `/` line opens the ordinary TEXT-driven listing again — not the
    /// requested one, which would carry `dropping: 0` rather than the query's own count.
    @Test
    func `a Session change puts a requested listing away`() throws {
        var menus = ComposerMenus()
        menus.addOpened()
        let asks = menus.addMenuPicked(Self.commandsRow)
        menus.commandsAnswered(Self.catalog, to: asks.generation)

        menus.sessionChanged(to: Self.line(text: "/imp"))

        let listing = try #require(menus.listing(on: Self.line(text: "/imp")))
        #expect(listing.isReading)
        #expect(listing.dropping == 4)
    }

    // MARK: - Keyboard

    @Test
    func `the arrows walk AddMenu's own rows`() {
        var menus = ComposerMenus()
        menus.addOpened()
        menus.settle(on: Self.line())

        let walked = menus.walk(.walkDown, on: Self.line())

        #expect(walked)
        #expect(menus.current == "commands")
    }

    @Test
    func `a Return over AddMenu answers the row under the cursor`() throws {
        var menus = ComposerMenus()
        menus.addOpened()
        menus.settle(on: Self.line())

        let row = try #require(menus.addMenuPick(on: Self.line()))

        #expect(row.id == "files")
    }

    @Test
    func `a Return over a line with no menu at all picks no AddMenu row`() {
        let menus = ComposerMenus()

        #expect(menus.addMenuPick(on: Self.line()) == nil)
    }

    private static let filesRow = ComposerMenu.AddRow(
        id: "files",
        label: "Files in this Workspace",
        sigil: .file,
    )

    private static let commandsRow = ComposerMenu.AddRow(
        id: "commands",
        label: "Skills & commands",
        sigil: .command,
    )

    private static let tree = ["README.md", "docs/adr/ADR-0024-session-drive-port.md"]

    private static let catalog = CommandCatalog(
        commands: [Command(name: "implement", description: nil, origin: .project)],
        builtins: .read,
    )

    private static func line(
        text: String = "",
        canRunCommands: Bool = true,
        workspaceRoot: String? = "/tmp/argo",
    )
        -> ComposerMenuLine {
        ComposerMenuLine(text: text, canRunCommands: canRunCommands, workspaceRoot: workspaceRoot)
    }
}
