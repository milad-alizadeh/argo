/// What the sidebar's hero states: one ticket worth picking up, or why there is none
/// (`cockpit-work-room.md` — the Next-up hero).
///
/// The three empty tiers are separate cases rather than one absence. A card that went blank would
/// say the same thing for a backlog nothing can start on and a backlog with nothing left in it,
/// and those are the two readings furthest apart a person can have of the same rail.
enum NextUp: Sendable, Equatable {
    case pick(Pick)
    /// Every open leaf is waiting on something still open.
    case nothingUnblocked
    /// Everything takeable already has a Session on it.
    case allRunning
    /// The provider answered, and it holds nothing open.
    case backlogClear

    struct Pick: Sendable, Equatable, Identifiable {
        let id: Int
        let title: String
        /// Why this one, in the design's order and already capped at two. A reason is EARNED off a
        /// fact Argo holds — never a score and never a number (#273).
        let reasons: [Reason]
    }

    /// One earned reason. An unknown earns nothing: with no dependency edges read, `unblocked` is
    /// SUPPRESSED rather than asserted, which is the tier the room ships in first.
    ///
    /// The design's fourth reason, `oldest untouched`, is deliberately absent: it is earned by a
    /// ranking that picks by age (#273), and nothing here reads an age to pick by. Rendering it
    /// today would put a claim on the card that no fact underwrites.
    enum Reason: Sendable, Equatable {
        case highPriority
        case unblocked
        case next(chart: String)
    }
}

extension NextUp.Reason {
    /// Verbatim from the design, lowercase — a chip labels the ticket above it rather than heading
    /// it.
    var words: String {
        switch self {
        case .highPriority: "high priority"
        case .unblocked: "unblocked"
        case let .next(chart): "next in \(chart)"
        }
    }

    /// Only priority takes ink. Two coloured chips beside each other would read as a scale, and
    /// the one thing the hero must never render is a score.
    var isUrgent: Bool {
        self == .highPriority
    }
}
