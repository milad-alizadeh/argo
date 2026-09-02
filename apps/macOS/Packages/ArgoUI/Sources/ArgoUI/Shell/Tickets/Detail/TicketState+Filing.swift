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

    /// The filing worth setting beside `word`, or `nil` where the head draws the word alone (#893).
    ///
    /// Two ways to earn nothing. **`open` never earns the slot**: the ticket is in an open listing,
    /// so Argo filing it under `open` restates the room the reader is already standing in — which
    /// is how a head came to read `In progress | open`, two words for one bit, the second of them
    /// dimmed. And a bucket the word ALREADY SAYS earns nothing whatever the bucket is; case is
    /// ignored, because a provider that capitalises its word has not told us a second thing.
    func filing(beside word: String) -> String? {
        guard self != .open, filing.caseInsensitiveCompare(word) != .orderedSame else { return nil }
        return filing
    }
}
