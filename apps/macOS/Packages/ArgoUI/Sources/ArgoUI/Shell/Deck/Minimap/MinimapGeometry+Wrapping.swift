import Foundation

// What the band's rows really wrapped to. The one place the lane asks anything about glyphs, and it
// asks twice over a bound: only for the rows inside the band, and only where the lane still draws
// the row as more than one line.
//
// That second bound is what keeps a long session cheap. A reading compressed until every row is a
// single mark has no ragged edge a measurement could show, so nothing is measured for it — and the
// readings where the lane draws whole paragraphs are the short ones, with few rows to measure.

extension MinimapGeometry {
    /// What a row's words are actually drawn across: the column less the gutter every row is inset
    /// from it. The lane's drawable stands for exactly this, which is why a full line of it is a
    /// full bar rather than a bar with the gutter drawn in.
    var proseMeasure: CGFloat {
        max(0, reading.columnWidth - ArgoFeedRow.inset * 2)
    }

    /// A row's wrap, block by block, or `.unmeasured` where measuring one would show nothing.
    @MainActor func wrapping(of shape: MinimapRowShape, over lines: Int) -> MinimapWrapping {
        let column = proseMeasure
        guard lines > 1, column > 0 else { return .unmeasured }
        switch shape {
        case let .prose(text, _):
            return MinimapWrapping(blocks: [ProseMetrics.wrap(of: text, across: column)])
        case let .bubble(text):
            return MinimapWrapping(blocks: [bubbleWrap(of: text)])
        case let .composed(blocks, _):
            return MinimapWrapping(blocks: blocks.map { block in
                // A fence and a table are drawn as their own shape, so neither is measured as
                // words.
                block.kind == .prose ? ProseMetrics.wrap(of: block.text, across: column) : []
            })
        case .sentence, .change, .shots, .whole:
            return .unmeasured
        }
    }

    /// A prompt's lines as shares of the COLUMN, measured across the inside of its bubble: the
    /// ceiling the bubble may grow to, less its own padding. `MinimapRuns.bubble` reads them in
    /// that
    /// unit, because the bubble's ground is as wide as its longest line.
    @MainActor private func bubbleWrap(of text: String) -> [CGFloat] {
        let column = proseMeasure
        let inside = column * ArgoFeedRow.bubbleShare - ArgoFeedRow.bubbleInsetX * 2
        guard inside > 0 else { return [] }
        return ProseMetrics.wrap(of: text, across: inside).map { $0 * inside / column }
    }
}
