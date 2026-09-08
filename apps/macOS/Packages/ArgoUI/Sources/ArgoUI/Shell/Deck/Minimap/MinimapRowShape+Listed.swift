import Foundation

// A fold the reader has let out, drawn as the stack the row draws: its count line, and one line per
// call it took, under the header and indented to hang beneath its WORDS.
//
// This is where an open card stops being one line stretched over a tall span (#1691). The row's
// height is already the stack's — `FeedShapeHeight.folded` — so a lane reporting a single line put
// one mark where nineteen belong, and a card of nineteen steps read exactly like a card of one.

extension MinimapRowShape {
    /// The lines of an open fold, at the pitch the row stacks them at: the header on the row's own
    /// first line, and the nth name `FeedShapeHeight.foldedLineStep` below it.
    ///
    /// The names are laid out across what is left of the measure after the indent and moved into
    /// place afterwards, so a long caption is cut where the row cuts it rather than at the lane's
    /// trailing edge.
    @MainActor static func listed(
        _ header: [MinimapLinePart],
        steps: [[MinimapLinePart]],
        ink: FeedInk,
        across measure: CGFloat,
    )
        -> [MinimapRowRect] {
        let indent = ArgoFeedRow.foldNameIndent
        let named = steps.enumerated().flatMap { position, step in
            line(step, ink: ink, across: max(0, measure - indent)).map {
                $0.indented(by: indent)
                    .lowered(by: FeedShapeHeight.foldedLineStep * CGFloat(position + 1))
            }
        }
        return line(header, ink: ink, across: measure) + named
    }
}
