import ArgoEngine

/// What a write control SAYS — the half of the state that is words rather than policy.
///
/// Apart from the state itself so the fold stays a fold: the precedence between an admission and an
/// attempt is a rule with tests on it, and the sentence beside the button is a wording that will
/// change without the rule changing.
///
/// **One tone, and it is the chip's.** Both of these read in `failure` ink, because the chip
/// already spends red on `needs reconnect` and this is the same fact seen from the control — an
/// amber here would make one connection two colours depending on where you looked at it.
extension WriteControlState {
    /// The one line beside the control, and `nil` where there is nothing to say. Pending says
    /// nothing on purpose: the disabled control IS the statement, and a word beside it would be
    /// the layout shift §4 rules out.
    var reason: String? {
        switch self {
        case .live, .pending, .absent: nil
        case let .refused(refusal): refusal.reason
        case let .blocked(account):
            "Reconnect \(account.displayName) on \(account.provider.readableName)"
        }
    }
}
