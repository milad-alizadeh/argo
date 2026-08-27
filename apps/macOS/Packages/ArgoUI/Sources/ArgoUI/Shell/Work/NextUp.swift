/// What the sidebar's hero states: one ticket worth picking up, or which of three reasons there is
/// none (`cockpit-work-room.md` — the Next-up hero).
enum NextUp: Sendable, Equatable {
    case pick(Pick)
    /// Every open leaf is waiting on something still open.
    case nothingUnblocked
    /// Everything takeable already has a Session on it.
    case allRunning
    /// The provider answered, and it holds nothing open.
    case backlogClear

    /// At most two chips, and never a score (#273).
    static let chipLimit = 2

    struct Pick: Sendable, Equatable, Identifiable {
        let number: Int
        let title: String
        /// Why this one, in the design's order and already cut to `chipLimit`.
        let reasons: [Reason]

        var id: Int {
            number
        }
    }

    /// One earned reason. An unknown earns nothing: with no dependency edges read, `unblocked` is
    /// suppressed rather than asserted.
    ///
    /// The design's fourth reason, `oldest untouched`, has no case here — it is earned by a ranking
    /// that picks by age (#273), and nothing reads an age.
    enum Reason: Sendable, Equatable {
        case highPriority
        case unblocked
        case next(chart: String)
    }
}

extension NextUp.Reason {
    /// Verbatim from the design, lowercase.
    var words: String {
        switch self {
        case .highPriority: "high priority"
        case .unblocked: "unblocked"
        case let .next(chart): "next in \(chart)"
        }
    }

    /// Only priority takes ink; two coloured chips would read as a scale.
    var isUrgent: Bool {
        self == .highPriority
    }
}
