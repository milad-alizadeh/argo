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

    /// What a chip's dot says, for a reader who cannot see it. The third is a state and not a
    /// hedge: Argo is holding an open delegation under a Session whose silence says nothing about
    /// it, and `finished` there would be the untruth #1269 was written for.
    static func state(_ activity: AgentActivity) -> String {
        switch activity {
        case .running: "running"
        case .finished: "finished"
        case .unknown: "state unknown"
        }
    }

    /// The Session's own reading, at the head of the rail (#1013). `Main` and not `Session`: the
    /// chip names one of the readings this Session has rather than the Session, and the reader is
    /// already inside it.
    static let main = "Main"

    static let collapsed = "\(agents), collapsed"
    static let hide = "Hide background agents"
    static let show = "Show background agents"

    /// The Agents that have landed, held out of the list so the live ones are not lost among them
    /// (#1090). The count ALONE is drawn; the chevron beside it is what says it opens.
    static func finished(_ count: Int) -> String {
        "\(count) finished"
    }

    /// What a reader who cannot see the chevron hears instead.
    static func revealFinished(_ count: Int) -> String {
        "Show \(finished(count))"
    }

    static func hideFinished(_ count: Int) -> String {
        "Hide \(finished(count))"
    }

    /// What ending a delegation says (#1267). "End" and never "Stop": Argo cannot reach a
    /// backgrounded child's process, and the honest claim is about the CALL — Argo stops holding a
    /// handover open whose report is never coming.
    static let end = "End delegation"

    /// The sentence behind it, on the control that offers it. It says what the act is ABOUT rather
    /// than what it does, because what it does is the label.
    static let endHelp = "Stop waiting for this agent's report"

    /// Every line the rail draws, for the suite that holds the rename.
    static let all = [
        agents, header(running: 2), main, collapsed, hide, show,
        finished(3), revealFinished(3), hideFinished(3),
        state(.running), state(.finished), state(.unknown),
        end, endHelp,
    ]
}
