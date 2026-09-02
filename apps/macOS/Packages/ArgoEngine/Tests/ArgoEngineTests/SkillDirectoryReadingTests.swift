@testable import ArgoEngine
import Testing

/// What ONE directory under a skills root reads as: the name and description its row falls back to,
/// the directories that turn out to hold no skill at all, and the symlink this repo's own install
/// leaves behind.
///
/// Which roots are walked and which copy wins is `SkillCatalogTests`; parsing frontmatter off a
/// string with no directory around it is `SkillFrontmatterTests`.
@Suite("Skill directory reading")
struct SkillDirectoryReadingTests {
    let machine: SkillCatalogFixture

    init() throws {
        self.machine = try SkillCatalogFixture()
    }

    @Test
    func `lists a skill that states no description by its name alone`() throws {
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
        try machine.write(
            FixtureSkill(directory: "nameless", description: "Words but no name."),
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
        try machine.write(broken, into: machine.projectSkills)
        try machine.write(
            FixtureSkill(directory: "real", name: "real"),
            into: machine.projectSkills,
        )
        #expect(machine.catalog.skills().map(\.name) == ["real"])
    }

    @Test
    func `reads no skill from a directory holding no SKILL_md`() throws {
        try machine.writeEmptyDirectory(named: "hollow", into: machine.projectSkills)
        #expect(machine.catalog.skills().isEmpty)
    }

    /// This repo installs its own skills as symlinks into `.agents/skills`, so a reader stopping at
    /// the link would find nothing in the one Project that most needs the picker.
    @Test
    func `follows a skill directory that is a symlink`() throws {
        try machine.link(
            FixtureSkill(directory: "linked", name: "linked", description: "Elsewhere on disk."),
            into: machine.projectSkills,
        )
        #expect(machine.catalog.skills().map(\.description) == ["Elsewhere on disk."])
    }
}
