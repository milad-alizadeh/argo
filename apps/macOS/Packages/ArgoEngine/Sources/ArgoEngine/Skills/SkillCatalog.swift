import Foundation

/// Every skill installed for one Project, read from the same files the CLI reads (#685).
///
/// Nothing is cached and nothing is watched: `skills()` walks the directories on every call, so a
/// skill installed while a Session is open is there the next time the picker opens.
///
/// The two roots are values the caller supplies, for `TranscriptRecordStore`'s reason — the CLI
/// owns these directories and Argo only reads them.
struct SkillCatalog {
    private let projectURL: URL
    private let homeURL: URL

    init(projectURL: URL, homeURL: URL = FileManager.default.homeDirectoryForCurrentUser) {
        self.projectURL = projectURL.standardizedFileURL
        self.homeURL = homeURL.standardizedFileURL
    }

    /// One directory of skills, and the origin everything in it has.
    private struct Source {
        let url: URL
        let origin: SkillOrigin
    }

    /// The Project's skills, then the user's, then each plugin's, and each origin's own in name
    /// order.
    ///
    /// One row per command: a Project skill and a global skill of the same name are one `/name` to
    /// the CLI, so a second row could not be picked. The Project's wins, being the narrower scope.
    func skills() -> [Skill] {
        var claimed: Set<String> = []
        return sources()
            .flatMap(skills(in:))
            .filter { claimed.insert($0.command).inserted }
    }

    private func sources() -> [Source] {
        [
            Source(url: skillsDirectory(under: projectURL), origin: .project),
            Source(url: skillsDirectory(under: homeURL), origin: .user),
        ] + InstalledPlugins
            .skillDirectories(under: homeURL, for: projectURL)
            .map { Source(url: $0.url, origin: .plugin($0.plugin)) }
    }

    private func skillsDirectory(under url: URL) -> URL {
        url.appending(path: ".claude/skills", directoryHint: .isDirectory)
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
