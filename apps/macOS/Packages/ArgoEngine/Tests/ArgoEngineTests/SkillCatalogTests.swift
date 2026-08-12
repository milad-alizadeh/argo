@testable import ArgoEngine
import Foundation
import Testing

/// What a Project's installed skills are, read the way the CLI reads them (#685).
@Suite("Skill catalog")
struct SkillCatalogTests {
    @Test
    func `lists a Project's own skill by the name and description it states`() throws {
        let machine = try SkillCatalogFixture()
        defer { machine.remove() }
        try machine.write(
            FixtureSkill(
                directory: "code-review",
                name: "code-review",
                description: "Review a diff.",
            ),
            into: machine.projectSkills,
        )
        let skill = try #require(machine.catalog.skills().first)
        #expect(skill.name == "code-review")
        #expect(skill.description == "Review a diff.")
        #expect(skill.origin == .project)
        #expect(skill.command == "/code-review")
    }

    @Test
    func `lists the user's global skills alongside the Project's own`() throws {
        let machine = try SkillCatalogFixture()
        defer { machine.remove() }
        try machine.write(
            FixtureSkill(directory: "mine", name: "mine"),
            into: machine.projectSkills,
        )
        try machine.write(FixtureSkill(directory: "ours", name: "ours"), into: machine.userSkills)
        try machine.install([FixturePlugin(
            name: "figma",
            skills: [FixtureSkill(directory: "figma-sync", name: "figma-sync")],
        )])
        #expect(machine.catalog.skills().map(\.origin) == [.project, .user, .plugin("figma")])
    }

    /// A plugin skill is reached through its plugin, which is why the origin carries the plugin's
    /// name rather than only saying "a plugin".
    @Test
    func `names a plugin-carried skill by its plugin`() throws {
        let machine = try SkillCatalogFixture()
        defer { machine.remove() }
        try machine.install([FixturePlugin(
            name: "figma",
            skills: [FixtureSkill(
                directory: "figma-sync",
                name: "figma-sync",
                description: "Sync.",
            )],
        )])
        let skill = try #require(machine.catalog.skills().first)
        #expect(skill.command == "/figma:figma-sync")
        #expect(skill.description == "Sync.")
    }

    /// The record names an install path per Project as well as per user, and a plugin somebody
    /// installed for a different Project is not installed for this one.
    @Test
    func `leaves out a plugin installed for another Project`() throws {
        let machine = try SkillCatalogFixture()
        defer { machine.remove() }
        try machine.install([FixturePlugin(
            name: "elsewhere",
            forProject: URL(filePath: "/somewhere/else"),
            skills: [FixtureSkill(directory: "not-mine", name: "not-mine")],
        )])
        #expect(machine.catalog.skills().isEmpty)
    }

    @Test
    func `lists a plugin installed for this Project`() throws {
        let machine = try SkillCatalogFixture()
        defer { machine.remove() }
        try machine.install([FixturePlugin(
            name: "ours",
            forProject: machine.projectURL,
            skills: [FixtureSkill(directory: "scoped", name: "scoped")],
        )])
        #expect(machine.catalog.skills().map(\.command) == ["/ours:scoped"])
    }

    @Test
    func `lists a skill that states no description by its name alone`() throws {
        let machine = try SkillCatalogFixture()
        defer { machine.remove() }
        try machine.write(
            FixtureSkill(directory: "terse", name: "terse"),
            into: machine.projectSkills,
        )
        let skill = try #require(machine.catalog.skills().first)
        #expect(skill.name == "terse")
        #expect(skill.description == nil)
    }

    /// A skill whose frontmatter states no name is still invocable, because the CLI knows it by the
    /// directory it sits in — so the directory is what the row reads rather than nothing at all.
    @Test
    func `falls back to the directory when the frontmatter states no name`() throws {
        let machine = try SkillCatalogFixture()
        defer { machine.remove() }
        try machine.write(
            FixtureSkill(directory: "nameless", description: "Has words but no name."),
            into: machine.projectSkills,
        )
        #expect(machine.catalog.skills().map(\.name) == ["nameless"])
    }

    /// Two things under the skills directory that are not skills. Neither is a row, and neither
    /// stops the skill beside it being read.
    @Test(arguments: [
        FixtureSkill(directory: "unfenced", markdown: "Just prose, no frontmatter.\n"),
        FixtureSkill(directory: "empty", markdown: ""),
    ])
    func `reads no skill from a directory that carries none`(broken: FixtureSkill) throws {
        let machine = try SkillCatalogFixture()
        defer { machine.remove() }
        try machine.write(broken, into: machine.projectSkills)
        try machine.write(
            FixtureSkill(directory: "real", name: "real"),
            into: machine.projectSkills,
        )
        #expect(machine.catalog.skills().map(\.name) == ["real"])
    }

    @Test
    func `reads no skill from a directory holding no SKILL.md`() throws {
        let machine = try SkillCatalogFixture()
        defer { machine.remove() }
        try machine.writeEmptyDirectory(named: "hollow", into: machine.projectSkills)
        #expect(machine.catalog.skills().isEmpty)
    }

    /// This repo installs its own skills as symlinks into `.agents/skills`, so a reader that
    /// stopped
    /// at the link would find nothing in the one Project that most needs the picker.
    @Test
    func `follows a skill directory that is a symlink`() throws {
        let machine = try SkillCatalogFixture()
        defer { machine.remove() }
        try machine.link(
            FixtureSkill(directory: "linked", name: "linked", description: "Elsewhere on disk."),
            into: machine.projectSkills,
        )
        #expect(machine.catalog.skills().map(\.description) == ["Elsewhere on disk."])
    }

    /// One `/name` exists, so one row does. The Project's own wins, because that is the narrower
    /// scope and the one the user is looking at.
    @Test
    func `shows one row when a Project skill and a global skill share a name`() throws {
        let machine = try SkillCatalogFixture()
        defer { machine.remove() }
        try machine.write(
            FixtureSkill(directory: "both", name: "both", description: "The Project's."),
            into: machine.projectSkills,
        )
        try machine.write(
            FixtureSkill(directory: "both", name: "both", description: "The user's."),
            into: machine.userSkills,
        )
        #expect(machine.catalog.skills().map(\.description) == ["The Project's."])
    }

    /// The read happens on every call and nothing is remembered between them, which is what makes a
    /// skill installed mid-Session appear next time the picker opens — no watcher, no restart.
    @Test
    func `sees a skill installed since the last read`() throws {
        let machine = try SkillCatalogFixture()
        defer { machine.remove() }
        let catalog = machine.catalog
        #expect(catalog.skills().isEmpty)
        try machine.write(FixtureSkill(directory: "new", name: "new"), into: machine.projectSkills)
        #expect(catalog.skills().map(\.name) == ["new"])
    }

    /// A machine that has never run the CLI. Empty is the answer, never a failure.
    @Test
    func `reads nothing on a machine with no skills directory at all`() throws {
        let machine = try SkillCatalogFixture()
        defer { machine.remove() }
        #expect(machine.catalog.skills().isEmpty)
    }
}
