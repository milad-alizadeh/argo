import Foundation

/// Every skill installed for one Project, read from the same files the CLI reads (#685).
///
/// Nothing is cached and nothing is watched: `skills()` walks the directories on every call, so a
/// skill installed while a Session is open is there the next time the picker opens.
///
/// The two roots are values the caller supplies, for `TranscriptRecordStore`'s reason — the CLI
/// owns these directories and Argo only reads them.
public struct SkillCatalog {
    private let projectURL: URL
    private let homeURL: URL

    public init(projectURL: URL, homeURL: URL = FileManager.default.homeDirectoryForCurrentUser) {
        self.projectURL = projectURL.standardizedFileURL
        self.homeURL = homeURL.standardizedFileURL
    }

    /// One directory of skills, and the origin everything in it has.
    private struct Source {
        let url: URL
        let origin: SkillOrigin
    }

    /// The Project's skills, then the user's, then each enabled plugin's, and each origin's own in
    /// name order — nearest origin first, which is the order the picker's sections are drawn in.
    ///
    /// A name the Project and the user both carry is listed ONCE, under the Project, marked
    /// `shadowsUser` (`cockpit-composer-picker.md` decision 7).
    public func skills() -> [Skill] {
        Self.shadowed(sources().flatMap(skills(in:)))
    }

    /// Drop each user skill a Project skill of the same name stands in front of, and mark the row
    /// that is standing there. Nothing else can collide: a plugin's commands carry its name.
    private static func shadowed(_ found: [Skill]) -> [Skill] {
        let ofProject = Set(found.filter { $0.origin == .project }.map(\.name))
        return found.compactMap { skill in
            switch skill.origin {
            case .user where ofProject.contains(skill.name): nil
            case .project: Skill(
                    name: skill.name,
                    description: skill.description,
                    origin: .project,
                    shadowsUser: found.contains { $0.origin == .user && $0.name == skill.name },
                )
            default: skill
            }
        }
    }

    private func sources() -> [Source] {
        [
            Source(url: skillsDirectory(under: projectURL), origin: .project),
            Source(url: skillsDirectory(under: homeURL), origin: .user),
        ] + enabledInstalls().map { Source(url: $0.skillsURL, origin: .plugin($0.plugin)) }
    }

    /// A plugin has to be both installed for this Project and switched on. Installed alone is not
    /// enough: its skills are unpacked and no command reaches them.
    private func enabledInstalls() -> [PluginInstall] {
        let enabled = EnabledPlugins(homeURL: homeURL, projectURL: projectURL)
        return InstalledPlugins
            .installs(under: homeURL, for: projectURL)
            .filter { enabled.isEnabled($0.key) }
    }

    private func skillsDirectory(under url: URL) -> URL {
        url.appending(path: SkillOrigin.directory, directoryHint: .isDirectory)
    }

    private func skills(in source: Source) -> [Skill] {
        entries(in: source.url).compactMap { skill(at: $0, from: source.origin) }
    }

    /// Whatever sits directly under a skills directory, in name order. An entry is never asked
    /// whether it is a directory: this repo installs its own skills as symlinks, and a symlink
    /// answers that question differently from the folder it points at.
    private func entries(in url: URL) -> [URL] {
        let found = (try? FileManager.default.contentsOfDirectory(
            at: url,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles],
        )) ?? []
        return found.sorted { $0.lastPathComponent < $1.lastPathComponent }
    }

    /// A directory with no `SKILL.md`, a `SKILL.md` with no frontmatter, and a plain file that
    /// happens to sit there are all not skills. None of them stops the entry beside it being read.
    private func skill(at url: URL, from origin: SkillOrigin) -> Skill? {
        guard let markdown = try? String(
            contentsOf: url.appending(path: "SKILL.md"),
            encoding: .utf8,
        ),
            let read = SkillFrontmatter(markdown: markdown)
        else { return nil }
        return Skill(
            name: read.name ?? url.lastPathComponent,
            description: read.description,
            origin: origin,
        )
    }
}
