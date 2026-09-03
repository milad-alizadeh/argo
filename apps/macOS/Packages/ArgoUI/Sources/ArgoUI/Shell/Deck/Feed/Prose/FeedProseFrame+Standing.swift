import ArgoDesign
import CoreGraphics
import ProseText

// What one block of a prose row stands at. Every number here was `FeedRowMeasure`'s; it moved
// beside the placement so the height a block is given and the frame it is drawn in come out of one
// walk (ADR-0030, Rule 2).

extension FeedProseFrame {
    /// One block that lays ITSELF out, at the height it is drawn. Words never reach here — those
    /// are counted off the very run the surface inks, in `FeedProseFrame.drawn(_:read:across:)`.
    ///
    /// A fence is glyphs on a ground and rounds up to a whole point like any other run. A table and
    /// a diagram are not glyphs — each states its own size through its own layout — so neither is
    /// rounded here.
    static func standing(
        _ block: MinimapProseBlock,
        read: MarkdownBlock?,
        across measure: CGFloat,
    )
        -> CGFloat {
        switch block {
        case let .fence(lines, hasInfo):
            read.flatMap(emptyFence).map { fence(hasInfo: hasInfo, over: ceil($0)) }
                ?? ceil(fence(hasInfo: hasInfo, over: ProseFace.machine.height(ofLines: lines)))
        case let .table(table):
            table.laid(across: measure).height
        case let .diagram(diagram):
            diagram.mapped(across: measure).height
        // Words, which the caller answered for off the run it built. No formula here could be
        // anything but a second model of the same wrap.
        case .prose:
            0
        }
    }

    /// The one construct the block list's own height is wrong about: a fence with an EMPTY body,
    /// whose empty run collapses onto the platform's own empty box where a fence holding one
    /// character stands at the body style's — four points, which is four points of overlap with the
    /// row below.
    ///
    /// `nil` for every fence that holds something, which is the ordinary case.
    private static func emptyFence(_ block: MarkdownBlock) -> CGFloat? {
        guard case let .fenced(code, _) = block, code.isEmpty else { return nil }
        return ProseLineBox.ofEmptyRun(.machine)
    }

    /// A fence: its ground's own padding, the language label above the code where the agent named
    /// one, and the code itself — `FeedMarkdownFence`. The code's own rounding is the caller's, so
    /// the empty body's measured box and a real body's line count round in the places they always
    /// did.
    private static func fence(hasInfo: Bool, over code: CGFloat) -> CGFloat {
        let label = ProseFace(rung: ArgoTypography.sectionLabel.rung, isBold: true)
        return ArgoSpacing.base * 2
            + (hasInfo ? label.lineBox + ArgoSpacing.tight : 0)
            + code
    }
}
