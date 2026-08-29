import ArgoEngine
@testable import ArgoUI
import Testing

/// Which menu a line opens, what Escape puts away, and what a Session change drops (#752).
///
/// WHEN each menu's data is read is `ComposerMenuReadsTests`; the keyboard over it is
/// `ComposerMenuKeyboardTests`.
@Suite("Composer menus")
struct ComposerMenusTests {
    /// One line, and which menu it opens once the reads it asked for have answered.
    struct Opening {
        let line: ComposerMenuLine
        /// Whether the reads have come back. Both arrive after the keystroke that asked for
        /// them, so "still being read" is a state of its own — not an empty tree, not an empty
        /// catalog.
        var answered = false
        let sigil: ComposerMenu.Sigil?
    }

    private static let openings = [
        Opening(line: line("/imp"), answered: true, sigil: .command),
        // The walk has not answered yet. The menu is still THERE and says so — see
        // `the menu stands over a line whose skills are still being read`.
        Opening(line: line("/imp"), sigil: .command),
        // A `codex` Session declares no command surface, so `/` is a word it is being told rather
        // than a menu (design decision 14).
        Opening(line: line("/imp", canRunCommands: false), answered: true, sigil: nil),
        Opening(line: line("Have a look at @READ"), answered: true, sigil: .file),
        // "No file matches" is a statement about a tree, and there is none here to have looked in.
        Opening(line: line("Have a look at @READ"), sigil: nil),
        Opening(line: line("@READ", workspaceRoot: nil), answered: true, sigil: nil),
        Opening(line: line("just some prose"), answered: true, sigil: nil),
    ]

    @Test(arguments: openings)
    func `a line opens the menu its sigil names, and no other`(_ opening: Opening) {
        var menus = ComposerMenus()
        let asks = menus.lineChanged(from: "", to: opening.line)
        if opening.answered {
            menus.workspaceAnswered(Self.tree)
            menus.commandsAnswered(Self.catalog, to: asks.generation)
        }

        #expect(menus.listing(on: opening.line)?.sigil == opening.sigil)
    }

    /// A menu that vanished until the walk answered would read as the composer refusing the line.
    /// So the surface stands from the first keystroke, saying the list is coming — and it does not
    /// say nothing matched, because that is a statement about a catalog and there is none yet.
    @Test
    func `the menu stands over a line whose skills are still being read`() throws {
        var menus = ComposerMenus()
        let line = Self.line("/imp")

        menus.lineChanged(from: "", to: line)

        let listing = try #require(menus.listing(on: line))
        #expect(listing.isReading)
        #expect(listing.status?.mark == .waiting)
        #expect(listing.sections.isEmpty)
    }

    // MARK: - Escape

    @Test
    func `an Escape puts the open menu away`() {
        var menus = ComposerMenus()
        let line = Self.line("/imp")
        menus.lineChanged(from: "", to: line)

        let swallowed = menus.dismissed(on: line)

        #expect(swallowed)
        #expect(menus.listing(on: line) == nil)
    }

    /// Not a mode: typing on is the reader still looking for a command.
    @Test
    func `the next keystroke asks the dismissed menu back`() {
        var menus = ComposerMenus()
        menus.lineChanged(from: "", to: Self.line("/imp"))
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

    /// The catalog belongs to the Project the last Session was in, so a stale one would offer
    /// somebody else's skills.
    @Test
    func `a Session change drops the skills`() throws {
        var menus = ComposerMenus()
        let line = Self.line("/imp")
        let asks = menus.lineChanged(from: "", to: line)
        menus.commandsAnswered(Self.catalog, to: asks.generation)

        menus.sessionChanged(to: line)

        #expect(try #require(menus.listing(on: line)).isReading)
    }

    @Test
    func `a Session change over an open mention asks for the new Workspace`() {
        var menus = ComposerMenus()

        let asks = menus.sessionChanged(to: Self.line("@READ"))

        #expect(asks.files)
    }

    private static let tree = [
        "README.md",
        "docs/adr/ADR-0024-session-drive-port.md",
    ]

    private static let catalog = CommandCatalog(
        commands: [Command(name: "implement", description: nil, origin: .project)],
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
