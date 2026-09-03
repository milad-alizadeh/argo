import ArgoEngine
@testable import ArgoUI
import Testing

/// The two-row drawer `AddButton` opens — which rows it carries, and how it puts itself away
/// against either sigil's listing (design decision 11, `cockpit-composer-picker.md`, #689).
///
/// What picking a row OPENS is `AddMenuRequestedTests`.
@Suite("Add menu")
struct AddMenuTests {
    // MARK: - Which rows

    @Test
    func `both rows show where the Session offers both`() {
        let rows = ComposerMenu.addRows(on: Self.line())

        #expect(rows.map(\.id) == ["files", "commands"])
    }

    /// Files first, then commands — the design's own order, and the one `plus.png` draws.
    @Test
    func `files leads commands`() {
        let rows = ComposerMenu.addRows(on: Self.line())

        #expect(rows.first?.id == "files")
    }

    @Test
    func `no Workspace drops the files row`() {
        let rows = ComposerMenu.addRows(on: Self.line(workspaceRoot: nil))

        #expect(rows.map(\.id) == ["commands"])
    }

    @Test
    func `no command surface drops the commands row`() {
        let rows = ComposerMenu.addRows(on: Self.line(canRunCommands: false))

        #expect(rows.map(\.id) == ["files"])
    }

    /// A `codex` Session offering neither — the case `AddButton`'s absence rule reads.
    @Test
    func `neither capability leaves no rows at all`() {
        let rows = ComposerMenu.addRows(on: Self.line(canRunCommands: false, workspaceRoot: nil))

        #expect(rows.isEmpty)
    }

    // MARK: - Opening and closing AddMenu itself

    @Test
    func `clicking AddButton opens AddMenu`() {
        var menus = ComposerMenus()

        menus.addOpened()

        #expect(menus.isAddMenuOpen)
    }

    /// `AddMenu` draws in the SAME slot a sigil's listing does — never both.
    @Test
    func `an open AddMenu means no sigil listing is`() {
        var menus = ComposerMenus()
        menus.lineChanged(from: "", to: Self.line(text: "/imp"))

        menus.addOpened()

        #expect(menus.listing(on: Self.line(text: "/imp")) == nil)
    }

    @Test
    func `opening AddMenu puts an open sigil listing away`() {
        var menus = ComposerMenus()
        menus.lineChanged(from: "", to: Self.line(text: "/imp"))
        #expect(menus.listing(on: Self.line(text: "/imp")) != nil)

        menus.addOpened()

        #expect(menus.isAddMenuOpen)
        #expect(menus.listing(on: Self.line(text: "/imp")) == nil)
    }

    @Test
    func `closing AddMenu leaves nothing open`() {
        var menus = ComposerMenus()
        menus.addOpened()

        menus.addClosed()

        #expect(menus.isAddMenuOpen == false)
        #expect(menus.listing(on: Self.line()) == nil)
    }

    @Test
    func `an Escape over AddMenu itself puts it away`() {
        var menus = ComposerMenus()
        menus.addOpened()

        let swallowed = menus.dismissed(on: Self.line())

        #expect(swallowed)
        #expect(menus.isAddMenuOpen == false)
    }

    private static func line(
        text: String = "",
        canRunCommands: Bool = true,
        workspaceRoot: String? = "/tmp/argo",
    )
        -> ComposerMenuLine {
        ComposerMenuLine(text: text, canRunCommands: canRunCommands, workspaceRoot: workspaceRoot)
    }
}
