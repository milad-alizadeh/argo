@testable import ArgoEngine
import Foundation

/// One skill to lay down: the directory the CLI knows it by, and what its `SKILL.md` states.
///
/// `markdown` replaces the generated file outright, which is how a test says "a `SKILL.md` that is
/// not a skill" without a second write method.
struct FixtureSkill {
    var directory: String
    var name: String?
    var description: String?
    var markdown: String?

    var contents: String {
        if let markdown {
            return markdown
        }
        let fields = [name.map { "name: \($0)" }, description.map { "description: \($0)" }]
        return "---\n\(fields.compactMap(\.self).joined(separator: "\n"))\n---\n\nBody.\n"
    }
}

/// One plugin installed on the machine, as `installed_plugins.json` records it.
struct FixturePlugin {
    var name: String
    var marketplace = "a-marketplace"
    /// The Project it is installed for. `nil` is a user-wide install, which every Project sees.
    var forProject: URL?
    var skills: [FixtureSkill] = []
}

/// A machine with skills on it: a Project, a home directory, and a plugin cache, built on disk.
///
/// Built rather than checked in, for `RecordDirectoryFixture`'s reason — what the catalog reads is
/// the filesystem, and a fixture that stubbed the read would prove only that two fakes agree. The
/// symlink case in particular has no in-memory equivalent: this repo's own skills are symlinks into
/// `.agents/skills`, so a reader that did not follow one would find nothing here at all.
struct SkillCatalogFixture {
    let rootURL: URL

    init() throws {
        self.rootURL = FileManager.default.temporaryDirectory
            .appending(path: "argo-skills-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
    }

    var projectURL: URL {
        rootURL.appending(path: "project", directoryHint: .isDirectory)
    }

    var homeURL: URL {
        rootURL.appending(path: "home", directoryHint: .isDirectory)
    }

    var catalog: SkillCatalog {
        SkillCatalog(projectURL: projectURL, homeURL: homeURL)
    }

    /// Where a Project's own skills live, and where the user's global ones do.
    var projectSkills: URL {
        projectURL.appending(
            path: ".claude/skills",
            directoryHint: .isDirectory,
        )
    }

    var userSkills: URL {
        homeURL.appending(path: ".claude/skills", directoryHint: .isDirectory)
    }

    func write(_ skill: FixtureSkill, into directoryURL: URL) throws {
        let skillURL = directoryURL.appending(path: skill.directory, directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: skillURL, withIntermediateDirectories: true)
        try Data(skill.contents.utf8).write(to: skillURL.appending(path: "SKILL.md"))
    }

    /// A skill directory that is a symlink to somewhere else on the machine, the way `skills add`
    /// leaves this repo's own.
    func link(_ skill: FixtureSkill, into directoryURL: URL) throws {
        let store = rootURL.appending(path: "elsewhere", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: store, withIntermediateDirectories: true)
        try write(skill, into: store)
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        try FileManager.default.createSymbolicLink(
            at: directoryURL.appending(path: skill.directory, directoryHint: .isDirectory),
            withDestinationURL: store.appending(path: skill.directory, directoryHint: .isDirectory),
        )
    }

    /// An empty directory where a skill would be — a folder the user made and never filled.
    func writeEmptyDirectory(named name: String, into directoryURL: URL) throws {
        try FileManager.default.createDirectory(
            at: directoryURL.appending(path: name, directoryHint: .isDirectory),
            withIntermediateDirectories: true,
        )
    }

    /// Install plugins, replacing whatever was installed before: the record is one file, so a
    /// second
    /// call rewrites it rather than appending to it.
    func install(_ plugins: [FixturePlugin]) throws {
        var entries: [String: [[String: String]]] = [:]
        for plugin in plugins {
            let installURL = cache(for: plugin)
            for skill in plugin.skills {
                try write(
                    skill,
                    into: installURL.appending(path: "skills", directoryHint: .isDirectory),
                )
            }
            entries["\(plugin.name)@\(plugin.marketplace)"] = [record(for: plugin, at: installURL)]
        }
        let recordURL = homeURL.appending(path: ".claude/plugins", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: recordURL, withIntermediateDirectories: true)
        try JSONSerialization
            .data(withJSONObject: ["version": 2, "plugins": entries])
            .write(to: recordURL.appending(path: "installed_plugins.json"))
    }

    func remove() {
        try? FileManager.default.removeItem(at: rootURL)
    }

    private func cache(for plugin: FixturePlugin) -> URL {
        homeURL.appending(
            path: ".claude/plugins/cache/\(plugin.marketplace)/\(plugin.name)/1.0.0",
            directoryHint: .isDirectory,
        )
    }

    private func record(for plugin: FixturePlugin, at installURL: URL) -> [String: String] {
        guard let forProject = plugin.forProject else {
            return ["scope": "user", "installPath": installURL.path, "version": "1.0.0"]
        }
        return [
            "scope": "project",
            "projectPath": forProject.path,
            "installPath": installURL.path,
            "version": "1.0.0",
        ]
    }
}
