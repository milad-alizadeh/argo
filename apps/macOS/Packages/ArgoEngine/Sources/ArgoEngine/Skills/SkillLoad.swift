/// One skill a Session was handed, as the record says it happened (#688).
///
/// The record names a DIRECTORY and nothing else, so everything a reader sees is read from the
/// `SKILL.md` under it — through `SkillFrontmatter`, the same reader the picker's catalog uses.
public struct SkillLoad: Equatable, Sendable {
    /// The frontmatter's `name`, or the directory the CLI addressed the skill by when it states
    /// none. Never invented — the two agree across every skill installed on this machine.
    public let name: String
    /// The directory the record named. `SKILL.md` under it is the address the panel opens on.
    public let directory: String
    /// What Argo read there, or why it could not. `nil` where the file held a body with nothing in
    /// it: a panel over nothing would claim a reading Argo does not have.
    public let body: SkillBody?

    public init(name: String, directory: String, body: SkillBody?) {
        self.name = name
        self.directory = directory
        self.body = body
    }

    /// The file Argo read, and the one the panel opens on.
    public var path: String {
        Self.path(under: directory)
    }

    /// The one place the file's name is spelled, so the address a reader is shown cannot come to
    /// name a different file from the one the bytes were taken out of.
    static func path(under directory: String) -> String {
        "\(directory)/\(fileName)"
    }

    /// What the CLI calls a skill's own file, in `SkillCatalog`'s walk and in this read alike.
    static let fileName = "SKILL.md"
}

/// The instructions behind a marker, or the reason there are none.
public enum SkillBody: Equatable, Sendable {
    /// The markdown under the frontmatter, verbatim and never empty.
    case read(String)
    /// Why the file could not be read, in the sentence the panel shows.
    case unreadable(String)

    /// What a reader is shown — the instructions, or the sentence saying why there are none.
    public var text: String {
        switch self {
        case let .read(markdown): markdown
        case let .unreadable(why): why
        }
    }

    public var hasFailed: Bool {
        guard case .unreadable = self else { return false }
        return true
    }
}
