import ArgoEngine
@testable import ArgoUI
import Testing

/// The composition the two menus share: which one a line opens, where Escape leaves it, what a
/// Session change drops, and what ⏎ picks (#752).
///
/// Every rule here was an `.onChange` on `SessionComposer`'s body until this suite existed, which
/// is why the one composition with a shipped-bug history had never been asserted.
@Suite("Composer menus")
struct ComposerMenusTests {
    // MARK: - Which menu the line opens

    @Test
    func `a slash at the head of the line opens the command menu`() {
        var menus = ComposerMenus()
        let line = Self.line("/imp")
        menus.lineChanged(from: "", to: line, commands: { Self.catalog })

        #expect(menus.listing(on: line)?.sigil == ComposerMenu.Sigil.command)
    }

    /// A `codex` Session declares no command surface, so `/` is a word it is being told rather than
    /// a menu (design decision 14). The `@` menu is offered on one condition less.
    @Test
    func `a Session that runs no commands opens no command menu`() {
        var line = Self.line("/imp")
        line.canRunCommands = false
        var menus = ComposerMenus()
        menus.lineChanged(from: "", to: line, commands: { Self.catalog })

        #expect(menus.listing(on: line) == nil)
    }

    @Test
    func `an at sign opens the file menu once the Workspace tree has answered`() {
        var menus = ComposerMenus()
        let line = Self.line("@READ")
        menus.lineChanged(from: "", to: line, commands: { Self.catalog })
        menus.read(Self.tree)

        #expect(menus.listing(on: line)?.sigil == ComposerMenu.Sigil.file)
    }

    /// "No file matches" is a statement about a tree, and there is no tree here to have looked in.
    @Test
    func `an at sign over a tree still being read opens nothing at all`() {
        var menus = ComposerMenus()
        let line = Self.line("@READ")
        menus.lineChanged(from: "", to: line, commands: { Self.catalog })

        #expect(menus.listing(on: line) == nil)
    }

    @Test
    func `an at sign with no Workspace to name a file in opens nothing`() {
        var line = Self.line("@READ")
        line.workspaceRoot = nil
        var menus = ComposerMenus()
        menus.lineChanged(from: "", to: line, commands: { Self.catalog })
        menus.read(Self.tree)

        #expect(menus.listing(on: line) == nil)
    }

    /// The tree is read on the token OPENING and not on every keystroke, because the Workspace does
    /// not change while a word is being typed into it.
    @Test
    func `typing on inside a mention does not read the Workspace again`() {
        var menus = ComposerMenus()

        let readsAgain = menus.lineChanged(
            from: "@REA",
            to: Self.line("@READ"),
            commands: { Self.catalog },
        )

        #expect(readsAgain == false)
    }

    // MARK: - Escape

    /// Not a mode: the next keystroke asks for it back, because typing on is the reader still
    /// looking for a command.
    @Test
    func `an Escape puts the menu away until the line changes`() {
        var menus = ComposerMenus()
        let line = Self.line("/imp")
        menus.lineChanged(from: "", to: line, commands: { Self.catalog })

        let swallowed = menus.dismissed(on: line)

        #expect(swallowed)
        #expect(menus.listing(on: line) == nil)

        menus.lineChanged(from: line.text, to: Self.line("/impl"), commands: { Self.catalog })
        #expect(menus.listing(on: Self.line("/impl")) != nil)
    }

    /// It answers whether it DID anything, because the field holds the keyboard: an Escape
    /// swallowed with no menu open is an Escape the permission footer's `esc denies` never sees.
    @Test
    func `an Escape over a line with no menu is left to the responder chain`() {
        var menus = ComposerMenus()
        let line = Self.line("just some prose")

        let swallowed = menus.dismissed(on: line)

        #expect(swallowed == false)
    }

    // MARK: - A different Session

    /// The tree belongs to the Session that was read, so it goes when the composer is pointed at
    /// another one — a stale list would offer files from somebody else's Workspace.
    @Test
    func `a Session change drops the file list`() {
        var menus = ComposerMenus()
        let line = Self.line("@READ")
        menus.lineChanged(from: "", to: line, commands: { Self.catalog })
        menus.read(Self.tree)

        menus.sessionChanged(to: line, commands: { Self.catalog })

        #expect(menus.listing(on: line) == nil)
    }

    @Test
    func `a Session change over an open mention asks for the new Workspace`() {
        var menus = ComposerMenus()

        let readsAgain = menus.sessionChanged(to: Self.line("@READ"), commands: { Self.catalog })

        #expect(readsAgain)
    }

    // MARK: - The cursor and what ⏎ picks

    /// The cursor walks the listing that is DRAWN, so the row under it and the row ⏎ takes cannot
    /// fall out of step with the list on screen.
    @Test
    func `the cursor walks the drawn listing`() throws {
        var menus = ComposerMenus()
        let line = Self.line("/")
        menus.lineChanged(from: "", to: line, commands: { Self.catalog })
        menus.settle(on: line)
        let rows = try #require(menus.listing(on: line)?.rows)

        #expect(menus.current == rows.first?.id)

        let walked = menus.walk(.walkDown, on: line)

        #expect(walked)
        #expect(menus.current == rows[1].id)
    }

    /// `false` where there is no menu, so the field's own caret movement is untouched on every line
    /// that opens nothing.
    @Test
    func `an arrow over a line with no menu is left to the caret`() {
        var menus = ComposerMenus()

        let walked = menus.walk(.walkDown, on: Self.line("just some prose"))

        #expect(walked == false)
    }

    @Test
    func `the Return key takes the row under the cursor`() throws {
        var menus = ComposerMenus()
        let line = Self.line("/imp")
        menus.lineChanged(from: "", to: line, commands: { Self.catalog })
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
        let line = Self.line("@READ")
        menus.lineChanged(from: "", to: line, commands: { Self.catalog })
        menus.settle(on: line)
        #expect(menus.picked(on: line) == nil)

        menus.read(Self.tree)
        menus.settle(on: line)

        let picked = try #require(menus.picked(on: line))
        #expect(picked.text == "@README.md ")
    }

    private static let tree = [
        "README.md",
        "docs/adr/ADR-0024-session-drive-port.md",
    ]

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
