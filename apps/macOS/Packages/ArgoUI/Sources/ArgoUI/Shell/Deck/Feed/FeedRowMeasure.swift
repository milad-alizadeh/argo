import AppKit

/// What a PROSE row stands at, typeset rather than laid out.
///
/// A height off the hosting ruler is a full SwiftUI layout pass, and the minimap needs one for
/// EVERY row of the document rather than for the ones on screen — so a 4 000-row reading paid
/// 4 000 layout passes before it settled (#856). The count cannot come down; this brings the cost
/// down instead, by asking Core Text, which is where the glyphs come from either way. Recorded at
/// 2.9× cheaper a row, and what is left of a prose measure is the markdown read the drawn cell
/// pays anyway (`FeedTypesetCostTests`).
///
/// It is not a second model of the row. `ProseReading.structure(of:)` is the block list the
/// overview lane already lays out, and `MinimapProseBlock.laid` is the height it already reports —
/// both held against what SwiftUI draws by `MinimapBlockHeightTests`. What is added here is the
/// two things a ROW has that a block does not: the whole point each block's baselines land on, and
/// the Turn's copy chip. `FeedTypesetHeightTests` holds the total against the ruler at zero
/// tolerance.
///
/// Everything else stays on the ruler. A prompt is a bubble, a call is a sentence in three columns,
/// a gallery is a grid of plates: their chrome is not glyphs, so Core Text has no answer to give
/// and a guess would overlap rows. Two markdown blocks stay for the same reason — a table and a
/// diagram size THEMSELVES, so their height is not a wrap.
@MainActor
enum FeedRowMeasure {
    /// The column a row's own words wrap across, at a table this wide — `argoFeedMeasure`'s cap and
    /// the row's gutters, which is the pair `FeedTableModel.content(at:)` applies in that order.
    static func measure(atWidth width: CGFloat) -> CGFloat {
        max(0, min(width, ArgoFeedRow.column) - ArgoFeedRow.inset * 2)
    }

    /// What the row's content stands at, or `nil` where Core Text cannot answer for its shape —
    /// which is the caller's cue to measure it for real.
    ///
    /// `chip` rather than the offer itself: the height a chip takes is the same whatever it hands
    /// over, and resolving the words is a walk over the row's whole Turn.
    static func height(of content: FeedRow.Content, chip: Bool, across measure: CGFloat)
        -> CGFloat? {
        guard measure > 0, let words = prose(of: content), isTypeset(words) else { return nil }
        var total = chip ? chipHeight : 0
        for (at, block) in ProseReading.structure(of: words).enumerated() {
            guard let standing = standing(block, across: measure) else { return nil }
            total += standing + (at > 0 ? ArgoFeedRow.blockStep : 0)
        }
        return total
    }

    /// The two kinds whose whole row is a `FeedMarkdown` and nothing else — see `FeedRowView.body`.
    /// A message and a thought differ only in ink, which no height depends on.
    private static func prose(of content: FeedRow.Content) -> String? {
        switch content {
        case let .message(text): text
        case let .thought(text): text
        case .prompt, .call, .survey, .gallery, .skillLoaded, .ask, .mark, .unreadable: nil
        }
    }

    /// Whether these words hold nothing Core Text has to decline. One construct does: a fence with
    /// an EMPTY body, whose `Text("")` collapses onto the mono's own line box where a fence holding
    /// one character stands at the body style's — four points of overlap if it is measured as a
    /// line, and a blank line anywhere else inside a fence is a real line and measures as one.
    private static func isTypeset(_ words: String) -> Bool {
        !ProseReading.blocks(in: words).contains { block in
            guard case let .fenced(code, _) = block else { return false }
            return code.isEmpty
        }
    }

    /// One block at the height SwiftUI draws it, which is the lane's own height rounded UP to a
    /// whole point: `Text` sizes itself to whole points per run, so a `VStack` of three blocks pays
    /// three roundings rather than one over the sum.
    ///
    /// The ink is the lane's argument and not a height's — passed at the one it is drawn nowhere
    /// in.
    private static func standing(_ block: MinimapProseBlock, across measure: CGFloat) -> CGFloat? {
        switch block {
        case .prose, .fence: ceil(block.laid(ink: .message, across: measure).height)
        case .table, .diagram: nil
        }
    }

    /// The offer under a Turn's last message: the chip's own square, the step above it, and the
    /// stack's spacing — the three `FeedProseCopy` puts between the words and it.
    private static var chipHeight: CGFloat {
        ArgoSpacing.flush + ArgoFeedRow.copyChipStep + ArgoFeedRow.copyChipSide
    }
}
