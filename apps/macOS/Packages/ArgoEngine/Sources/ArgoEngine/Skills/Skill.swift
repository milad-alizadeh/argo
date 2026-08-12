/// One skill a Session can be asked for by name (#685).
struct Skill: Equatable, Sendable {
    /// The frontmatter's `name`, or the directory it sits in when it states none. The two agree
    /// across every skill installed on this machine.
    let name: String
    /// Absent when the skill states none, and never invented.
    let description: String?
    let origin: SkillOrigin

    /// What goes in the draft when this skill is picked. A plugin's skills are namespaced, so only
    /// `project` and `user` can share one.
    var command: String {
        switch origin {
        case .project, .user: "/\(name)"
        case let .plugin(plugin): "/\(plugin):\(name)"
        }
    }
}
