import AppKit

/// The face a run of the feed's words is set in, and the rhythm it is set at.
///
/// One type for both halves on purpose. Anything asking how wide words run has to ask how tall
/// their lines stand in the same breath, and the two answers have to come from the same font — a
/// heading measured in the body face reports a paragraph's width at a heading's height.
struct ProseFace: Hashable, Sendable {
    var rung: ArgoTypeScale = ArgoFeedRow.proseRung
    /// The heavier weight a heading and a table's header both take. Wider at every rung.
    var isBold = false
    /// Set in the mono: a command, a count, a patch. Wider per character than the interface sans.
    var isMachine = false

    static let body = ProseFace()
    /// A table's header cells.
    static let header = ProseFace(isBold: true)
    /// A count or a path on a call's line.
    static let machine = ProseFace(isMachine: true)

    /// A heading's face. Three rungs for six levels, as `FeedMarkdown` draws them — the deepest is
    /// the paragraph's own size at the heavier weight, never smaller than the prose under it.
    static func heading(level: Int) -> ProseFace {
        switch level {
        case 1: ProseFace(rung: .title1, isBold: true)
        case 2: ProseFace(rung: .title2, isBold: true)
        default: ProseFace(rung: .title3, isBold: true)
        }
    }
}

extension ProseFace {
    /// The font itself. AppKit's own preferred font for the rung, so this and the `Text` on screen
    /// read one table — see `ArgoTypeScale+AppKit`.
    @MainActor var font: NSFont {
        let base = isMachine
            ? NSFont.monospacedSystemFont(ofSize: rung.size, weight: .regular)
            : NSFont.preferredFont(forTextStyle: rung.appKitStyle)
        guard isBold else { return base }
        return NSFontManager.shared.convert(base, toHaveTrait: .boldFontMask)
    }

    /// This same face in the mono, which is what a `code` span inside it is set in.
    var monospaced: ProseFace {
        ProseFace(rung: rung, isBold: isBold, isMachine: true)
    }

    /// How tall one line's own box is, before any leading is added to it.
    ///
    /// The FONT's own, not the contract's `naturalLineHeightRatio`. That ratio exists so
    /// `lineSpacing` can be worked out for a stated rhythm, and at the body rung it reports 15.73
    /// where TextKit sets the line at 17.31 — a point and a half a line, which over a long message
    /// put the foot of the lane's block a dozen points above the foot of the row's.
    ///
    /// Read off the rung's own face even for the mono, because that is what SwiftUI does:
    /// `.system(.body, design: .monospaced)` is the BODY text style in another design, so it keeps
    /// the body's line height and only its advances change.
    @MainActor var lineBox: CGFloat {
        let font = ProseFace(rung: rung, isBold: isBold).font
        return font.ascender - font.descender
    }

    /// From one line's top to the next line's top.
    @MainActor var step: CGFloat {
        lineBox + leading
    }

    /// Where a line's box starts, counted down from the run's top.
    @MainActor func y(ofLine line: Int) -> CGFloat {
        CGFloat(max(0, line)) * step
    }

    /// How tall `lines` of this face stand together.
    ///
    /// `n` boxes and `n − 1` gaps, not `n` of each: SwiftUI's `lineSpacing` is the leading BETWEEN
    /// lines, so a run's last line adds no trailing gap. Multiplying the step by the line count
    /// instead overstates every wrapped paragraph and every table row by one gap.
    @MainActor func height(ofLines lines: Int) -> CGFloat {
        guard lines > 0 else { return 0 }
        return CGFloat(lines) * lineBox + CGFloat(lines - 1) * leading
    }

    /// The extra leading the feed sets this face at — the machine's own for the mono, prose's
    /// otherwise, which is exactly the pair `FeedProseText` and `FeedMarkdownFence` apply.
    private var leading: CGFloat {
        isMachine ? ArgoFeedRow.machineLineSpacing : ArgoFeedRow.proseLineSpacing
    }

    /// What this face is called in a cache key.
    var key: String {
        "\(rung)\u{0}\(isBold)\u{0}\(isMachine)"
    }
}
