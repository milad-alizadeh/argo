import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What the lane draws for a fold of calls, closed and open (#1691).
///
/// The claim: an open card is the stack the ROW draws — its count line and one line per call it
/// took, at the pitch the row stacks them at. Reported as a single line, an open card was one thin
/// mark stretched over the whole of a tall span, so a card of nineteen steps read exactly like a
/// card of one and a reader scrubbing the lane could not find an open card at all.
@MainActor
@Suite("Minimap folds")
struct MinimapFoldTests {
    private static let measure: CGFloat = ArgoFeedRow.column - ArgoFeedRow.inset * 2

    private static func call(
        _ subject: String,
        ending: FeedCall.Ending = .succeeded,
        repeats: Int = 1,
    )
        -> FeedCall {
        FeedCall(
            kind: .execute,
            subject: .plain(subject),
            churn: nil,
            ending: ending,
            evidence: [.output(OutputEvidence(tier: .direct, text: "ok"))],
            repeats: repeats,
            spend: nil,
        )
    }

    /// A card of three commands — enough lines that a stack is tellable from a line.
    private static let card = FeedWork(
        calls: [call("bun run test"), call("git status"), call("ls")],
    )

    private static func shape(_ content: FeedRow.Content, isFolded: Bool) -> MinimapRowShape {
        MinimapRow(
            FeedRow(id: 0, content: content),
            height: 20,
            read: MinimapReadingState(isFolded: isFolded),
        ).shape
    }

    /// The listed lines of an open fold, empty where it is drawn as anything else — so a claim
    /// about them is one expectation rather than a guard and a recorded issue.
    private static func steps(_ content: FeedRow.Content) -> [[MinimapLinePart]] {
        guard case let .listed(_, steps, _) = shape(content, isFolded: false) else { return [] }
        return steps
    }

    @Test
    func `a closed card is the one line the row says it in`() {
        #expect(Self.shape(.work(Self.card), isFolded: true) == .line(
            parts: [.words(Self.card.label, .command)], ink: .command,
        ))
    }

    @Test
    func `an open card is its count line and one line per call it took`() {
        guard case let .listed(header, steps, ink) = Self.shape(.work(Self.card), isFolded: false)
        else {
            Issue.record("an open card was not drawn as its listed lines")
            return
        }
        #expect(header.map(\.text) == [Self.card.label])
        #expect(steps.map { $0.map(\.text) } == Self.card.calls.map { [$0.subject.captioned] })
        #expect(ink == .command)
    }

    /// Both folds are one anatomy in the feed (`FeedFoldLine`), so a stretch of looking opens into
    /// the same stack a Turn's card of work does.
    @Test
    func `an open survey lists what it looked at`() {
        let run = FeedSurvey(calls: [Self.call("Package.swift"), Self.call("AGENTS.md")])
        #expect(Self.steps(.survey(run)).count == run.calls.count)
    }

    /// A run of red rows is the one thing a reader scans an overview for, so a name that failed
    /// keeps the failure's ink here exactly as `FeedFoldStepName` gives it in the row.
    @Test
    func `a name that failed is drawn in the ink the row fails it in`() {
        let broke = FeedWork(calls: [Self.call("bun run test"), Self.call("ls", ending: .failed)])
        #expect(Self.steps(.work(broke)).map { $0.first?.ink } == [.command, .failure])
    }

    /// The counts on the header are in CALLS, so a name standing for three of them says so — the
    /// `×3` the row draws, in the machine face it draws it in.
    @Test
    func `a name standing for several calls carries the count that reconciles it`() {
        let collapsed = FeedWork(calls: [Self.call("bun run test", repeats: 3), Self.call("ls")])
        let steps = Self.steps(.work(collapsed))
        #expect(steps.first?.map(\.text) == ["bun run test", "×3"])
        #expect(steps.first?.last?.face.isMachine == true)
        #expect(steps.last?.count == 1)
    }

    @Test
    func `the nth name stands where the row stacks it, under the header's own words`() {
        let rects = Self.shape(.work(Self.card), isFolded: false)
            .rects(across: Self.measure, height: 0)
        let step = FeedShapeHeight.foldedLineStep
        #expect(rects.map(\.y) == [0, step, step * 2, step * 3])
        #expect(rects.first?.from == 0)
        #expect(rects.dropFirst().allSatisfy { $0.from == ArgoFeedRow.foldNameIndent })
    }

    /// The pitch the lane stacks at IS the pitch the height was measured from, exactly.
    ///
    /// Stated as arithmetic rather than as slack, because slack cannot see the drift that matters:
    /// `ArgoSpacing.flush` is zero, so a `foldedLineStep` that dropped the ground inset would move
    /// every name up by `FeedRowButtonStyle.groundInsetY * 2` a line and still sit inside the row.
    /// A card of `n` calls stands at its header plus `n` steps, and nothing else can satisfy that.
    @Test
    func `the lane's pitch is the one the height formula stacks the lines at`() {
        let content = FeedRow.Content.work(Self.card)
        let height = FeedShapeHeight(
            standing: FeedRowStanding(isUnfolded: true),
            measure: Self.measure,
            tickets: .none,
        ).height(of: content)
        #expect(height == FeedShapeHeight.pressedLine
            + FeedShapeHeight.foldedLineStep * CGFloat(Self.card.calls.count))
        // And the stack the lane reports is inside it, which is ADR-0030 Rule 7's own claim.
        let drawn = Self.shape(content, isFolded: false)
            .rects(across: Self.measure, height: height)
            .map { $0.y + $0.height }
            .max() ?? 0
        #expect(drawn <= height)
    }

    /// Nothing is drawn past the lane's drawable, indent and all: a long caption is cut where the
    /// row cuts it rather than reaching over the miniature's trailing edge.
    @Test
    func `nothing a listed name draws runs past the measure`() {
        let long = FeedWork(calls: [Self.call(MinimapText.words(400)), Self.call("ls")])
        let rects = Self.shape(.work(long), isFolded: false)
            .rects(across: Self.measure, height: 0)
        #expect(rects.allSatisfy { $0.to <= Self.measure })
    }
}
