/// What asking Argo to end one Session's agent established (#1609).
public enum SessionEndResult: Equatable, Sendable {
    /// Argo ended the process it owns or the one exact orphaned Claude process it identified.
    case ended
    /// No Claude process carried this Session's id. It may already have ended, or the process
    /// table may be unreadable; neither is permission to choose a neighbour.
    case notFound
    /// No single unambiguous Claude process carried the Session's id, so none was chosen.
    case ambiguous
    /// The one identified process refused the termination signal.
    case signalFailed
    /// Putting a Session back, an external Session, or a CLI with no argv key ends nothing.
    case notApplicable

    /// What the app says after an archive that could not safely stop the orphaned agent. External
    /// Sessions are explained before the gesture instead, and `ended` needs no report.
    public var limitationDetail: String? {
        switch self {
        case .ended, .notApplicable:
            nil
        case .notFound:
            "Argo could not find one Claude process carrying this Session id, " +
                "so it stopped no agent."
        case .ambiguous:
            "Argo could not establish one unambiguous Claude process for this Session id, " +
                "so it stopped no agent. Multiple processes or conflicting identifier flags " +
                "can cause this limitation."
        case .signalFailed:
            "Argo found the Claude process for this Session, but the process did not accept " +
                "the stop signal."
        }
    }
}
