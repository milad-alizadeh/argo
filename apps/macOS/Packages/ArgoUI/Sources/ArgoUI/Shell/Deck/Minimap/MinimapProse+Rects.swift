import Foundation

// A prose row laid out block by block, each block at the height it really stands.
//
// This is the file that replaces the old proportional deal. The lane used to divide the row's line
// count between its blocks by weight, so a table's frame sat about where the table was — "about"
// being the whole complaint. A block now reports its own height and the next block starts under it,
// which is what `FeedMarkdown`'s own `VStack` does with the same step between them.

extension MinimapProseBlock {
    /// The rects a row's blocks make, in the row's own coordinates.
    @MainActor static func rects(
        of blocks: [MinimapProseBlock],
        ink: FeedInk,
        across measure: CGFloat,
    )
        -> [MinimapRowRect] {
        var rects: [MinimapRowRect] = []
        var y: CGFloat = 0
        for block in blocks {
            let laid = block.laid(ink: ink, across: measure)
            rects += laid.rects.map { $0.lowered(by: y) }
            y += laid.height + ArgoFeedRow.blockStep
        }
        return rects
    }

    /// One block's rects in its OWN coordinates, and how tall it stands.
    @MainActor func laid(
        ink: FeedInk,
        across measure: CGFloat,
    )
        -> (rects: [MinimapRowRect], height: CGFloat) {
        switch self {
        case let .prose(words):
            words.laid(ink: ink, across: measure)
        case let .fence(lines, hasInfo):
            Self.fence(lines: lines, hasInfo: hasInfo, ink: ink, across: measure)
        case let .table(table):
            table.laid(across: measure)
        case let .diagram(diagram):
            diagram.mapped(across: measure)
        }
    }

    /// A fence: one slab where the paragraphs around it are ragged lines, which is what the feed
    /// draws — a raised ground with the code on it. Its declared language is a label above that
    /// ground.
    @MainActor private static func fence(
        lines: Int,
        hasInfo: Bool,
        ink: FeedInk,
        across measure: CGFloat,
    )
        -> (rects: [MinimapRowRect], height: CGFloat) {
        // The face the label is DRAWN in, weight included: `FeedMarkdownFence` sets it at
        // `ArgoTypography.sectionLabel`, which is semibold, and a weight changes the box its line
        // stands in — see `ProseLineBox`.
        let label = hasInfo
            ? ProseFace(rung: ArgoTypography.sectionLabel.rung, isBold: true).lineBox
            + ArgoSpacing.tight
            : 0
        let height = ArgoSpacing.base * 2 + label + ProseFace.machine.height(ofLines: lines)
        return (
            [MinimapRowRect(y: 0, height: height, from: 0, to: measure, ink: ink)],
            height,
        )
    }
}

extension MinimapProseWords {
    /// A run of words at the widths they wrapped to, and the links inside it where they landed.
    @MainActor func laid(ink: FeedInk, across measure: CGFloat)
        -> (rects: [MinimapRowRect], height: CGFloat) {
        let column = max(0, measure - indent)
        let lay = ProseMetrics.lay(out: text, across: column, in: face)
        let lines = lay.widths.enumerated().map { at, width in
            MinimapRowRect.line(at, width: width, in: face, ink: ink)
                .indented(by: indent)
        }
        return (
            marker(ink: ink) + lines + links(of: lay),
            face.height(ofLines: lay.lines),
        )
    }

    /// The links, drawn after the lines so the accent sits over the words it is part of. They take
    /// no ink from the caller: a link is the accent whatever the prose around it is set in.
    @MainActor private func links(of lay: ProseLay) -> [MinimapRowRect] {
        lay.links.map { place in
            MinimapRowRect(
                y: face.y(ofLine: place.line),
                height: face.lineBox,
                from: indent + place.from,
                to: indent + place.to,
                ink: .link,
            )
        }
    }

    /// A list item's marker, trailing-aligned in its own column exactly as `FeedMarkdown` sets it.
    @MainActor private func marker(ink: FeedInk) -> [MinimapRowRect] {
        guard let marker else { return [] }
        let width = min(ArgoFeedRow.markerWidth, ProseMetrics.width(of: marker, in: face))
        return [MinimapRowRect(
            y: 0,
            height: face.lineBox,
            from: ArgoFeedRow.markerWidth - width,
            to: ArgoFeedRow.markerWidth,
            ink: ink,
        )]
    }
}
