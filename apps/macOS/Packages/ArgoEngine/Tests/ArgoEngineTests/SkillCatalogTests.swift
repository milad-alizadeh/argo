@testable import ArgoEngine
import Foundation
import Testing

/// Which skills a Project has, and where each row comes from (#685): the three origins, the
/// settings that decide whether a plugin's skills are reachable at all, and which copy wins when
/// two roots carry the same name.
///
/// What one directory on disk reads as, once the walk has found it, is
/// `SkillDirectoryReadingTests`.
@Suite("Skill catalog")
struct SkillCatalogTests {
    let machine: SkillCatalogFixture

    init() throws {
        self.machine = try SkillCatalogFixture()
    }

    @Test
    func `lists a Project's own skill by the name and description it states`() throws {
        try machine.write(
            FixtureSkill(directory: "code-review", name: "code-review", description: "A diff."),
            into: machine.projectSkills,
        )
        let skill = try #require(machine.catalog.skills().first)
        #expect(skill.name == "code-review")
        #expect(skill.description == "A diff.")
        #expect(skill.origin == .project)
        #expect(skill.command == "/code-review")
    }

    @Test
    func `lists the user's global skills and each plugin's beside the Project's own`() throws {
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
        try machine.install([FixturePlugin(
            name: "figma",
            skills: [FixtureSkill(directory: "sync", name: "sync", description: "Sync.")],
        )])
        let skill = try #require(machine.catalog.skills().first)
        #expect(skill.command == "/figma:sync")
        #expect(skill.description == "Sync.")
    }

    /// Installed is not reachable. The record carries no switch, so a plugin switched off in the
    /// settings keeps its skills unpacked and live in the cache, and no command finds them.
    @Test
    func `leaves out the skills of a plugin the settings switch off`() throws {
        try machine.install([FixturePlugin(
            name: "figma",
            isEnabled: false,
            skills: [FixtureSkill(directory: "sync", name: "sync")],
        )])
        #expect(machine.catalog.skills().isEmpty)
    }

    /// The commonest way a plugin is off: nobody ever named it. `posthog` is installed on this
    /// machine, absent from `enabledPlugins`, and its skills are absent from the CLI's own list.
    @Test
    func `leaves out the skills of a plugin no settings file names at all`() throws {
        let plugin = FixturePlugin(
            name: "posthog",
            skills: [FixtureSkill(directory: "trends", name: "trends")],
        )
        try machine.install([plugin])
        try machine.switchOn([])

        #expect(machine.catalog.skills().isEmpty)
    }

    /// The Project's settings are layered over the user's, so a plugin the user switched off can be
    /// switched back on for one Project.
    @Test
    func `lets the Project's settings switch a plugin back on`() throws {
        let plugin = FixturePlugin(
            name: "figma",
            isEnabled: false,
            skills: [FixtureSkill(directory: "sync", name: "sync")],
        )
        try machine.install([plugin])
        try machine.write(
            settings: ["enabledPlugins": [plugin.key: true]],
            to: machine.projectURL.appending(path: ".claude", directoryHint: .isDirectory),
        )

        #expect(machine.catalog.skills().map(\.command) == ["/figma:sync"])
    }

    /// The record names an install path per Project as well as per user, and a plugin somebody
    /// installed for a different Project is not installed for this one.
    @Test
    func `leaves out a plugin installed for another Project`() throws {
        try machine.install([FixturePlugin(
            name: "elsewhere",
            forProject: URL(filePath: "/somewhere/else"),
            skills: [FixtureSkill(directory: "not-mine", name: "not-mine")],
        )])
        #expect(machine.catalog.skills().isEmpty)
    }

    @Test
    func `lists a plugin installed for this Project`() throws {
        try machine.install([FixturePlugin(
            name: "ours",
            forProject: machine.projectURL,
            skills: [FixtureSkill(directory: "scoped", name: "scoped")],
        )])
        #expect(machine.catalog.skills().map(\.command) == ["/ours:scoped"])
    }

    /// The nearer origin wins and the shadowed copy is not listed at all — the CLI would never run
    /// it, and a row the CLI ignores is a lie (design decision 7). The winning row says so.
    @Test
    func `lists only the Project's copy when a global skill shares its name`() throws {
        try machine.write(
            FixtureSkill(directory: "both", name: "both", description: "The Project's."),
            into: machine.projectSkills,
        )
        try machine.write(
            FixtureSkill(directory: "both", name: "both", description: "The user's."),
            into: machine.userSkills,
        )
        let skill = try #require(machine.catalog.skills().first)
        #expect(machine.catalog.skills().count == 1)
        #expect(skill.description == "The Project's.")
        #expect(skill.shadowsUser)
    }

    /// The mark is a claim about a collision, so a Project skill standing alone must not carry it.
    @Test
    func `marks no shadow on a Project skill nothing collides with`() throws {
        try machine.write(
            FixtureSkill(directory: "alone", name: "alone"),
            into: machine.projectSkills,
        )
        try machine.write(FixtureSkill(directory: "other", name: "other"), into: machine.userSkills)

        #expect(machine.catalog.skills().allSatisfy { !$0.shadowsUser })
    }

    /// The read happens on every call and nothing is remembered between them, which is what makes a
    /// skill installed mid-Session appear next time the picker opens — no watcher, no restart.
    @Test
    func `sees a skill installed since the last read`() throws {
        let catalog = machine.catalog
        #expect(catalog.skills().isEmpty)
        try machine.write(FixtureSkill(directory: "new", name: "new"), into: machine.projectSkills)
        #expect(catalog.skills().map(\.name) == ["new"])
    }

    /// A machine that has never run the CLI. Empty is the answer, never a failure.
    @Test
    func `reads nothing on a machine with no skills directory at all`() {
        #expect(machine.catalog.skills().isEmpty)
    }
}
