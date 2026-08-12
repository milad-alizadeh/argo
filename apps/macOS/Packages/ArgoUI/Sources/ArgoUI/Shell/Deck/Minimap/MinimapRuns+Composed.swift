import Foundation

// A prose row with markdown structure in it, laid out block by block (#382): each block takes its
// share of the row's drawn lines in proportion to what it stands in the feed, so a table's frame
// sits about where the table is and the paragraphs keep their ragged lines around it. The shares
// decide only how the row's own lines divide — never where the row sits.

extension MinimapRuns {
    /// The runs a structured prose row makes across `lines` of drawn line.
    static func composed(
        _ blocks: [MinimapProseBlock],
        ink: FeedInk,
        over lines: Int,
        across measure: CGFloat,
        wrapped: MinimapWrapping = .unmeasured,
    )
        -> [MinimapRun] {
        let weights = blocks.indices.map {
            weight(of: blocks[$0], measured: wrapped.lines(of: $0), across: measure)
        }
        var runs: [MinimapRun] = []
        var cursor = 0
        for (at, share) in shares(of: lines, by: weights).enumerated() where share > 0 {
            let block = Wrapped(block: blocks[at], lines: wrapped.lines(of: at))
            runs.append(contentsOf: self.runs(
                of: block,
                ink,
                on: cursor ..< cursor + share,
                across: measure,
            ))
            cursor += share
        }
        return runs
    }

    /// One block of the row and the wrap measured for it. The two travel together everywhere below,
    /// because neither answers anything about how the block is drawn without the other.
    struct Wrapped {
        let block: MinimapProseBlock
        let lines: [CGFloat]?
    }

    /// How many feed lines one block stands: the lines it really wrapped to where those were
    /// measured, and otherwise the same estimate raggedness is drawn from. A table's row stands
    /// about two text lines with its cell padding; a fence's box adds its own two.
    private static func weight(
        of block: MinimapProseBlock,
        measured: [CGFloat]?,
        across measure: CGFloat,
    )
        -> Int {
        switch block.kind {
        case .prose:
            if let measured {
                return max(1, measured.count)
            }
            let perLine = CGFloat(MinimapRuns.charactersPerLine(across: measure))
            guard perLine > 0 else { return 1 }
            return max(1, Int((CGFloat(block.length) / perLine).rounded(.up)))
        case .table: return max(1, (block.sourceLines ?? 1) * 2)
        case .fence: return (block.sourceLines ?? 1) + 2
        }
    }

    /// Whole lines dealt in proportion to the weights, remainders to the heaviest blocks first —
    /// so the deal is stable and sums exactly to `lines`. Shared with the table's own rows.
    static func shares(of lines: Int, by weights: [Int]) -> [Int] {
        let total = weights.reduce(0, +)
        guard total > 0 else { return weights.map { _ in 0 } }
        var dealt = weights.map { $0 * lines / total }
        var leftover = lines - dealt.reduce(0, +)
        for at in weights.indices.sorted(by: { weights[$0] > weights[$1] }) where leftover > 0 {
            dealt[at] += 1
            leftover -= 1
        }
        return dealt
    }

    /// One block over the lines it was dealt.
    private static func runs(
        of wrapped: Wrapped,
        _ ink: FeedInk,
        on band: Range<Int>,
        across measure: CGFloat,
    )
        -> [MinimapRun] {
        let block = wrapped.block
        let cursor = band.lowerBound
        let share = band.count
        switch block.kind {
        // The cells the feed draws, each stroked — never the words inside them.
        case .table:
            return cells(of: block, from: cursor, over: share, across: measure)
        // The fence's box, filled: one slab where the paragraphs around it are ragged lines.
        case .fence:
            return [MinimapRun(ink: ink, line: cursor, lines: share, span: span(0, 1))]
        case .prose:
            let bars = fills(of: block.length, over: share, measured: wrapped.lines)
                .enumerated().map { line, fill in
                    MinimapRun(ink: ink, line: cursor + line, span: span(0, fill))
                }
            return bars + links(of: block, from: cursor, over: share)
        }
    }

    /// A block's links, each on the line its offset flows to — drawn after the bars, so the accent
    /// sits over the line it is part of.
    private static func links(
        of block: MinimapProseBlock,
        from cursor: Int,
        over share: Int,
    )
        -> [MinimapRun] {
        guard !block.links.isEmpty, share > 0 else { return [] }
        let perLine = max(1, Int((Double(max(0, block.length)) / Double(share)).rounded(.up)))
        return block.links.compactMap { mark in
            let line = mark.offset / perLine
            guard line < share else { return nil }
            let head = CGFloat(mark.offset % perLine) / CGFloat(perLine)
            return MinimapRun(
                ink: .link,
                line: cursor + line,
                span: span(head, head + CGFloat(mark.length) / CGFloat(perLine)),
            )
        }
    }
}
