import ArgoDesign
import ArgoEngine
@testable import ArgoUI
import SwiftUI
import Testing

/// What a settled question costs the column, against what the same question costs while it waits
/// (#1207).
///
/// The ticket this closes is a MEASUREMENT — "an answered question is drawn at full length, and
/// reads as loud as one still waiting" — so the case that closes it has to be one too. The ink
/// already degraded before #1207 and the length did not, which is why a suite that only asserted
/// colours let the row ship at full height for as long as it did.
///
/// The heights come from `FeedShapeHeight`, which `FeedShapeHeightTests` holds against what SwiftUI
/// lays the same rows out at — so a number here is the row's real vertical rather than a second
/// arithmetic nobody drew.
@MainActor
@Suite("Feed ask fold")
struct FeedAskFoldTests {
    /// The feed's own measure: `ArgoFeedRow.column` 720 less its inset either side, which is the
    /// 672 the design's table was measured at.
    private static let width = ArgoFeedRow.column

    private static let decision = Ask.Question(
        text: "Issue #721 doesn't exist. Which ticket should I implement?",
        options: Ask.Option.labelled([
            "#712 — Answer an AskUserQuestion in the cockpit",
            "#713 — PlanPill shows the system focus ring on a click",
            "#711 — Read a Session's subagent transcripts",
        ]),
    )

    /// The whole of the ticket, as a number: the same question, waiting and settled.
    @Test
    func `a settled question costs a fraction of the vertical the same one waiting does`() {
        let waiting = Self.height(of: Self.waiting(Self.decision))
        let settled = Self.height(of: Self.answered(
            Self.decision, "#713 — PlanPill shows the system focus ring on a click",
        ))

        #expect(settled < waiting / 2, "waiting \(waiting), settled \(settled)")
    }

    /// The second half of it: the offer is what goes. A question whose call put FIVE options
    /// settles at the same height as one that put three, because neither draws any of them.
    @Test
    func `a settled question costs the same however many options it offered`() {
        let three = Self.height(of: Self.answered(
            Self.decision,
            "#711 — Read a Session's subagent transcripts",
        ))
        let five = Self.height(of: Self.answered(
            Ask.Question(
                text: Self.decision.text,
                options: Ask.Option.labelled(Self.decision.options.map(\.label) + [
                    "#714 — The lane redraws on every scroll",
                    "#715 — A Permission that expired still says Allow",
                ]),
            ),
            "#711 — Read a Session's subagent transcripts",
        ))

        #expect(three == five)
    }

    /// The state the fold must NOT touch. A question nobody can answer here is PENDING, not
    /// settled: folding it would draw a decision nobody made, so it keeps every offered line.
    @Test
    func `a pending question nothing here can reach keeps its offer at full length`() {
        let pending = FeedAsk(ask: Ask(questions: [Self.decision]), isAnswered: false, answer: nil)

        #expect(Self.height(of: pending) > Self.height(of: Self.answered(
            Self.decision, "#713 — PlanPill shows the system focus ring on a click",
        )))
    }

    /// Two states the fold puts on screen for the FIRST time. Today a free-form answer, and one
    /// that agreed with nothing on the list, are drawn nowhere: `FeedAskQuestion` draws its options
    /// only where there are some, and `chosen(in:)` names none. Both now cost a line and state it.
    @Test
    func `a settled question states an answer that named none of its options`() throws {
        let freeForm = Ask.Question(text: "What should I call the roll-up?", options: [])
        let named = try #require(
            Self.answered(freeForm, "The delivery digest").answered(freeForm),
        )
        #expect(named.words == "The delivery digest")
        #expect(!named.isChosen)

        let unnamed = try #require(
            Self.answered(Self.decision, "None of them — I opened a new one.")
                .answered(Self.decision),
        )
        #expect(unnamed.words == "None of them — I opened a new one.")
        #expect(!unnamed.isChosen)
    }

    /// A call carrying two questions has ONE answer covering both, so prose that named no option
    /// is drawn under neither rather than under each — one fact twice is the louder reading, and
    /// degrade-down takes the quieter.
    @Test
    func `prose that named no option is not repeated under every question of one call`() {
        let second = Ask.Question(text: "And which branch?", options: [])
        let ask = FeedAsk(
            ask: Ask(questions: [Self.decision, second]),
            isAnswered: true,
            answer: "Neither — I opened a new one.",
        )

        #expect(ask.answered(Self.decision) == nil)
        #expect(ask.answered(second) == nil)
    }

    /// The lane folds with the row or the map stops matching the column: a settled card hands over
    /// its answer and no offers at all.
    @Test
    func `the overview lane draws the settled card folded too`() throws {
        let settled = Self.answered(
            Self.decision, "#713 — PlanPill shows the system focus ring on a click",
        ).card
        let question = try #require(settled.questions.first)

        #expect(
            question.under == .answered("#713 — PlanPill shows the system focus ring on a click"),
        )
    }

    /// The card's padding is the ground's, so a card without a ground takes none — the settled
    /// question sets flush with the call rows above it rather than 15pt right of them.
    @Test
    func `only a card with a ground is inset`() {
        #expect(Self.waiting(Self.decision).hasGround)
        #expect(!Self.answered(Self.decision, "#711 — Read a Session's subagent transcripts")
            .hasGround)
    }

    /// A settled card is its two lines and NOTHING else — no offer, and no inset, because it draws
    /// no ground to hold words off. Stated as the sum so a padding put back is a failure here.
    @Test
    func `a settled card is its question, its answer, and no inset at all`() {
        let words = "#711 — Read a Session's subagent transcripts"
        let across = Self.width - ArgoFeedRow.inset * 2

        #expect(Self.height(of: Self.answered(Self.decision, words))
            == FeedShapeHeight.symbolLine(Self.decision.text, across: across)
            + ArgoFeedRow.stepBeforeProse
            + FeedShapeHeight.symbolLine(words, across: across))
    }

    private static func waiting(_ question: Ask.Question) -> FeedAsk {
        FeedAsk(ask: Ask(questions: [question]), isAnswered: false, answer: nil)
            .offered(FeedAskProjection.Asking(
                live: FeedAskProjection.Live(
                    sessionID: "session-fold",
                    askID: "ask-fold",
                    ask: Ask(questions: [question]),
                ),
                isDriveable: true,
            ))
    }

    private static func answered(_ question: Ask.Question, _ answer: String) -> FeedAsk {
        FeedAsk(ask: Ask(questions: [question]), isAnswered: true, answer: answer)
    }

    /// The row's worked-out height, off the very model the tree is built from.
    private static func height(of ask: FeedAsk) -> CGFloat {
        let focus = FocusState<FeedFocus?>()
        let model = FeedTableModel(
            rows: [FeedRow(id: 0, content: .ask(ask))],
            selection: FeedRowSelection(
                open: .constant(nil),
                step: .constant(nil),
                lit: .constant(nil),
                focus: focus.projectedValue,
            ),
            held: nil,
            isResizing: false,
            bottomEdge: .bare,
            washed: nil,
            unfolded: .constant([]),
            environment: FeedCellEnvironment(),
        )
        return FeedShapeHeight(
            standing: FeedMeasureStamp(of: model, atWidth: width).standing(at: 0),
            measure: FeedRowMeasure.measure(atWidth: width),
        ).height(of: .ask(ask))
    }
}
