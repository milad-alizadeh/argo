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
}

/// The instructions behind a marker, or the reason there are none.
public enum SkillBody: Equatable, Sendable {
    /// The markdown under the frontmatter, verbatim and never empty.
    case read(String)
    /// Why the file could not be read, in the sentence the panel shows.
    case unreadable(String)
}
