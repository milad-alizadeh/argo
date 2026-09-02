import ArgoEngine

/// One sentence on the seam, and everything the port printed behind it (§5 of
/// `cockpit-failure-states-spec.md`).
///
/// A pair rather than a bare string, so the line and the output under it are made in one place and
/// cannot come to disagree — the seam shows one note at a time, and a gesture opening the output
/// of a failure that is no longer on screen would be worse than no gesture.
struct ComposerSeamLine: Equatable, ExpressibleByStringLiteral {
    let detail: String
    /// What the gesture opens, and `nil` where the line IS the whole of it.
    let output: RawOutput?

    init(_ detail: String, output: RawOutput? = nil) {
        self.detail = detail
        self.output = output
    }

    /// A sentence Argo wrote itself, with no port output behind it to open.
    init(stringLiteral value: StringLiteralType) {
        self.init(value)
    }

    /// What a port's refusal leaves on the seam.
    ///
    /// A `SessionDriveError` carries no output: those sentences are Argo's own and one line long
    /// by that type's own contract, so the line is the whole of what there is, and §5's "a tooltip
    /// is not a raw channel" survives exactly there. Anything else reaching the composer is the
    /// port's or the system's own text, of a length nothing in Argo controls.
    init(_ error: any Error) {
        if let refused = error as? SessionDriveError {
            self.init(refused.detail)
        } else {
            let words = error.localizedDescription
            let output = RawOutput(words)
            self.init(output?.summary ?? words, output: output)
        }
    }
}
