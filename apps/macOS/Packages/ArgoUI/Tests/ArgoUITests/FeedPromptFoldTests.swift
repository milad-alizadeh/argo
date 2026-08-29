import AppKit
@testable import ArgoUI
import SwiftUI
import Testing

/// What a prompt's bubble stands at, measured the ONE way the feed ever measures a row: a single
/// `sizeThatFits` against a detached hosting controller, exactly as `FeedTableCoordinator` does it.
///
/// That single pass is the whole suite. A bubble whose size needs a second one is a bubble the
/// table
/// caches at a height nobody ever drew — the reader sees a squashed bubble and a control clipped
/// out
/// of the row (#946) — so every claim here is checked against the first answer and never a settled
/// one.
@MainActor
@Suite("Feed prompt fold")
struct FeedPromptFoldTests {
    /// The row's own content width at the feed's widest column — what `FeedTableModel.content`
    /// leaves a row once the gutters are off it.
    private static let measure = ArgoFeedRow.column - ArgoFeedRow.inset * 2
    /// The words inside the bubble, which is the ceiling less its own insets.
    private static let inside = measure * ArgoFeedRow.bubbleShare - ArgoFeedRow.bubbleInsetX * 2

    private static let long = String(
        repeating: "Read the whole anatomy study before you start. ", count: 14,
    )
    private static let short = "Run the visual contract suite and tell me what broke."

    /// The bubble's height, asked for the way the table asks for a row's.
    private func height(of text: String, expanded: Bool) -> CGFloat {
        let ruler = NSHostingController(rootView: AnyView(EmptyView()))
        ruler.sizingOptions = []
        ruler.rootView = AnyView(
            FeedPrompt(text: text, shots: [], open: { _ in }, isExpanded: .constant(expanded))
                .frame(width: Self.measure)
                .argoAppearance(),
        )
        return ruler.sizeThatFits(
            in: NSSize(width: Self.measure, height: CGFloat.greatestFiniteMagnitude),
        ).height
    }

    /// The control's own row, measured the same way — its words at the rung it is set on, plus the
    /// step above it.
    private var control: CGFloat {
        let ruler = NSHostingController(rootView: AnyView(EmptyView()))
        ruler.sizingOptions = []
        ruler.rootView = AnyView(
            Text("Show more").argoText(ArgoTypography.caption).argoAppearance(),
        )
        return ArgoSpacing.snug + ruler.sizeThatFits(
            in: NSSize(width: Self.inside, height: CGFloat.greatestFiniteMagnitude),
        ).height
    }

    /// How tall `lines` of the feed's body stand — the arithmetic the overview lane maps a prompt
    /// with, so the bubble and its miniature cannot disagree.
    private func prose(lines: Int) -> CGFloat {
        ProseFace.body.height(ofLines: lines)
    }

    private var wholeLines: Int {
        ProseMetrics.lay(out: Self.long, across: Self.inside).lines
    }

    /// SwiftUI does not lay text out to the same sub-point on every machine, and a row height is
    /// rounded up to a whole point before the table uses it.
    private static let slack: CGFloat = 3

    @Test
    func `a long prompt folds to its first few lines, with the control under them`() {
        let expected = ArgoFeedRow.bubbleInsetY * 2
            + prose(lines: ArgoFeedRow.collapsedPromptLines) + control
        let drawn = height(of: Self.long, expanded: false)
        #expect(abs(drawn - expected) <= Self.slack)
    }

    @Test
    func `unfolding it answers with the whole prompt, at the measure the bubble is drawn across`() {
        let expected = ArgoFeedRow.bubbleInsetY * 2 + prose(lines: wholeLines) + control
        let drawn = height(of: Self.long, expanded: true)
        #expect(abs(drawn - expected) <= Self.slack)
    }

    @Test
    func `the prompt is longer than the fold, or the suite is checking nothing`() {
        let lines = wholeLines
        let fold = ArgoFeedRow.collapsedPromptLines
        #expect(lines > fold)
    }

    @Test
    func `a prompt that stands whole is the same height either way, and offers no control`() {
        let expected = ArgoFeedRow.bubbleInsetY * 2 + prose(lines: 1)
        let folded = height(of: Self.short, expanded: false)
        let unfolded = height(of: Self.short, expanded: true)
        #expect(abs(folded - expected) <= Self.slack)
        #expect(folded == unfolded)
    }
}
