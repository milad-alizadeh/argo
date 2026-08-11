import ArgoEngine

/// What the Mode control says for one reading of a Session's stance (#545, design decision 1).
/// Here rather than in `ModePicker` so each case is a claim a test can make.
extension SessionModeReading {
    /// The word on the closed control. `≈` goes BEFORE the rung, where it qualifies what follows
    /// rather than reading as a fifth mark.
    var word: String {
        guard let rung else { return "unknown" }
        return isApproximate ? "≈ \(rung.label)" : rung.label
    }

    /// The mark beside it, and the question mark for a stance that is on no rung at all.
    var mark: String {
        rung?.mark ?? ArgoSymbol.modeUnknown
    }

    /// What the CLI's own word adds, verbatim. `nil` for an exact reading, which needs no
    /// footnote.
    var report: String? {
        switch self {
        case .exactly: nil
        case let .nearly(_, cli): "reported as \(cli)"
        case let .unknown(cli): cli.map { "reported as \($0)" } ?? "no stance has been read"
        }
    }

    /// The tooltip: the rung and where it stops, then the CLI's own word where the two differ.
    var help: String {
        let head = rung.map { "\(word) — \($0.boundary)" } ?? word
        guard let report else { return head }
        return "\(head) · \(report)"
    }

    /// The rung to TICK in the menu, and `nil` wherever a tick would be a lie: an approximation is
    /// not a rung the user chose, and `unknown` is not a rung at all.
    var exactRung: SessionMode? {
        switch self {
        case let .exactly(rung, _): rung
        case .nearly, .unknown: nil
        }
    }
}
