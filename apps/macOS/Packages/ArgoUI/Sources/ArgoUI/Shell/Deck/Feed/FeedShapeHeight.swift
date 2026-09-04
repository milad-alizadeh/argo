import ArgoDesign
import CoreGraphics
import ProseText

/// What a row stands at, worked out from what it holds rather than laid out to find out.
///
/// The one place a height comes from. Prose is typeset by Core Text (`FeedRowMeasure`); every other
/// shape has a formula here, stated in the same tokens the view draws itself with. Nothing asks
/// SwiftUI: a height off a hosting ruler is a full layout pass, the minimap needs one for EVERY row
/// of the document, and a document whose geometry is settled before it is drawn cannot afford
/// 4 800 of them (ADR-0030).
///
/// The formulas are held against the ruler by `FeedShapeHeightTests`, which is what the ruler is
/// for now: a test oracle, driven from the named list of shapes, so a twelfth shape without a
/// formula fails the build rather than escaping the claim.
///
/// A value rather than a namespace so the pass's own two facts — how the row stands, and the
/// measure it is drawn across — are stated once instead of threaded through every arm.
struct FeedShapeHeight {
    /// The reader's state, which three shapes change shape under.
    let standing: FeedRowStanding
    /// The column the row's content is drawn across — `FeedRowMeasure.measure(atWidth:)`.
    let measure: CGFloat

    /// The row's own height, without the step above it: that is a fact about a PAIR of rows, and
    /// `FeedRow.step(to:from:)` is where it is answered.
    ///
    /// No `default`, for `FeedRow.Content.kind`'s reason: a twelfth case fails this build rather
    /// than inheriting a formula written for a shape it is not.
    func height(of content: FeedRow.Content) -> CGFloat {
        switch content {
        case let .prompt(text, shots): bubble(text: text, shots: shots)
        case let .message(text): prose(text)
        case let .thought(text): prose(text)
        case .call: pressedLine
        case let .survey(survey): folded(survey.calls.count)
        case let .work(work): folded(work.calls.count)
        case let .gallery(gallery): Self.shots(gallery.shots, across: measure)
        case .skillLoaded: chipLine
        case let .ask(ask): asked(ask)
        case let .mark(mark): marked(mark)
        case let .unreadable(unreadable): unread(unreadable)
        }
    }

    /// A block of the agent's own words, typeset. The one branch that is not a formula.
    private func prose(_ text: String) -> CGFloat {
        FeedRowMeasure.height(ofProse: text, chip: standing.drawsChip, across: measure)
    }

    /// A fold of a run of calls: its own line, and the calls it stands for listed under it while
    /// the panel is open on it. One formula over both folds — the survey's stretch of looking and
    /// the Turn's card of work are the same anatomy, and a second copy of it would drift.
    private func folded(_ calls: Int) -> CGFloat {
        guard standing.isOpen else { return pressedLine }
        return pressedLine + ArgoFeedRow.callStep + Self.stackedLines(
            calls, at: Self.bodyLine, step: ArgoSpacing.hair,
        )
    }

    /// A stretch nothing could read: its own line, and the raw text under it once it is let out.
    private func unread(_ unreadable: FeedUnreadable) -> CGFloat {
        guard standing.isUnfolded else { return pressedLine }
        let inset = ArgoFeedRow.callSymbolWidth + ArgoFeedRow.callGap
        return pressedLine + ArgoFeedRow.callStep
            + Self.unleaded(unreadable.raw, in: .machine, across: measure - inset)
    }

    /// The punctuation between Turns. The one live mark is drawn as an ion crossing the measure and
    /// stands at the body's own rhythm; every other is a rule with its words let into it, and a
    /// rule with nothing to say is the hairline alone.
    private func marked(_ mark: FeedMark) -> CGFloat {
        guard mark != .working else { return ArgoFeedRow.lineHeight }
        guard mark.handoff == nil else {
            return max(Self.captionLine, ArgoIconSize.inline.rawValue)
        }
        return mark.words == nil ? ArgoStroke.hairline : Self.captionLine
    }
}

extension FeedShapeHeight {
    /// One line of the feed's body type, as a `Text` DRAWS it: a run rounds its own box up to a
    /// whole point, and a row that stacks several of them pays a rounding each.
    static var bodyLine: CGFloat {
        ceil(ProseFace.body.lineBox)
    }

    /// The quiet machine line a mark lets into its rule. Its own face, not the sans at the same
    /// rung: the mono stands a point shorter there.
    static var captionLine: CGFloat {
        ceil(ProseFace(rung: ArgoTypography.machineCaption.rung, isMachine: true).lineBox)
    }

    /// The line a skill load's chip sets its label on — the sans, which is the taller of the two
    /// faces the chip puts side by side.
    static var chipWords: CGFloat {
        ceil(ProseFace(rung: ArgoTypography.rowMeta.rung).lineBox)
    }

    /// A row drawn as a pressable line: its words, and `FeedRowButtonStyle`'s own step above and
    /// below them.
    var pressedLine: CGFloat {
        Self.bodyLine + ArgoSpacing.hair * 2
    }

    /// A skill load's chip — one line of its own quieter rung, inside the chip's padding.
    var chipLine: CGFloat {
        Self.chipWords + ArgoSpacing.snug * 2
    }

    /// A stack of parts with one step between them, and no trailing step under the last.
    static func stacked(_ parts: [CGFloat], step: CGFloat) -> CGFloat {
        guard !parts.isEmpty else { return 0 }
        return parts.reduce(0, +) + CGFloat(parts.count - 1) * step
    }

    /// How tall `lines` of one face stand with a fixed step between them — a list of single-line
    /// rows rather than a wrapped paragraph, so every line is a whole line box.
    static func stackedLines(_ lines: Int, at box: CGFloat, step: CGFloat) -> CGFloat {
        guard lines > 0 else { return 0 }
        return CGFloat(lines) * box + CGFloat(lines - 1) * step
    }
}
