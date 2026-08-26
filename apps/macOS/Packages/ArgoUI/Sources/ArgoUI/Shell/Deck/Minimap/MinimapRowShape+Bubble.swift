import Foundation

// A prompt as the lane draws it: whatever was pasted in, above the words, inside a bubble held
// against the trailing edge — the shape `FeedPrompt` draws.
//
// The bubble's ground is as wide as its widest thing, so nothing here can be answered a line at a
// time — every line's width and the pictures' own width have to be known before the first one can
// be placed.

extension MinimapRowShape {
    /// A prompt's pictures and lines, in the row's own coordinates.
    @MainActor static func bubble(
        _ text: String,
        shots: Int,
        isFolded: Bool,
        across measure: CGFloat,
    )
        -> [MinimapRowRect] {
        let inside = measure * ArgoFeedRow.bubbleShare - ArgoFeedRow.bubbleInsetX * 2
        guard inside > 0 else { return [] }
        let lay = ProseMetrics.lay(out: text, across: inside)
        let pictures = shots > 0 ? Self.shots(shots, across: inside) : []
        // Where the words start: the bubble hugs a short prompt, so its leading edge is its own
        // widest thing back from the trailing one rather than the ceiling it may grow to.
        let widest = max(lay.widths.max() ?? 0, pictures.map(\.to).max() ?? 0)
        guard widest > 0 else { return [] }
        let head = measure - widest - ArgoFeedRow.bubbleInsetX
        // The pictures ride the bubble's TRAILING edge, the way the row stacks them: a prompt whose
        // words run wider than its thumbnails would otherwise report them on the wrong side.
        let aside = widest - (pictures.map(\.to).max() ?? 0)
        return (pictures.map { $0.indented(by: aside) }
            + lines(lay, isFolded: isFolded, under: pictures))
            .map { $0.indented(by: head).lowered(by: ArgoFeedRow.bubbleInsetY) }
    }

    /// The words, below whatever the pictures took.
    ///
    /// A folded prompt draws only its first few lines, and the reader decides which it is.
    /// Reporting all of them drew a prompt of four lines where the feed showed two, which is what
    /// #382's second pass answered — and capping an UNFOLDED one is the same mistake back.
    @MainActor private static func lines(
        _ lay: ProseLay,
        isFolded: Bool,
        under pictures: [MinimapRowRect],
    )
        -> [MinimapRowRect] {
        // What the gallery took, its own trailing breath included: `FeedGalleryRow` pads both ends.
        let taken = pictures.isEmpty
            ? 0
            : (pictures.map { $0.y + $0.height }.max() ?? 0) + ArgoFeedRow.shotBreath
        let shown = isFolded ? ArgoFeedRow.collapsedPromptLines : lay.widths.count
        return lay.widths.prefix(shown).enumerated().map { at, width in
            MinimapRowRect.line(at, width: width, in: .body, ink: .prompt).lowered(by: taken)
        }
    }
}
