import ArgoEngine
@testable import ArgoUI
import Testing

/// The composition the two menus share: which one a line opens, where Escape leaves it, what a
/// Session change drops, and what ⏎ picks (#752).
@Suite("Composer menus")
struct ComposerMenusTests {
    /// One line, and which menu it opens once the tree it needs has answered.
    struct Opening {
        let line: ComposerMenuLine
        /// Whether the reads the line asked for have come back. Both arrive after the keystroke
        /// that asked for them, so "still being read" is a state of its own — not an empty tree and
        /// not an empty catalog.
        var answered = false
        let sigil: ComposerMenu.Sigil?
    }

    private static let openings = [
        Opening(line: line("/imp"), answered: true, sigil: .command),
        // "No skill matches" is a statement about a catalog, and the walk that reads one has not
        // answered yet (#961).
        Opening(line: line("/imp"), sigil: nil),
        // A `codex` Session declares no command surface, so `/` is a word it is being told rather
        // than a menu (design decision 14).
        Opening(line: line("/imp", canRunCommands: false), answered: true, sigil: nil),
        Opening(line: line("Have a look at @READ"), answered: true, sigil: .file),
        // "No file matches" is a statement about a tree, and there is none here to have looked in.
        Opening(line: line("Have a look at @READ"), sigil: nil),
        Opening(line: line("@READ", workspaceRoot: nil), answered: true, sigil: nil),
        Opening(line: line("just some prose"), answered: true, sigil: nil),
        Opening(line: line("/imp", workspaceRoot: nil), answered: true, sigil: .command),
    ]

    @Test(arguments: openings)
    func `a line opens the menu its sigil names, and no other`(_ opening: Opening) {
        var menus = ComposerMenus()
        menus.lineChanged(from: "", to: opening.line)
        if opening.answered {
            menus.workspaceAnswered(Self.tree)
            menus.commandsAnswered(Self.catalog)
        }

        #expect(menus.listing(on: opening.line)?.sigil == opening.sigil)
    }

    // MARK: - Escape

    @Test
    func `an Escape puts the open menu away`() {
        var menus = ComposerMenus()
        let line = Self.line("/imp")
        menus.lineChanged(from: "", to: line)
        menus.commandsAnswered(Self.catalog)

        let swallowed = menus.dismissed(on: line)

        #expect(swallowed)
        #expect(menus.listing(on: line) == nil)
    }

    /// Not a mode: typing on is the reader still looking for a command.
    @Test
    func `the next keystroke asks the dismissed menu back`() {
        var menus = ComposerMenus()
        menus.lineChanged(from: "", to: Self.line("/imp"))
        menus.commandsAnswered(Self.catalog)
        menus.dismissed(on: Self.line("/imp"))

        menus.lineChanged(from: "/imp", to: Self.line("/impl"))

        #expect(menus.listing(on: Self.line("/impl")) != nil)
    }

    /// It answers whether it DID anything, because the field holds the keyboard: an Escape
    /// swallowed with no menu open is an Escape the permission footer's `esc denies` never sees.
    @Test
    func `an Escape over a line with no menu is left to the responder chain`() {
        var menus = ComposerMenus()

        let swallowed = menus.dismissed(on: Self.line("just some prose"))

        #expect(swallowed == false)
    }

    // MARK: - A different Session

    /// The tree belongs to the Session that was read, so it goes when the composer is pointed at
    /// another one — a stale list would offer files from somebody else's Workspace.
    @Test
    func `a Session change drops the file list`() {
        var menus = ComposerMenus()
        let line = Self.line("Have a look at @READ")
        menus.lineChanged(from: "", to: line)
        menus.workspaceAnswered(Self.tree)

        menus.sessionChanged(to: line)

        #expect(menus.listing(on: line) == nil)
    }

    /// The catalog belongs to the Project the last Session was in, and the composer may have been
    /// pointed at a Session in another one.
    @Test
    func `a Session change drops the skills`() {
        var menus = ComposerMenus()
        let line = Self.line("/imp")
        menus.lineChanged(from: "", to: line)
        menus.commandsAnswered(Self.catalog)

        let reads = menus.sessionChanged(to: line)

        #expect(menus.listing(on: line) == nil)
        #expect(reads.commands)
    }

    @Test
    func `a Session change over an open mention asks for the new Workspace`() {
        var menus = ComposerMenus()

        let reads = menus.sessionChanged(to: Self.line("@READ"))

        #expect(reads.files)
    }

    // MARK: - The cursor and what ⏎ picks

    @Test
    func `the cursor starts on the top row of the drawn listing`() throws {
        var menus = ComposerMenus()
        let line = Self.line("/")
        menus.lineChanged(from: "", to: line)
        menus.commandsAnswered(Self.catalog)
        menus.settle(on: line)

        let rows = try #require(menus.listing(on: line)?.rows)
        #expect(menus.current == rows.first?.id)
    }

    /// The rows the cursor walks are the rows on screen, so what ⏎ takes cannot fall out of step
    /// with the list the reader is looking at.
    @Test
    func `an arrow moves the cursor to the next row of the drawn listing`() throws {
        var menus = ComposerMenus()
        let line = Self.line("/")
        menus.lineChanged(from: "", to: line)
        menus.commandsAnswered(Self.catalog)
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

    @Test
    func `the Return key takes the row under the cursor`() throws {
        var menus = ComposerMenus()
        let line = Self.line("/imp")
        menus.lineChanged(from: "", to: line)
        menus.commandsAnswered(Self.catalog)
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

        menus.workspaceAnswered(Self.tree)
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

    private static func line(
        _ text: String,
        canRunCommands: Bool = true,
        workspaceRoot: String? = "/tmp/argo",
    )
        -> ComposerMenuLine {
        ComposerMenuLine(
            text: text,
            canRunCommands: canRunCommands,
            workspaceRoot: workspaceRoot,
        )
    }
}
