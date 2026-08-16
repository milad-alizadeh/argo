/// Where a skill came from. A plugin carries its own name here, because that name is part of the
/// command its skills answer to.
public enum SkillOrigin: Equatable, Sendable {
    case project
    case user
    case plugin(String)

    /// The directory under a Project or a home folder that the CLI keeps skills in. One constant,
    /// so `readFrom` below and the walk in `SkillCatalog` cannot come to name different places.
    static let directory = ".claude/skills"

    /// Where the rows of this origin were read from, for the section header to say. A plugin gives
    /// its own name instead of a path: its skills live in a versioned cache directory nobody
    /// addresses by hand, and the name is what the command uses.
    public var readFrom: String {
        switch self {
        case .project: Self.directory
        case .user: "~/\(Self.directory)"
        case let .plugin(plugin): plugin
        }
    }
}
