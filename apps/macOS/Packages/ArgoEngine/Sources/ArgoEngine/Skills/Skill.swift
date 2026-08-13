/// One skill a Session can be asked for by name (#685).
public struct Skill: Equatable, Sendable {
    /// The frontmatter's `name`, or the directory it sits in when it states none. The two agree
    /// across every skill installed on this machine.
    public let name: String
    /// Absent when the skill states none, and never invented.
    public let description: String?
    public let origin: SkillOrigin
    /// Whether this row is standing where one of the user's own skills would be — the mark the
    /// design calls `shadows yours` (`cockpit-composer-picker.md` decision 7).
    ///
    /// Only a Project skill can carry it, because a plugin's commands are namespaced and cannot
    /// collide with a bare `/name` at all. The shadowed copy is not listed: the CLI would never run
    /// it, and a row the CLI ignores is a lie.
    public let shadowsUser: Bool

    /// Public so the cockpit's own fixtures can build a catalog: the picker is drawn from a value,
    /// and a specimen has no filesystem behind it.
    public init(
        name: String,
        description: String?,
        origin: SkillOrigin,
        shadowsUser: Bool = false,
    ) {
        self.name = name
        self.description = description
        self.origin = origin
        self.shadowsUser = shadowsUser
    }

    /// What goes in the draft when this skill is picked. A plugin's skills are namespaced, so only
    /// `project` and `user` can share one.
    public var command: String {
        switch origin {
        case .project, .user: "/\(name)"
        case let .plugin(plugin): "/\(plugin):\(name)"
        }
    }
}
