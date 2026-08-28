import ArgoEngine

/// How a refused write reads at the control — the real reason, one line (§5). The unabridged
/// output the same rule promises one gesture away is #850.
extension TicketWriteError {
    var reason: String {
        switch self {
        case let .unavailable(write):
            "This provider does not support \(write.readableName)"
        case let .inexpressible(state):
            "This provider has no status for \(state.readableName)"
        case let .illegalTransition(from, to):
            "This provider will not move a ticket from \(from.readableName) to \(to.readableName)"
        // Verbatim: the provider's sentence is usually the only thing here that says how to fix it.
        case let .refused(words):
            words
        case let .unreachable(failure):
            failure.reason
        }
    }
}

private extension ProviderFetchError {
    /// The cause word is the chip's, so one connection reads in one vocabulary wherever you meet
    /// it. `grantRefused` has none because it is an Account fact, not a connection one.
    var reason: String {
        guard let cause else { return "The account's token was refused" }
        return "The write did not land — \(cause.readableName)"
    }
}

private extension TicketWrite {
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

private extension TicketCanonicalState {
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
