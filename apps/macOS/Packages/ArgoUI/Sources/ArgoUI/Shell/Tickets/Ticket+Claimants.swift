import ArgoEngine

extension Ticket {
    /// The order a CONTESTED PARENT EDGE resolves in, and the ONE tie-break every surface asking
    /// "which parent claims this ticket" takes (#919, #985): lowest number first, so a ticket two
    /// parents both claim hangs under the lower-numbered claimant rather than under whichever the
    /// provider's array happened to serve first.
    ///
    /// Lowest, not highest: the older parent is the one less likely to be superseded, so anchoring
    /// there is what keeps a ticket's home still between polls.
    ///
    /// Shared as an ORDER and never as a parent, because the surfaces ask different questions — the
    /// backlog tree's parent is any SHOWN parent and the hero chip's is the PRD-SHAPED one, so the
    /// two may legitimately name different tickets. What must not differ is how each breaks a tie.
    ///
    /// `TicketsReading+Ranking.swift`'s `sequence(of:)` is deliberately NOT one of them: the
    /// provider's author order is the fact it is reading, not a tie it is breaking.
    static func oldestFirst(_ items: [Ticket]) -> [Ticket] {
        items.sorted { $0.number < $1.number }
    }
}
