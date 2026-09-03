import ArgoDesign
import CoreGraphics
import ProseText

// How tall a run of words stands, in the two rhythms the feed sets them at.
//
// The feed's PROSE carries `ArgoFeedRow.proseLineSpacing`, so its lines stand at `ProseFace.step` —
// that is the rhythm `MinimapProseBlock` and `FeedRowMeasure` already report. Everything else the
// feed sets — a question on an ask card, an option's words, a raw unreadable line — is a plain
// `Text` with no `lineSpacing` of its own, and those lines stand at the FONT's own advance instead.
// The two are two points apart a line here, which is six points of overlap by the fourth line of a
// question.

extension FeedShapeHeight {
    /// A wrapped run with no leading added — a `Text` the feed sets without `.lineSpacing`.
    ///
    /// Rounded UP to a whole point: a `Text` sizes itself to whole points, so a stack of runs pays
    /// a rounding each rather than one over the sum.
    static func unleaded(_ text: String, in face: ProseFace, across measure: CGFloat) -> CGFloat {
        ceil(face.unleadedHeight(ofLines: lines(of: text, in: face, across: measure)))
    }

    /// A prompt's own words, at the feed's leading and held to the lines a fold shows. `nil` shows
    /// all of them.
    static func folded(_ text: String, to limit: Int?, across measure: CGFloat) -> CGFloat {
        let face = ProseFace.body
        let laid = lines(of: text, in: face, across: measure)
        return ceil(face.height(ofLines: limit.map { min(laid, $0) } ?? laid))
    }

    /// How many lines the words wrapped into. A run of nothing still stands at one line where it is
    /// drawn at all — the callers that draw nothing for empty words check before they ask.
    static func lines(of text: String, in face: ProseFace, across measure: CGFloat) -> Int {
        max(1, ProseMetrics.lay(out: text, across: measure, in: face).lines)
    }
}
