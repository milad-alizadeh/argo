import ArgoEngine

extension TicketState {
    /// How Argo's bucket is SET beside the provider's own word — lowercase, and spelled as words
    /// rather than as the case name, which would file a ticket under `ruledout`.
    var filing: String {
        switch self {
        case .open: "open"
        case .claimed: "claimed"
        case .resolved: "resolved"
        case .ruledOut: "ruled out"
        }
    }

    /// The filing worth setting beside `word`, or `nil` where the word already says it (#893).
    /// Case is ignored: a provider that capitalises its word has not told us a second thing.
    func filing(beside word: String) -> String? {
        filing.caseInsensitiveCompare(word) == .orderedSame ? nil : filing
    }
}
