import ArgoEngine

/// How a refused write reads at the control — the REAL reason, one line, never a paraphrase
/// (`cockpit-failure-states-spec.md` §5).
///
/// In `ArgoUI` and not on the error, for the reason `ConnectionCause.readableName` is here: the
/// engine's job is to hold what the provider said, and the words on screen are Argo's vocabulary.
/// The unabridged output the same rule promises one gesture away is #275's AC8 and not yet built.
extension WorkItemWriteError {
    var reason: String {
        switch self {
        case let .unavailable(write):
            "This provider does not support \(write.readableName)"
        case let .inexpressible(state):
            "This provider has no status for \(state.readableName)"
        case let .illegalTransition(from, to):
            "This provider will not move a ticket from \(from.readableName) to \(to.readableName)"
        // The clause the rule exists for. Nothing is trimmed, capitalised or re-worded: the
        // provider's sentence is usually the only thing here that says how to fix it.
        case let .refused(words):
            words
        case let .unreachable(failure):
            failure.reason
        }
    }
}

private extension ProviderFetchError {
    /// The cause word is the CHIP's — one connection, one vocabulary, whether it is read off the
    /// top bar or off the control that just failed.
    var reason: String {
        guard let cause else { return "The account's token was refused" }
        return "The write did not land — \(cause.readableName)"
    }
}

private extension WorkItemWrite {
    /// What each of the eight is called in a sentence, rather than in Swift.
    var readableName: String {
        switch self {
        case .create: "creating tickets"
        case .updateFields: "editing fields"
        case .transition: "changing status"
        case .blockedBy: "dependency links"
        case .parent: "parent links"
        case .labels: "labels"
        case .priority: "priority"
        case .closure: "closing tickets"
        }
    }
}

private extension WorkItemCanonicalState {
    var readableName: String {
        switch self {
        case .todo: "todo"
        case .inProgress: "in progress"
        case .inReview: "in review"
        case .done: "done"
        case .closed: "closed"
        }
    }
}
