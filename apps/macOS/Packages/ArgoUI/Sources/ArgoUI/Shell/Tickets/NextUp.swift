/// What the sidebar's hero states: one ticket worth picking up, or which of three reasons there is
/// none (`cockpit-work-room.md` — the Next-up hero).
package enum NextUp: Sendable, Equatable {
    case pick(Pick)
    /// Every open leaf is waiting on something still open.
    case nothingUnblocked
    /// Everything takeable already has a Session on it.
    case allRunning
    /// The provider answered, and it holds nothing open.
    case backlogClear

    /// At most two chips, and never a score (#273).
    static let chipLimit = 2

    package struct Pick: Sendable, Equatable, Identifiable {
        let number: Int
        let title: String
        /// Why this one, in the design's order and already cut to `chipLimit`.
        let reasons: [Reason]

        package var id: Int {
            number
        }
    }

    /// One earned reason. An unknown earns nothing: with no dependency edges read, `unblocked` is
    /// suppressed rather than asserted.
    ///
    /// There is deliberately no `spec ready` case. The design draws no such chip, and the one thing
    /// that could earn one is an explicit provider label — never a read of the prose (#273).
    enum Reason: Sendable, Equatable {
        case highPriority
        case unblocked
        case next(chart: String)
        /// The design's honest fallback, earned only where the other three were not AND a timestamp
        /// was actually read: it is the age tie-break of the ranking, said out loud.
        case oldestUntouched
    }
}

extension NextUp.Reason {
    /// Verbatim from the design, lowercase.
    var words: String {
        switch self {
        case .highPriority: "high priority"
        case .unblocked: "unblocked"
        case let .next(chart): "next in \(chart)"
        case .oldestUntouched: "oldest untouched"
        }
    }

    /// Only priority takes ink; two coloured chips would read as a scale.
    var isUrgent: Bool {
        self == .highPriority
    }
}
