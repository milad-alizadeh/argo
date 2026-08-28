import ArgoEngine

/// What a write control says, and whether the sentence has a repair behind it.
extension WriteControlState {
    /// Pending says nothing: a word appearing beside it would be the layout shift §4 rules out.
    var reason: String? {
        switch self {
        case .live, .pending: nil
        case let .refused(refusal): refusal.reason
        // The chip's own wording for this level, separators and status word included: the line
        // states the fact and the button beside it carries the act.
        case let .blocked(account):
            "\(account.provider.readableName) · \(account.displayName) · needs reconnect"
        }
    }

    /// §7 disables the control "pointing at the same `Reconnect`", so the note carries the act.
    /// Only the refused grant has one — a provider that answered "no" is not repaired by
    /// re-granting anything.
    var needsReconnect: Bool {
        switch self {
        case .blocked: true
        case .live, .pending, .refused: false
        }
    }
}
