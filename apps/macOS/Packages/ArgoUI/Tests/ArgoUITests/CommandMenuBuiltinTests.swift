import ArgoEngine
@testable import ArgoUI
import Testing

/// The CLI's own commands in the `/` menu, and what the menu says while it has none (#686).
@Suite("Command menu built-ins")
struct CommandMenuBuiltinTests {
    /// The design's order, with the CLI's own last because it is the origin furthest from this
    /// Project — `cockpit-composer-picker.md`, section headers.
    @Test
    func `the CLI's own commands come after every skill origin`() throws {
        let menu = try #require(CommandMenuProjection.menu(for: "/", in: catalog))

        #expect(menu.sections.map(\.label) == ["Project", "Global", "Plugin", "Claude Code"])
    }

    /// A built-in's row is a bare `/name`, exactly as a Project or global skill's is: the CLI
    /// addresses all three identically, which is why they share one menu at all.
    @Test
    func `a built-in is invoked by its bare name`() throws {
        let menu = try #require(CommandMenuProjection.menu(for: "/compact", in: catalog))

        #expect(menu.rows.map(\.command) == ["/compact"])
    }

    /// The header names the panel the words were read from rather than a path, because there is no
    /// file behind a built-in for anyone to open.
    @Test
    func `the CLI's section says where its rows were read from`() throws {
        let menu = try #require(CommandMenuProjection.menu(for: "/", in: catalog))

        #expect(menu.sections.last?.detail == "/help · 1")
    }

    /// Decision 9. The strip is pinned above the list and is NOT content: a menu whose skills all
    /// filtered out is still the zero state, with the strip standing over it.
    @Test(arguments: [BuiltinStatus.reading, .unavailable, .read])
    func `the state of the CLI's half rides on the menu whatever is in it`(
        state: BuiltinStatus,
    ) throws {
        let empty = CommandCatalog(commands: [], builtins: state)
        let menu = try #require(CommandMenuProjection.menu(for: "/nothing", in: empty))

        #expect(menu.builtins == state)
        #expect(menu.isEmpty)
    }

    private let catalog = CommandCatalog(
        commands: [
            Command(name: "implement", description: "Build it.", origin: .project),
            Command(name: "ux-writing", description: "Write copy.", origin: .user),
            Command(name: "simplify", description: "Tidy it.", origin: .plugin("figma")),
            Command(name: "compact", description: "Free up context.", origin: .claudeCode),
        ],
        builtins: .read,
    )
}
