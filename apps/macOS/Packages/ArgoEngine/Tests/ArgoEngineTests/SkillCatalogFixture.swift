@testable import ArgoEngine
import Foundation

/// One skill to lay down: the directory the CLI knows it by, and what its `SKILL.md` states.
struct FixtureSkill {
    var directory: String
    var name: String?
    var description: String?
    /// Replaces the generated file outright, for a `SKILL.md` that is not a skill.
    var markdown: String?

    var contents: String {
        if let markdown {
            return markdown
        }
        let fields = [name.map { "name: \($0)" }, description.map { "description: \($0)" }]
        return "---\n\(fields.compactMap(\.self).joined(separator: "\n"))\n---\n\nBody.\n"
    }
}

/// A machine with skills on it: a Project, a home directory, and a plugin cache, built on disk.
///
/// A class so its `deinit` clears up, as `TranscriptTailTests`' own fixture does. The symlink case
/// has no in-memory equivalent: this repo's skills are symlinks into `.agents/skills`, so a reader
/// that did not follow one would find nothing here at all.
final class SkillCatalogFixture {
    let rootURL: URL

    init() throws {
        self.rootURL = FileManager.default.temporaryDirectory
            .appending(path: "argo-skills-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
    }

    deinit { try? FileManager.default.removeItem(at: rootURL) }

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
        projectURL.appending(path: ".claude/skills", directoryHint: .isDirectory)
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

    /// Install plugins, replacing whatever was installed before: both files are rewritten, so a
    /// second call replaces the machine's plugins rather than adding to them.
    func install(_ plugins: [FixturePlugin]) throws {
        var entries: [String: [[String: String]]] = [:]
        for plugin in plugins {
            let installURL = cache(for: plugin)
            let skillsURL = installURL.appending(path: "skills", directoryHint: .isDirectory)
            for skill in plugin.skills {
                try write(skill, into: skillsURL)
            }
            entries[plugin.key] = [record(for: plugin, at: installURL)]
        }
        let recordURL = homeURL.appending(path: ".claude/plugins", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: recordURL, withIntermediateDirectories: true)
        try JSONSerialization
            .data(withJSONObject: ["version": 2, "plugins": entries])
            .write(to: recordURL.appending(path: "installed_plugins.json"))
        try switchOn(plugins)
    }

    /// The user settings' `enabledPlugins` — the other half of whether a plugin is reachable. One
    /// the fixture never mentions is absent from the map, as `posthog` is on this machine.
    func switchOn(_ plugins: [FixturePlugin]) throws {
        try write(
            settings: ["enabledPlugins": plugins.reduce(into: [:]) { switches, plugin in
                switches[plugin.key] = plugin.isEnabled
            }],
            to: homeURL.appending(path: ".claude", directoryHint: .isDirectory),
        )
    }

    /// One settings file, wherever the layering puts it.
    func write(settings: [String: [String: Bool]], to directoryURL: URL) throws {
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        try JSONSerialization
            .data(withJSONObject: settings)
            .write(to: directoryURL.appending(path: "settings.json"))
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
