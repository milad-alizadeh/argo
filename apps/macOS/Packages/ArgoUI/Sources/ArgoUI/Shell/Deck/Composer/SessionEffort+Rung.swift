import ArgoEngine

/// How the composer says a stop on the effort scale (#558). The engine owns the scale; this is only
/// the word the segmented control draws it with.
///
/// The words are Argo's own capitalisation of the CLI's own five — never a rewording. `XHigh` is
/// the one that needed deciding, because it is the one rung the approved design did not draw: the
/// CLI spells it `xhigh`, and `X-High` would read as a sixth thing rather than the rung above High.
extension SessionEffort {
    var label: String {
        switch self {
        case .low: "Low"
        case .medium: "Medium"
        case .high: "High"
        case .xhigh: "XHigh"
        case .max: "Max"
        }
    }
}

/// What the composer SAYS for one reading of the scale — the rung's word, or the CLI's own word
/// where the reading is on no rung, or `unknown` where nothing has been read at all.
extension SessionEffortReading {
    /// Verbatim wherever the reading is not a rung: a level this Argo predates is stated as the CLI
    /// spells it rather than dropped or rounded to a neighbour (`CONTEXT.md` degrade-down).
    var words: String {
        rung?.label ?? cliValue ?? RunFacts.unknownWords
    }
}
