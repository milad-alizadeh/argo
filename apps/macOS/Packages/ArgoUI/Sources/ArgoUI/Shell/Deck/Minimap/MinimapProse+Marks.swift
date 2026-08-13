import Foundation

// A prose row laid out block by block, each block at the height it really stands.
//
// This is the file that replaces the old proportional deal. The lane used to divide the row's line
// count between its blocks by weight, so a table's frame sat about where the table was — "about"
// being the whole complaint. A block now reports its own height and the next block starts under it,
// which is what `FeedMarkdown`'s own `VStack` does with the same step between them.

extension MinimapProseBlock {
    /// The marks a row's blocks make, in the row's own coordinates.
    @MainActor static func marks(
        of blocks: [MinimapProseBlock],
        ink: FeedInk,
        across measure: CGFloat,
    )
        -> [MinimapRowMark] {
        var marks: [MinimapRowMark] = []
        var y: CGFloat = 0
        for block in blocks {
            let laid = block.laid(ink: ink, across: measure)
            marks += laid.marks.map { $0.lowered(by: y) }
            y += laid.height + ArgoFeedRow.blockStep
        }
        return marks
    }

    /// One block's marks in its OWN coordinates, and how tall it stands.
    @MainActor func laid(
        ink: FeedInk,
        across measure: CGFloat,
    )
        -> (marks: [MinimapRowMark], height: CGFloat) {
        switch self {
        case let .prose(words):
            words.laid(ink: ink, across: measure)
        case let .fence(lines, hasInfo):
            Self.fence(lines: lines, hasInfo: hasInfo, ink: ink, across: measure)
        case let .table(table):
            table.laid(across: measure)
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
        -> (marks: [MinimapRowMark], height: CGFloat) {
        let label = hasInfo
            ? ProseFace(rung: ArgoTypography.sectionLabel.rung).lineBox + ArgoSpacing.tight
            : 0
        let height = ArgoSpacing.base * 2 + label + ProseFace.machine.height(ofLines: lines)
        return (
            [MinimapRowMark(y: 0, height: height, from: 0, to: measure, ink: ink)],
            height,
        )
    }
}

extension MinimapProseWords {
    /// A run of words at the widths they wrapped to, and the links inside it where they landed.
    @MainActor func laid(ink: FeedInk, across measure: CGFloat)
        -> (marks: [MinimapRowMark], height: CGFloat) {
        let column = max(0, measure - indent)
        let lay = ProseMetrics.lay(out: text, across: column, in: face)
        let lines = lay.widths.enumerated().map { at, width in
            MinimapRowMark.line(at, width: width, in: face, ink: ink)
                .indented(by: indent)
        }
        return (
            marker(ink: ink) + lines + links(of: lay),
            face.height(ofLines: lay.lines),
        )
    }

    /// The links, drawn after the lines so the accent sits over the words it is part of. They take
    /// no ink from the caller: a link is the accent whatever the prose around it is set in.
    @MainActor private func links(of lay: ProseLay) -> [MinimapRowMark] {
        lay.links.map { place in
            MinimapRowMark(
                y: face.y(ofLine: place.line),
                height: face.lineBox,
                from: indent + place.from,
                to: indent + place.to,
                ink: .link,
            )
        }
    }

    /// A list item's marker, trailing-aligned in its own column exactly as `FeedMarkdown` sets it.
    @MainActor private func marker(ink: FeedInk) -> [MinimapRowMark] {
        guard let marker else { return [] }
        let width = min(ArgoFeedRow.markerWidth, ProseMetrics.width(of: marker, in: face))
        return [MinimapRowMark(
            y: 0,
            height: face.lineBox,
            from: ArgoFeedRow.markerWidth - width,
            to: ArgoFeedRow.markerWidth,
            ink: ink,
        )]
    }
}
