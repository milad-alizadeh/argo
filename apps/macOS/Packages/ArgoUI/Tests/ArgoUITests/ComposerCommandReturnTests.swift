import ArgoEngine
@testable import ArgoUI
import Testing

/// Which key the `/` menu spends on the row under the cursor, and which one it leaves to the Turn
/// (#1208). ⏎ completes only where the pick would put something in the line; ⇥ completes always
/// (#1181), so the completion key never changes its meaning.
///
/// `ComposerMenuKeyboardTests` asserts WHICH row the cursor is on; this asserts what each key does
/// with it.
@Suite("Composer command Return")
struct ComposerCommandReturnTests {
    /// The bug that shipped: `/ship` takes no arguments, so the pick added nothing but a trailing
    /// space and ⏎ was spent on it. The Turn was never sent and the composer looked inert.
    @Test
    func `a command already typed in full is sent by Return`() {
        let line = Self.line("/ship")
        var menus = Self.opened(on: line)
        menus.settle(on: line)

        #expect(menus.completes(on: line) == false)
    }

    /// Design decision 1 intact: the fragment is not the command, so ⏎ finishes it and the argument
    /// is typed after the space rather than being made impossible to type.
    @Test
    func `a command name still half typed is completed by Return`() throws {
        let line = Self.line("/shi")
        var menus = Self.opened(on: line)
        menus.settle(on: line)

        #expect(menus.completes(on: line))
        #expect(try #require(menus.picked(on: line)).text == "/ship ")
    }

    /// The typed name is a command AND the head of a longer one. What decides is the row under the
    /// cursor, not the line: walking onto `/ship-it` gives ⏎ something to insert again.
    @Test
    func `a longer command walked onto is completed by Return`() throws {
        let line = Self.line("/ship")
        var menus = Self.opened(on: line)
        menus.settle(on: line)

        let walked = menus.walk(.walkDown, on: line)
        #expect(walked)

        #expect(menus.completes(on: line))
        #expect(try #require(menus.picked(on: line)).text == "/ship-it ")
    }

    /// `AddMenu`'s own row asked for the listing, so the sigil was never typed and a pick drops
    /// nothing before inserting (design decision 11) — every row of it extends the line.
    @Test
    func `a listing AddMenu asked for is completed by Return`() throws {
        let line = Self.line("")
        var menus = Self.opened(on: line)
        menus.addOpened()
        let row = try #require(ComposerMenu.addRows(on: line).first { $0.sigil == .command })
        menus.addMenuPicked(row)
        menus.settle(on: line)

        #expect(menus.completes(on: line))
    }

    /// Tab is the completion key and answers the same over both lines (#1181): it takes the row,
    /// and over a name typed in full that is the trailing space and nothing else.
    @Test(arguments: [("/shi", "/ship "), ("/ship", "/ship ")])
    func `the Tab key takes the row under the cursor either way`(
        typed: String,
        taken: String,
    ) throws {
        let line = Self.line(typed)
        var menus = Self.opened(on: line)
        menus.settle(on: line)

        var draft = ComposerDraft(text: typed)
        try draft.take(#require(menus.picked(on: line)))

        #expect(draft.text == taken)
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
            Command(name: "ship", description: nil, origin: .project),
            Command(name: "ship-it", description: nil, origin: .project),
        ],
        builtins: .read,
    )

    private static func line(_ text: String) -> ComposerMenuLine {
        ComposerMenuLine(text: text, canRunCommands: true, workspaceRoot: "/tmp/argo")
    }
}
