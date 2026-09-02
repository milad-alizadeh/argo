import AppKit
import ArgoDesign

/// The face a run of the feed's words is set in, and the rhythm it is set at.
///
/// One type for both halves on purpose. Anything asking how wide words run has to ask how tall
/// their lines stand in the same breath, and the two answers have to come from the same font — a
/// heading measured in the body face reports a paragraph's width at a heading's height.
public struct ProseFace: Hashable, Sendable {
    public var rung: ArgoTypeScale = ProseRhythm.proseRung
    /// The heavier weight a heading and a table's header both take. Wider at every rung.
    public var isBold = false
    /// Set in the mono: a command, a count, a patch. Wider per character than the interface sans.
    public var isMachine = false

    /// Spelled out because the memberwise one a struct synthesises is internal, and every face in
    /// the feed and in a diagram is built through it.
    public init(
        rung: ArgoTypeScale = ProseRhythm.proseRung,
        isBold: Bool = false,
        isMachine: Bool = false,
    ) {
        self.rung = rung
        self.isBold = isBold
        self.isMachine = isMachine
    }

    public static let body = ProseFace()
    /// A table's header cells.
    public static let header = ProseFace(isBold: true)
    /// A count or a path on a call's line.
    public static let machine = ProseFace(isMachine: true)

    /// A heading's face. Three rungs for six levels, as `FeedMarkdown` draws them — the deepest is
    /// the paragraph's own size at the heavier weight, never smaller than the prose under it.
    public static func heading(level: Int) -> ProseFace {
        switch level {
        case 1: ProseFace(rung: .title1, isBold: true)
        case 2: ProseFace(rung: .title2, isBold: true)
        default: ProseFace(rung: .title3, isBold: true)
        }
    }
}

public extension ProseFace {
    /// The font itself. AppKit's own preferred font for the rung, so this and the `Text` on screen
    /// read one table — see `ArgoTypeScale+AppKit`.
    ///
    /// The mono is built at the SANS' RESOLVED size, never at `rung.size`: that is the HIG's
    /// documented number, which stands still while the platform's own moves with the Accessibility
    /// text setting — see `ArgoTypeScale.drawnLineBox`.
    @MainActor var font: NSFont {
        let sans = NSFont.preferredFont(forTextStyle: rung.appKitStyle)
        let base = isMachine
            ? NSFont.monospacedSystemFont(ofSize: sans.pointSize, weight: .regular)
            : sans
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
        ProseLineBox.of(self)
    }

    /// From one line's top to the next line's top. The same under either engine, and off the
    /// FRACTIONAL box: a snapping engine rounds the BOX its lines stand in, not the distance
    /// between two of them. Measured: a body block of eight lines draws at 154 where snapped
    /// advances would put it at 156, and a `## heading` of one line draws at its rounded box
    /// rather than at its box plus its leading.
    @MainActor var step: CGFloat {
        lineBox(under: .fractional) + leading
    }

    /// Where a line's box starts, counted down from the run's top.
    @MainActor func y(ofLine line: Int) -> CGFloat {
        CGFloat(max(0, line)) * step
    }

    /// How tall `lines` of this face stand together.
    ///
    /// One box and `n − 1` advances, not `n` of each: SwiftUI's `lineSpacing` is the leading
    /// BETWEEN lines, so a run's last line adds no trailing gap. Multiplying the step by the line
    /// count instead overstates every wrapped paragraph and every table row by one gap.
    @MainActor func height(ofLines lines: Int) -> CGFloat {
        guard lines > 0 else { return 0 }
        return lineBox + CGFloat(lines - 1) * step
    }

    /// The candidate box under a NAMED rule — what `ProseLineBox` chooses between, and what makes
    /// the rule this machine is NOT drawing through testable at all.
    @MainActor func lineBox(under engine: ProseEngine) -> CGFloat {
        let font = ProseFace(rung: rung, isBold: isBold).font
        switch engine {
        case .fractional: return font.ascender - font.descender
        // Out at BOTH ends: an ascent and a descent are measured from the baseline in opposite
        // directions, so a box that holds them both rounds each away from it.
        case .wholePoint: return ceil(font.ascender) - floor(font.descender)
        }
    }

    @MainActor func height(ofLines lines: Int, under engine: ProseEngine) -> CGFloat {
        guard lines > 0 else { return 0 }
        return lineBox(under: engine) + CGFloat(lines - 1) * step
    }

    /// The extra leading the feed sets this face at — the machine's own for the mono, prose's
    /// otherwise, which is exactly the pair `FeedProseText` and `FeedMarkdownFence` apply, and so
    /// the one `ProseLineBox` sets its own probe at.
    @MainActor var leading: CGFloat {
        isMachine ? ProseRhythm.machineLineSpacing : ProseRhythm.proseLineSpacing
    }

    /// What this face is called in a cache key.
    ///
    /// No resolved size in it, deliberately: the size is one number for every face, and a store
    /// that drops what it holds when that number moves is cheaper than a key that carries it — see
    /// `ProseTextSize` and `ProseMetrics.atCurrentSize()` (#1027).
    var key: String {
        "\(rung)\u{0}\(isBold)\u{0}\(isMachine)"
    }
}
