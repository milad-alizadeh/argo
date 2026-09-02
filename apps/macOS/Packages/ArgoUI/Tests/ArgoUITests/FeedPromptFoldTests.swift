import ArgoDesign
@testable import ArgoUI
import SwiftUI
import Testing

/// What a prompt's bubble stands at, asked the ONE way the feed ever asks: a single `sizeThatFits`
/// against a detached hosting controller, which is the mechanism of
/// `FeedTableCoordinator.measuredHeight`.
///
/// That single pass is the whole suite. A bubble whose size needs a second one is a bubble the
/// table caches at a height nobody ever drew — a squashed bubble, and a control clipped out of the
/// row (#946). So the claims below are checked against the first answer and never a settled one,
/// and the last of them asks the real coordinator rather than the mechanism.
@MainActor
@Suite("Feed prompt fold")
struct FeedPromptFoldTests {
    /// The row's own content width at the feed's widest column — what `FeedTableModel.content`
    /// leaves a row once the gutters are off it.
    private static let measure = ArgoFeedRow.column - ArgoFeedRow.inset * 2
    /// The words inside the bubble, which is the ceiling less its own insets.
    private static let inside = ArgoFeedRow.bubbleInside(of: measure)

    private static let long = String(
        repeating: "Read the whole anatomy study before you start. ", count: 14,
    )
    private static let short = "Run the visual contract suite and tell me what broke."
    private static let shots = Array(FeedProjection.previewShots.prefix(1))

    /// The bubble's height, asked for the way the table asks for a row's.
    private func height(of text: String, expanded: Bool, shots: [FeedShot] = []) -> CGFloat {
        let ruler = NSHostingController(rootView: AnyView(EmptyView()))
        ruler.sizingOptions = []
        ruler.rootView = AnyView(
            FeedPrompt(text: text, shots: shots, open: { _ in }, isExpanded: .constant(expanded))
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

    /// The gallery's own height inside the bubble, measured rather than assumed — a picture case
    /// asserted against a bound loose enough to hold a control row would pass with one drawn.
    private var gallery: CGFloat {
        let ruler = NSHostingController(rootView: AnyView(EmptyView()))
        ruler.sizingOptions = []
        ruler.rootView = AnyView(
            FeedGalleryRow(gallery: FeedGallery(shots: Self.shots), open: { _ in })
                .argoAppearance(),
        )
        return ruler.sizeThatFits(
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

    /// How far a drawn height may sit from the arithmetic and still be the same layout. SwiftUI
    /// does not lay text out to the same sub-point on every machine — `MinimapBlockHeightTests`
    /// meets two engines, one keeping the font's fractional metrics and one paying `ceil` per run —
    /// and a row height is rounded up again before the table uses it. Far under what any claim here
    /// turns on: the smallest of them, the control's own row, is above 20 points.
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
        // And the still can reach the state it is named for: a specimen that lost this id renders
        // the FOLDED bubble under the unfolded name, which is evidence for the opposite claim.
        #expect(FeedProjection.previewLongPromptID != nil)
    }

    @Test
    func `a picture pasted in with the words costs the gallery and its step, and no more`() {
        let withShot = height(of: Self.long, expanded: false, shots: Self.shots)
        let wordsOnly = height(of: Self.long, expanded: false)
        #expect(abs(withShot - wordsOnly - gallery - ArgoSpacing.snug) <= Self.slack)
    }

    @Test
    func `a prompt that is only a picture is the gallery and the insets, and nothing else`() {
        let drawn = height(of: "", expanded: false, shots: Self.shots)
        // Exactly, not loosely: a bound with a control row's worth of headroom would pass with one
        // drawn, which is the thing being denied.
        #expect(abs(drawn - (ArgoFeedRow.bubbleInsetY * 2 + gallery)) <= Self.slack)
    }

    @Test
    func `a prompt that is only a picture has no state to be in`() {
        #expect(height(of: "", expanded: false, shots: Self.shots)
            == height(of: "", expanded: true, shots: Self.shots))
    }

    /// The same claim where the reader actually meets it: the height the TABLE caches for the row,
    /// through the coordinator the deck builds. Applying a second model that names the prompt is
    /// how the reader lets the fold out.
    private func rowHeight(unfolded: Set<FeedRow.ID>) -> CGFloat {
        unfolding(to: unfolded).first ?? 0
    }

    /// Every height the table gives for the row across one press: the first answer after the fold
    /// changes, and the answer once the reading has settled. A press the reader sees as ONE step is
    /// a row whose answers are all the same number.
    private func unfolding(to unfolded: Set<FeedRow.ID>) -> [CGFloat] {
        let rows = [FeedRow(id: 0, content: .prompt(text: Self.long, shots: []))]
        let handle = FeedTableHandle()
        let coordinator = FeedTableFixture.laidOut(
            rows,
            in: CGSize(width: ArgoFeedRow.column, height: 800),
            through: handle,
        )
        guard let table = coordinator.table else { return [] }
        coordinator.apply(FeedTableFixture.model(showing: rows, unfolded: unfolded))
        let first = coordinator.tableView(table, heightOfRow: 0)
        coordinator.remeasure(.all)
        return [first, coordinator.tableView(table, heightOfRow: 0)]
    }

    @Test
    func `letting the fold out grows the row by exactly the lines it was hiding`() {
        let hidden = prose(lines: wholeLines) - prose(lines: ArgoFeedRow.collapsedPromptLines)
        let grew = rowHeight(unfolded: [0]) - rowHeight(unfolded: [])
        #expect(abs(grew - hidden) <= Self.slack)
    }

    @Test
    func `the row the press lands on is one height, not a wrong one and then a right one`() {
        let across = unfolding(to: [0])
        #expect(across.count == 2)
        #expect(across.first == across.last)
    }

    @Test
    func `a prompt that stands whole is its one line and the insets, with no control under it`() {
        let expected = ArgoFeedRow.bubbleInsetY * 2 + prose(lines: 1)
        #expect(abs(height(of: Self.short, expanded: false) - expected) <= Self.slack)
    }

    @Test
    func `a prompt that stands whole is the same height either way`() {
        #expect(height(of: Self.short, expanded: false) == height(of: Self.short, expanded: true))
    }
}
