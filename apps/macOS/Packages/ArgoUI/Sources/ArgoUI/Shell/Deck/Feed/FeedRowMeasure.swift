import AppKit
import ArgoDesign
import ProseText

/// What a PROSE row stands at, typeset rather than laid out.
///
/// A height off a hosting ruler is a full SwiftUI layout pass, and the minimap needs one for EVERY
/// row of the document rather than for the ones on screen — so a 4 000-row reading paid 4 000
/// layout
/// passes before it settled (#856). The count cannot come down; this brings the cost down instead,
/// by asking Core Text, which is where the glyphs come from either way. Recorded at 2.9× cheaper a
/// row, and what is left of a prose measure is the markdown read the drawn cell pays anyway
/// (`FeedTypesetCostTests`).
///
/// It is not a second model of the row. `ProseReading.structure(of:)` is the block list the
/// overview
/// lane already lays out, and `MinimapProseBlock.laid` is the height it already reports — both held
/// against what SwiftUI draws by `MinimapBlockHeightTests`. What is added here is the two things a
/// ROW has that a block does not: the whole point each block's baselines land on, and the Turn's
/// copy chip.
///
/// It answers for every prose row and declines nothing (ADR-0030, Rule 1): a table and a diagram
/// size THEMSELVES, so each is taken at the height its own layout gives it rather than rounded like
/// a line of glyphs. `FeedTypesetHeightTests` holds the total against the ruler at zero tolerance.
@MainActor
enum FeedRowMeasure {
    /// The column a row's own words wrap across, at a table this wide — `argoFeedMeasure`'s cap and
    /// the row's gutters, which is the pair `FeedTableModel.content(at:)` applies in that order.
    static func measure(atWidth width: CGFloat) -> CGFloat {
        max(0, min(width, ArgoFeedRow.column) - ArgoFeedRow.inset * 2)
    }

    /// What a block of the agent's own words stands at.
    ///
    /// `chip` rather than the offer itself: the height a chip takes is the same whatever it hands
    /// over, and resolving the words is a walk over the row's whole Turn.
    static func height(ofProse words: String, chip: Bool, across measure: CGFloat) -> CGFloat {
        guard measure > 0 else { return 0 }
        var total = chip ? chipHeight : 0
        // The two readings of one string, side by side: the lane's blocks carry the heights, and
        // the markdown blocks carry the one thing the reduction drops — whether a fence holds
        // anything. They are built one-for-one from each other (`MinimapProseBlock.blocks(from:)`);
        // the walk is over the LAID blocks and the read one is looked up beside it, so a pairing
        // that ever came apart would lose the empty-fence correction rather than the rest of the
        // row.
        let read = ProseReading.blocks(in: words)
        for (at, block) in ProseReading.structure(of: words).enumerated() {
            let beside = read.indices.contains(at) ? read[at] : nil
            total += standing(Read(laid: block, read: beside), across: measure)
                + (at > 0 ? ArgoFeedRow.blockStep : 0)
        }
        return total
    }

    /// One block at the height SwiftUI draws it.
    ///
    /// Glyphs are rounded UP to a whole point, because `Text` sizes itself to whole points per run:
    /// a `VStack` of three blocks pays three roundings rather than one over the sum. A table and a
    /// diagram are not glyphs — each states its own size through its own layout — so neither is
    /// rounded here.
    ///
    /// The ink is the lane's argument and not a height's — passed at the one it is drawn nowhere
    /// in.
    private static func standing(_ block: Read, across measure: CGFloat) -> CGFloat {
        let laid = { ceil(block.laid.laid(ink: .message, across: measure).height) }
        return switch block.laid {
        case .table, .diagram: block.laid.laid(ink: .message, across: measure).height
        case .prose: laid()
        case let .fence(_, hasInfo):
            block.read.flatMap(emptyFence).map { fence(hasInfo: hasInfo, over: $0) } ?? laid()
        }
    }

    /// One block under both readings of it — see `height(ofProse:chip:across:)`. The read one is
    /// absent where the two lists came apart, which nothing has ever seen them do.
    private struct Read {
        let laid: MinimapProseBlock
        let read: MarkdownBlock?
    }

    /// The one construct the lane's own height is wrong about: a fence with an EMPTY body, whose
    /// `Text("")` collapses onto the platform's own empty box where a fence holding one character
    /// stands at the body style's — four points, which is four points of overlap with the row
    /// below.
    ///
    /// `nil` for every fence that holds something, which is the ordinary case.
    private static func emptyFence(_ block: MarkdownBlock) -> CGFloat? {
        guard case let .fenced(code, _) = block, code.isEmpty else { return nil }
        return ProseLineBox.ofEmptyRun(.machine)
    }

    /// A fence: its ground's own padding, the language label above the code where the agent named
    /// one, and the code itself — `FeedMarkdownFence`.
    private static func fence(hasInfo: Bool, over code: CGFloat) -> CGFloat {
        let label = ProseFace(rung: ArgoTypography.sectionLabel.rung, isBold: true)
        return ArgoSpacing.base * 2
            + (hasInfo ? label.lineBox + ArgoSpacing.tight : 0)
            + ceil(code)
    }

    /// The offer under a Turn's last message: the chip's own square, the step above it, and the
    /// stack's spacing — the three `FeedProseCopy` puts between the words and it.
    private static var chipHeight: CGFloat {
        ArgoSpacing.flush + ArgoFeedRow.copyChipStep + ArgoFeedRow.copyChipSide
    }
}
