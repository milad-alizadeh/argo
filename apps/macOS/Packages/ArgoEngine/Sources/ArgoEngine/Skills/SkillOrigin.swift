/// Where a skill came from. A plugin carries its own name here, because that name is part of the
/// command its skills answer to.
enum SkillOrigin: Equatable, Sendable {
    case project
    case user
    case plugin(String)
}
