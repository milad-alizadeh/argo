import ArgoDesign
@testable import ArgoSpecimens
@testable import ArgoUI
import SwiftUI
import Testing

/// Both prompts that run past the fold: the moderate one #946 was filed at, and one 120 times past
/// it. Outside the suite because `@Test(arguments:)` reads them from outside its actor.
private enum FoldingPrompts {
    static let long = String(
        repeating: "Read the whole anatomy study before you start. ", count: 14,
    )
    static let huge = FeedProjection.hugePromptText
    static let both = [long, huge]
}

/// What a prompt's bubble stands at, in each state the reader can put it in — asked through
/// `FeedPromptRuler`, which is the single `sizeThatFits` the table measures a row with.
///
/// Every claim about a folding prompt is made at BOTH lengths: the moderate prompt #946 was filed
/// at, and one 120 times past it. #1287 is a claim about length — it reports the moderate prompt
/// unfolding correctly and a large one not — so a suite that only asked at the moderate one is the
/// suite that bug would get past.
@MainActor
@Suite("Feed prompt fold")
struct FeedPromptFoldTests {
    private static let long = FoldingPrompts.long
    private static let short = "Run the visual contract suite and tell me what broke."
    private static let shots = Array(FeedProjection.previewShots.prefix(1))

    @Test(arguments: FoldingPrompts.both)
    func `a prompt past the fold folds to its first lines, with the control under them`(
        _ text: String,
    ) {
        let expected = ArgoFeedRow.bubbleInsetY * 2
            + FeedPromptRuler.prose(lines: ArgoFeedRow.collapsedPromptLines)
            + FeedPromptRuler.control
        #expect(abs(FeedPromptRuler.height(of: text, expanded: false) - expected)
            <= FeedPromptRuler.slack)
    }

    @Test(arguments: FoldingPrompts.both)
    func `unfolding it answers with the whole prompt, at the measure it is drawn across`(
        _ text: String,
    ) {
        let expected = ArgoFeedRow.bubbleInsetY * 2
            + FeedPromptRuler.prose(lines: FeedPromptRuler.lines(of: text))
            + FeedPromptRuler.control
        #expect(abs(FeedPromptRuler.height(of: text, expanded: true) - expected)
            <= FeedPromptRuler.slack)
    }

    @Test(arguments: FoldingPrompts.both)
    func `it is longer than the fold shows, or the claims above check nothing`(_ text: String) {
        #expect(FeedPromptRuler.lines(of: text) > ArgoFeedRow.collapsedPromptLines)
    }

    /// The one AC no height can settle: a bubble stuck on **Show more** measures exactly as tall
    /// as one offering the way back, so the words themselves have to be asked for (#1287).
    @Test
    func `the control offers the way back while the prompt is unfolded`() {
        #expect(FeedPrompt.disclosureWords(isExpanded: true) == "Show less")
        #expect(FeedPrompt.disclosureWords(isExpanded: false) == "Show more")
    }

    /// The stills can reach the states they are named for. A specimen that lost one of these ids
    /// renders the FOLDED bubble under an unfolded name, which is evidence for the opposite claim.
    @Test
    func `both folding prompts have a still to be looked at`() {
        #expect(FeedProjection.previewLongPromptID != nil)
        #expect(FeedProjection.previewHugePromptID != nil)
    }

    @Test
    func `a picture pasted in with the words costs the gallery and its step, and no more`() {
        let withShot = FeedPromptRuler.height(of: Self.long, expanded: false, shots: Self.shots)
        let wordsOnly = FeedPromptRuler.height(of: Self.long, expanded: false)
        let gallery = FeedPromptRuler.gallery(of: Self.shots)
        #expect(abs(withShot - wordsOnly - gallery - ArgoSpacing.snug) <= FeedPromptRuler.slack)
    }

    @Test
    func `a prompt that is only a picture is the gallery and the insets, and nothing else`() {
        let drawn = FeedPromptRuler.height(of: "", expanded: false, shots: Self.shots)
        let expected = ArgoFeedRow.bubbleInsetY * 2 + FeedPromptRuler.gallery(of: Self.shots)
        // Exactly, not loosely: a bound with a control row's worth of headroom would pass with one
        // drawn, which is the thing being denied.
        #expect(abs(drawn - expected) <= FeedPromptRuler.slack)
    }

    @Test
    func `a prompt that is only a picture has no state to be in`() {
        #expect(FeedPromptRuler.height(of: "", expanded: false, shots: Self.shots)
            == FeedPromptRuler.height(of: "", expanded: true, shots: Self.shots))
    }

    @Test
    func `a prompt that stands whole is its one line and the insets, with no control under it`() {
        let expected = ArgoFeedRow.bubbleInsetY * 2 + FeedPromptRuler.prose(lines: 1)
        #expect(abs(FeedPromptRuler.height(of: Self.short, expanded: false) - expected)
            <= FeedPromptRuler.slack)
    }

    @Test
    func `a prompt that stands whole is the same height either way`() {
        #expect(FeedPromptRuler.height(of: Self.short, expanded: false)
            == FeedPromptRuler.height(of: Self.short, expanded: true))
    }

    /// The same claims where the reader actually meets them: the height the TABLE caches for the
    /// row, through the coordinator the deck builds. Applying a second model that names the prompt
    /// is how the reader lets the fold out — and this is the pass #1287 names as its first
    /// suspect, so it is asked at both lengths like everything else.
    @Test(arguments: FoldingPrompts.both)
    func `letting the fold out grows the row by exactly the lines it was hiding`(
        _ text: String,
    ) async {
        let hidden = FeedPromptRuler.prose(lines: FeedPromptRuler.lines(of: text))
            - FeedPromptRuler.prose(lines: ArgoFeedRow.collapsedPromptLines)
        let out = await unfolding(text, to: [0]).first ?? 0
        let folded = await unfolding(text, to: []).first ?? 0
        #expect(abs(out - folded - hidden) <= FeedPromptRuler.slack)
    }

    /// A press the reader sees as ONE step is a row whose answers are all the same number — which
    /// since ADR-0030 is by construction, because the row is drawn at the height it had until the
    /// document that holds the new one is complete.
    @Test(arguments: FoldingPrompts.both)
    func `the row the press lands on is one height, not a wrong one and then a right one`(
        _ text: String,
    ) async {
        let across = await unfolding(text, to: [0])
        #expect(across.count == 2)
        #expect(across.first == across.last)
    }

    /// Every height the table gives for the row across one press: the answer the fresh document
    /// landed with, and the answer once the reading has been noted again.
    private func unfolding(_ text: String, to unfolded: Set<FeedRow.ID>) async -> [CGFloat] {
        let rows = [FeedRow(id: 0, content: .prompt(text: text, shots: []))]
        let handle = FeedTableHandle()
        let coordinator = await FeedTableFixture.laidOut(
            rows,
            in: CGSize(width: ArgoFeedRow.column, height: 800),
            through: handle,
        )
        guard let table = coordinator.table else { return [] }
        coordinator.apply(FeedTableFixture.model(showing: rows, unfolded: unfolded))
        await FeedTableFixture.settled(coordinator)
        let first = coordinator.tableView(table, heightOfRow: 0)
        coordinator.remeasure(.all)
        return [first, coordinator.tableView(table, heightOfRow: 0)]
    }
}
