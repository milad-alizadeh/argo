import ArgoEngine
@testable import ArgoUI
import Testing

/// Where the `/` menu opens, what it lists, and in what order (#685).
@Suite("Command menu projection")
struct CommandMenuProjectionTests {
    /// Decision 2. A slash inside a path is a path, and the space that starts the arguments is what
    /// puts the menu away — `slash-args.png` is a sendable line with no menu over it.
    @Test(arguments: [
        ("/", ""),
        ("/impl", "impl"),
        ("/code-review", "code-review"),
    ])
    func `a slash at the head of the line opens the menu`(text: String, query: String) {
        #expect(CommandMenuProjection.query(in: text) == query)
    }

    /// A second slash means a path, which is decision 2's own example: `/usr/local` opens nothing.
    /// No command carries a slash in its name, so nothing real is lost by the rule.
    @Test(arguments: [
        "", "look in src/foo", "hello", "/code-review since main", " /impl",
        "/usr/local", "/usr/local/bin",
    ])
    func `nothing else opens it`(text: String) {
        #expect(CommandMenuProjection.query(in: text) == nil)
    }

    /// The bare `/`: one section per origin, nearest first, each saying where it read from and how
    /// many it found — the design's Project · You · Plugin order.
    @Test
    func `an unfiltered menu groups by origin, nearest first`() throws {
        let menu = try #require(CommandMenuProjection.menu(for: "/", in: catalog))

        #expect(menu.sections.map(\.label) == ["Project", "Global", "Plugin"])
        #expect(menu.sections.map(\.detail) == [
            ".claude/skills · 2", "~/.claude/skills · 1", "figma · 1",
        ])
    }

    /// Decision 3: prefix matches first, in origin order, then the ones that merely contain the
    /// characters under their own header, so a good match never slides down as the reader types.
    @Test
    func `filtering puts prefix matches above the ones that merely contain`() throws {
        let menu = try #require(CommandMenuProjection.menu(for: "/impl", in: catalog))

        #expect(menu.sections.map(\.label) == [nil, CommandMenuProjection.alsoContains])
        #expect(menu.sections.map { $0.rows.map(\.command) } == [
            ["/implement"], ["/figma:simplify"],
        ])
        #expect(menu.sections.last?.detail == "\"impl\" · 1")
    }

    /// The characters the reader typed, located in the whole command so a plugin's namespace is
    /// reachable by typing too: `/implement` inks 1..<5, `/figma:simplify` inks 8..<12.
    @Test
    func `the matched characters are located in the command`() throws {
        let menu = try #require(CommandMenuProjection.menu(for: "/impl", in: catalog))

        #expect(menu.rows.map(\.matched) == [1 ..< 5, 8 ..< 12])
    }

    /// Origin is a section header while the sections group by origin, and a badge on the row only
    /// once they group by match instead — never both, or the row says it twice.
    @Test
    func `origin rides on the row only while filtering`() throws {
        let unfiltered = try #require(CommandMenuProjection.menu(for: "/", in: catalog))
        let filtered = try #require(CommandMenuProjection.menu(for: "/impl", in: catalog))

        #expect(unfiltered.rows.allSatisfy { $0.origin == nil })
        #expect(filtered.rows.map(\.origin) == ["Project", "Plugin"])
    }

    /// A plugin's command is `/plugin:name`, so a match on the NAME starts well past the command's
    /// own head. Ranked off the command alone, no plugin skill could ever be a prefix match, and
    /// typing a skill's exact name would file it under "Also contains".
    @Test
    func `naming a plugin's skill exactly is a prefix match`() throws {
        let menu = try #require(CommandMenuProjection.menu(for: "/simplify", in: catalog))

        #expect(menu.sections.map(\.label) == [nil])
        #expect(menu.sections.first?.rows.map(\.command) == ["/figma:simplify"])
    }

    /// Every plugin's section is labelled `Plugin`, so a section identified BY its label collides
    /// the moment two plugins carry skills and `ForEach` draws one of them.
    @Test
    func `two plugins get two sections with two ids`() throws {
        let menu = try #require(CommandMenuProjection.menu(for: "/", in: [
            Skill(name: "sync", description: nil, origin: .plugin("figma")),
            Skill(name: "trends", description: nil, origin: .plugin("posthog")),
        ]))

        #expect(menu.sections.map(\.label) == ["Plugin", "Plugin"])
        #expect(Set(menu.sections.map(\.id)).count == 2)
    }

    /// Decision 4. The field is trigger prose for a model and real ones run three sentences, so the
    /// row takes the head of it verbatim.
    @Test
    func `a description is clamped to its first sentence, verbatim`() throws {
        let long = Skill(
            name: "review",
            description: "Review the diff. Then open the PR. Use after a build.",
            origin: .project,
        )
        let menu = try #require(CommandMenuProjection.menu(for: "/", in: [long]))

        #expect(menu.rows.first?.description == "Review the diff.")
    }

    /// A full stop inside a sentence does not end it, which is what keeps `e.g.` and a version
    /// number where they belong.
    @Test
    func `a full stop with no space after it does not end the sentence`() throws {
        let versioned = Skill(
            name: "pin",
            description: "Pin claude 2.1.228 for this Project. Nothing else changes.",
            origin: .project,
        )
        let menu = try #require(CommandMenuProjection.menu(for: "/", in: [versioned]))

        #expect(menu.rows.first?.description == "Pin claude 2.1.228 for this Project.")
    }

    /// Decision 5: a skill that states no description carries none, and the row invents nothing.
    @Test
    func `a skill with no description carries none`() throws {
        let terse = Skill(name: "terse", description: nil, origin: .project)
        let menu = try #require(CommandMenuProjection.menu(for: "/", in: [terse]))

        #expect(menu.rows.first?.description == nil)
    }

    /// Decision 8: nothing matched keeps the surface and names what did not match, and the row
    /// list is empty rather than absent.
    @Test
    func `a query nothing matches leaves an empty menu naming the query`() throws {
        let menu = try #require(CommandMenuProjection.menu(for: "/graphify", in: catalog))

        #expect(menu.isEmpty)
        #expect(menu.query == "graphify")
    }

    /// Decision 7 reaches the row from the catalog rather than being decided again here.
    @Test
    func `a row carries the shadow mark the catalog gave it`() throws {
        let shadowing = Skill(
            name: "find-skills",
            description: nil,
            origin: .project,
            shadowsUser: true,
        )
        let menu = try #require(CommandMenuProjection.menu(for: "/", in: [shadowing]))

        #expect(menu.rows.first?.shadowsUser == true)
    }

    /// Two of the Project's, one of the user's, one a plugin carries — in the order the catalog
    /// answers in, which is the order the sections are drawn in.
    private let catalog = [
        Skill(name: "implement", description: "Implement a piece of work.", origin: .project),
        Skill(name: "ask-argo", description: "Router for Argo's own skills.", origin: .project),
        Skill(name: "ux-writing", description: "Write interface copy.", origin: .user),
        Skill(name: "simplify", description: "Review the changed code.", origin: .plugin("figma")),
    ]
}
