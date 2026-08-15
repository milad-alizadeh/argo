/// One thing a Session can be asked for by name — a skill installed for the Project, or one of the
/// CLI's own built-ins (#685, #686).
///
/// The two are one type because the CLI addresses them identically as `/name`, which is the same
/// reason the design's `+` menu has two rows rather than three.
public struct Command: Equatable, Sendable {
    /// A skill's frontmatter `name`, or the directory it sits in when it states none. A built-in's
    /// name as the Help panel prints it, without the leading slash.
    public let name: String
    /// Absent when the source states none, and never invented.
    public let description: String?
    public let origin: CommandOrigin
    /// Whether a global skill of this name was found and left out because this one stands in front
    /// of it (#685). Only a Project skill can carry it: a plugin's commands are namespaced and
    /// cannot collide with a bare `/name`.
    public let shadowsUser: Bool

    /// Public so the cockpit's own fixtures can build a catalog: the picker is drawn from a value,
    /// and a specimen has no filesystem behind it.
    public init(
        name: String,
        description: String?,
        origin: CommandOrigin,
        shadowsUser: Bool = false,
    ) {
        self.name = name
        self.description = description
        self.origin = origin
        self.shadowsUser = shadowsUser
    }

    /// What goes in the draft when this is picked. A plugin's skills are namespaced, so only the
    /// other three origins can share one.
    public var command: String {
        switch origin {
        case .project, .user, .claudeCode: "/\(name)"
        case let .plugin(plugin): "/\(plugin):\(name)"
        }
    }
}
