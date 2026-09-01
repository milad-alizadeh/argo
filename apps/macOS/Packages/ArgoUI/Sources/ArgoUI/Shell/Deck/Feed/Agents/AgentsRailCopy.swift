/// What the agents rail says, as values rather than literals inside a `body`.
///
/// **The drawn word is `Background Agents`; the model's word is `Subagent` and stays that
/// everywhere else** — code, comments, `CONTEXT.md` L3 · Subagent and the rest of `docs/domain/`.
/// A deliberate departure, not an oversight (#1014): `Subagent` is precise about the runtime tree,
/// and `Background Agents` is what the reader is looking at beside the reading. Do not put the
/// model's word back on screen.
///
/// Its own type for `WelcomeCopy`'s reasons: a string inside a `body` is a string no suite can
/// reach, and a `View` is `@MainActor` where a copy suite is not.
enum AgentsRailCopy {
    static let agents = "Background Agents"

    /// The count is of what is RUNNING, which is the question the rail is glanced at to answer.
    static func header(running: Int) -> String {
        "\(agents) · \(running) running"
    }

    /// The Session's own reading, at the head of the rail (#1013). `Main` and not `Session`: the
    /// chip names one of the readings this Session has rather than the Session, and the reader is
    /// already inside it.
    static let main = "Main"

    static let collapsed = "\(agents), collapsed"
    static let hide = "Hide background agents"
    static let show = "Show background agents"

    /// Every line the rail draws, for the suite that holds the rename.
    static let all = [agents, header(running: 2), main, collapsed, hide, show]
}
