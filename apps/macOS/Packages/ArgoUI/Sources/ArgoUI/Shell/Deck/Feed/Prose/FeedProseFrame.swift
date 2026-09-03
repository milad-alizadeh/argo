import ArgoDesign
import CoreGraphics
import ProseText

/// One prose row typeset WHOLE: every block at the height it stands and the offset it is drawn at,
/// and the row's own height as the sum of them.
///
/// The seam ADR-0030 Rule 2 asks for. The height the table sets a cell to and the frame the surface
/// inks are the same value, produced by one walk over one typeset — so a row cannot be measured a
/// point short of what it draws, and no test has to police the difference.
///
/// Built once per distinct row and kept, because a view body is evaluated far more often than its
/// text changes — see `ProseReading.frame(of:chip:across:)`.
struct FeedProseFrame {
    /// The blocks, in the order they are drawn.
    var parts: [Placed] = []
    /// How tall the blocks stand together. The row's own height adds room for the Turn's copy chip
    /// where it draws one, which is `FeedRowMeasure`'s to add: the chip is drawn OUTSIDE the
    /// surface, by the modifier that offers it.
    var height: CGFloat = 0

    /// One block and where it goes, in the row's own coordinates — top-left origin, which is the
    /// space the surface draws in and hit-tests in.
    struct Placed {
        var part: FeedProsePart
        var rect: CGRect
    }
}

/// What one block of a prose row is drawn as.
enum FeedProsePart {
    /// Words that wrap — a paragraph, a heading, one item of a list — as the very lines the measure
    /// counted them into, with the marker in its own column beside them and the indent that keeps a
    /// wrapped item inside its own words.
    case words(run: ProseRun, marker: ProseRun?, indent: CGFloat)
    /// A block that lays ITSELF out: a fence's ground, a pipe table, a diagram. Drawn by the view
    /// that already draws it, hosted at the frame the measure gave it.
    case laid(MarkdownBlock)
}

extension FeedProseFrame {
    /// The blocks of `text` placed across `measure`.
    ///
    /// The two readings of one string, side by side: the lane's blocks carry the heights, and the
    /// markdown blocks carry what the reduction drops — the fence's own characters, the table, the
    /// diagram. They are built one-for-one from each other (`MinimapProseBlock.blocks(from:)`); the
    /// walk is over the LAID blocks and the read one is looked up beside it, so a pairing that ever
    /// came apart would lose one block rather than the rest of the row.
    static func of(text: String, across measure: CGFloat) -> FeedProseFrame {
        guard measure > 0 else { return FeedProseFrame() }
        var frame = FeedProseFrame()
        var y: CGFloat = 0
        let read = ProseReading.blocks(in: text)
        for (at, block) in ProseReading.structure(of: text).enumerated() {
            let beside = read.indices.contains(at) ? read[at] : nil
            y += at > 0 ? ArgoFeedRow.blockStep : 0
            let drawn = drawn(block, read: beside, across: measure)
            if let part = drawn.part {
                frame.parts.append(Placed(
                    part: part,
                    rect: CGRect(x: 0, y: y, width: measure, height: drawn.height),
                ))
            }
            y += drawn.height
        }
        frame.height = y
        return frame
    }

    /// The offer under a Turn's last message: the chip's own square, the step above it, and the
    /// stack's spacing — the three `FeedProseCopy` puts between the words and it.
    static var chipHeight: CGFloat {
        ArgoSpacing.flush + ArgoFeedRow.copyChipStep + ArgoFeedRow.copyChipSide
    }

    /// One block as the thing that draws it, and the height it stands at — ONE answer, because the
    /// two are the same fact about the same typeset. A part is `nil` where the two readings came
    /// apart on a block that draws itself: nothing has ever seen them do it, and a missing part
    /// leaves a gap rather than moving every block under it.
    private static func drawn(
        _ block: MinimapProseBlock,
        read: MarkdownBlock?,
        across measure: CGFloat,
    )
        -> (part: FeedProsePart?, height: CGFloat) {
        guard case let .prose(words) = block else {
            return (read.map { .laid($0) }, standing(block, read: read, across: measure))
        }
        let indent = words.indent
        let run = ProseMetrics.run(
            of: words.text, across: max(0, measure - indent), in: words.face,
        )
        let part = FeedProsePart.words(
            run: run,
            // Tabular figures, as `FeedMarker` sets them: a marker that re-measures per digit
            // moves the words beside it.
            marker: words.marker.map {
                ProseMetrics.run(of: $0, across: ArgoFeedRow.markerWidth, in: words.face.tabular)
            },
            indent: indent,
        )
        // Rounded UP to a whole point, because a run of glyphs sizes itself to whole points: a
        // stack of three blocks pays three roundings rather than one over the sum.
        return (part, ceil(words.face.height(ofLines: run.lines.count)))
    }
}
