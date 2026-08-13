/// One skill a Session can be asked for by name (#685).
public struct Skill: Equatable, Sendable {
    /// The frontmatter's `name`, or the directory it sits in when it states none. The two agree
    /// across every skill installed on this machine.
    public let name: String
    /// Absent when the skill states none, and never invented.
    public let description: String?
    public let origin: SkillOrigin
    /// Whether a global skill of this name was found and left out because this one stands in front
    /// of it (#685). Only a Project skill can carry it: a plugin's commands are namespaced and
    /// cannot collide with a bare `/name`.
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
