import ArgoEngine
@testable import ArgoUI
import Testing

/// WHEN each menu's data is read, which is the whole of what stops a keystroke reaching the file
/// system (#961), and which answers are allowed to land. What a line OPENS is `ComposerMenusTests`.
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

        let asks = menus.lineChanged(from: "@REA", to: Self.line("@READ"))

        #expect(asks.files == false)
    }

    /// The bug this replaced: every character inside a `/` line walked the skills directories and
    /// decoded two JSON files, on the thread that draws the caret (#961). The skills on disk do not
    /// change while a command name is being typed, so the walk belongs to the OPENING alone.
    @Test
    func `typing on inside a command does not read the skills again`() {
        var menus = ComposerMenus()

        let asks = menus.lineChanged(from: "/imp", to: Self.line("/impl"))

        #expect(asks.commands == false)
    }

    /// A space closes the menu without the reader having left the command they are typing, so a
    /// space held down and rubbed out was a walk of the skills directories every second keystroke —
    /// on the caret's thread. The same for a second slash: `/usr/` then a backspace.
    @Test(arguments: [("/review ", "/review"), ("/usr/", "/usr")])
    func `editing on inside a command line reads nothing`(was: String, now: String) {
        var menus = ComposerMenus()

        let asks = menus.lineChanged(from: was, to: Self.line(now))

        #expect(asks.commands == false)
    }

    @Test
    func `the slash that opens the menu asks for the skills`() {
        var menus = ComposerMenus()

        let asks = menus.lineChanged(from: "", to: Self.line("/"))

        #expect(asks.commands)
    }

    /// #1256: a `/` two lines down is its OWN opening, not a keystroke inside the one at the
    /// head — a command abandoned near the head must not keep a later `/` from reading its own
    /// skills.
    @Test
    func `a slash after a later line reads the skills too`() {
        var menus = ComposerMenus()

        let asks = menus.lineChanged(
            from: "go with these\n\n",
            to: Self.line("go with these\n\n/"),
        )

        #expect(asks.commands)
    }

    /// The composer arriving is itself an opening, whatever the line says: read now and the menu
    /// has its rows before the reader has typed the `/`, rather than waiting when it opens.
    @Test
    func `arriving at a Session reads the skills without waiting for a slash`() {
        var menus = ComposerMenus()

        let asks = menus.sessionChanged(to: Self.line(""))

        #expect(asks.commands)
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

    /// Escape then typing on is the reader's natural way of asking for the menu back, and it is a
    /// re-open: the catalog behind it is as old as the last one, so it is read again. Without this
    /// the only bound on staleness is the reader leaving command mode entirely, which is the half
    /// of #961's bargain that keeps a skill installed mid-Session reachable.
    @Test
    func `an Escape and a retype read the skills again`() {
        var menus = ComposerMenus()
        menus.lineChanged(from: "", to: Self.line("/imp"))
        menus.dismissed(on: Self.line("/imp"))

        let asks = menus.lineChanged(from: "/imp", to: Self.line("/impl"))

        #expect(asks.commands)
    }

    // MARK: - Which answers land

    /// The menu draws what the LAST read answered, which is what puts a skill installed while the
    /// app was running into it.
    @Test
    func `the latest answer replaces the one before it`() throws {
        var menus = ComposerMenus()
        let first = menus.lineChanged(from: "", to: Self.line("/"))
        menus.commandsAnswered(Self.catalog, to: first.generation)

        let again = menus.lineChanged(from: "prose", to: Self.line("/"))
        menus.commandsAnswered(Self.catalogWithShip, to: again.generation)

        let rows = try #require(menus.listing(on: Self.line("/"))?.rows)
        #expect(rows.map(\.id).contains("/ship"))
    }

    /// Two opens in flight at once, and the slower one answering second. Without the token the
    /// older walk would overwrite the newer, and a read still running across a Session change would
    /// land the last Project's skills on this one.
    @Test
    func `an answer to an overtaken read lands nowhere`() throws {
        var menus = ComposerMenus()
        let overtaken = menus.lineChanged(from: "", to: Self.line("/"))
        menus.sessionChanged(to: Self.line("/"))

        menus.commandsAnswered(Self.catalog, to: overtaken.generation)

        #expect(try #require(menus.listing(on: Self.line("/"))).isReading)
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
