import ArgoEngine

/// Everything the Mode control SAYS, for one reading and for a rung HELD until the Turn ends
/// (#940). Here rather than in `ModePicker` so each claim is one a test can make — a precedence
/// living in a `private var` on a View is one only a screenshot can check.
struct ModeControlLabel {
    /// The word on the closed control.
    let word: String
    /// The mark beside it.
    let mark: String
    /// What the menu's header adds — the CLI's own word, or where the Session stands until the
    /// held rung takes over.
    let report: String?
    /// The tooltip.
    let help: String
    /// The rung to TICK, and `nil` wherever a tick would be a lie — which a held rung always is.
    let tick: SessionMode?
}

extension ModeControlLabel {
    /// Declared in an extension so the memberwise initialiser survives for this one to build
    /// through.
    ///
    /// A held rung is drawn under #545's own `≈` and ticks nothing. The mark carries a second
    /// sense here — not *the nearest rung to a fact Argo owns* but *a rung Argo has only asked
    /// for* — so what keeps it honest is the footnote, which names the rung the Session is
    /// actually standing on until the walk lands (`docs/domain/honesty-tier.md`).
    init(_ reading: SessionModeReading, held: SessionMode? = nil) {
        guard let held else {
            self.init(
                word: reading.word,
                mark: reading.mark,
                report: reading.report,
                help: reading.help,
                tick: reading.exactRung,
            )
            return
        }
        let word = SessionModeReading.approximately(held)
        let footnote = Self.holding(held, on: reading)
        self.init(
            word: word,
            mark: held.mark,
            report: footnote,
            help: SessionModeReading.help(word, on: held, footnote: footnote),
            tick: nil,
        )
    }

    /// What the control says about a rung it is holding. It names BOTH rungs, because the held one
    /// has taken the slot that otherwise says where the Session stands.
    static func holding(_ held: SessionMode, on reading: SessionModeReading) -> String {
        "\(reading.word) until this Turn ends, then \(held.label)"
    }
}
