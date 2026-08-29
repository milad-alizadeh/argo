import ArgoEngine
@testable import ArgoUI
import Testing

/// WHEN each menu's data is read, which is the whole of what stops a keystroke reaching the file
/// system (#961). The listing itself is `ComposerMenusTests`.
///
/// Both halves follow one rule — read on the OPENING of the menu, never on the keystrokes after it
/// — so both are asserted here, against the same counted line.
@Suite("Composer menu reads")
struct ComposerMenuReadsTests {
    /// The tree is read on the token OPENING and not on every keystroke, because the Workspace does
    /// not change while a word is being typed into it.
    @Test
    func `typing on inside a mention does not read the Workspace again`() {
        var menus = ComposerMenus()

        let reads = menus.lineChanged(from: "@REA", to: Self.line("@READ"))

        #expect(reads.files == false)
    }

    /// The bug this replaced: every character inside a `/` line walked the skills directories and
    /// decoded two JSON files, on the thread that draws the caret (#961). The skills on disk do not
    /// change while a command name is being typed, so the walk belongs to the OPENING alone.
    @Test
    func `typing on inside a command does not read the skills again`() {
        var menus = ComposerMenus()

        let reads = menus.lineChanged(from: "/imp", to: Self.line("/impl"))

        #expect(reads.commands == false)
    }

    @Test
    func `the slash that opens the menu asks for the skills`() {
        var menus = ComposerMenus()

        let reads = menus.lineChanged(from: "", to: Self.line("/"))

        #expect(reads.commands)
    }

    /// Counted over a whole command typed one character at a time, because the defect was per
    /// CHARACTER: seven keystrokes used to mean seven walks of the skills directories.
    @Test
    func `typing a whole command reads the skills once`() {
        var menus = ComposerMenus()
        var reads = 0
        var was = ""

        for text in ["/", "/i", "/im", "/imp", "/impl", "/imple", "/implem"] {
            if menus.lineChanged(from: was, to: Self.line(text)).commands {
                reads += 1
            }
            was = text
        }

        #expect(reads == 1)
    }

    /// The half of the bargain the cache owes: a skill installed while the app is running is in the
    /// menu the reader opens next, because opening is what re-reads.
    @Test
    func `a skill installed while the app is running is in the next menu`() throws {
        var menus = ComposerMenus()
        menus.lineChanged(from: "", to: Self.line("/"))
        menus.commandsAnswered(Self.catalog)

        // Away from the menu and back to it — one `/` typed on a line that had none.
        let reopened = menus.lineChanged(from: "just some prose", to: Self.line("/"))
        menus.commandsAnswered(Self.catalogWithShip)

        #expect(reopened.commands)
        let rows = try #require(menus.listing(on: Self.line("/"))?.rows)
        #expect(rows.map(\.id).contains("/ship"))
    }

    private static let catalog = CommandCatalog(
        commands: [
            Command(name: "implement", description: nil, origin: .project),
            Command(name: "code-review", description: nil, origin: .project),
        ],
        builtins: .read,
    )

    /// The same catalog with one more skill in it — the one installed while the app was running.
    private static let catalogWithShip = CommandCatalog(
        commands: Self.catalog.commands + [
            Command(name: "ship", description: nil, origin: .project),
        ],
        builtins: .read,
    )

    private static func line(_ text: String) -> ComposerMenuLine {
        ComposerMenuLine(text: text, canRunCommands: true, workspaceRoot: "/tmp/argo")
    }
}
