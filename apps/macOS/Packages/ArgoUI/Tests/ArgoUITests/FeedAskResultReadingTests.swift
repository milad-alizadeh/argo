import ArgoEngine
@testable import ArgoUI
import Testing

/// What the settled row draws under ONE question of a call that put several (#1664).
///
/// #1207 read a call's answer as a single blob and drew it under nothing where the call put more
/// than one question, on the ground that one payload cannot say which question it answers. It can:
/// both writers name every question in the call and put its answer beside it. The fixtures below
/// are the two spellings verbatim — a real `AskUserQuestion` result, and the reason
/// `AskReply.reason` writes when Argo's own gate answers.
///
/// The case that closes the ticket is the TYPED answer: free words match no offered label, so
/// `chosen(in:)` names nothing and the question was drawn empty however many words somebody wrote.
@Suite("Feed ask result reading")
struct FeedAskResultReadingTests {
    private static let ticket = Ask.Question(
        text: "Which ticket should I implement?",
        options: Ask.Option.labelled(["#712 — Answer an ask in the cockpit", "#713 — PlanPill"]),
    )
    private static let branch = Ask.Question(
        text: "And what should the branch be called?",
        options: Ask.Option.labelled(["Off the ticket number", "Off the slug"]),
    )

    /// Claude Code's own picker: `"question"="answer"` pairs under one head, and the tail it adds
    /// after the last of them.
    private static let picked = """
    Your questions have been answered: "Which ticket should I implement?"="#713 — PlanPill", \
    "And what should the branch be called?"="argo/#1664-ask-typed-answer". You can now \
    continue with these answers in mind.
    """

    /// Argo's own gate: an answered ask is a `PreToolUse` deny whose reason IS the answer, and the
    /// reason arrives as the tool result verbatim. Segments joined by ` · `, the pick spelled with
    /// the number the row drew beside it.
    private static let argo = """
    Answered in Argo, by the person this Session belongs to. · Which ticket should I \
    implement? → 2. #713 — PlanPill · And what should the branch be called? → \
    argo/#1664-ask-typed-answer
    """

    /// The whole ticket, in the spelling the CLI writes. The second question was answered in
    /// somebody's own words, so nothing on its list is named — and it is drawn anyway.
    @Test(arguments: [picked, argo])
    func `a typed answer to one question of a call is drawn under that question`(
        _ result: String,
    ) throws {
        let settled = Self.answered(result)

        let typed = try #require(settled.answered(Self.branch))
        #expect(typed.words == "argo/#1664-ask-typed-answer")
        // No tick: nothing on the list was named, and a tick over words nobody offered is a false
        // DIRECT (`FeedAskAnswer.mark`).
        #expect(!typed.isChosen)
    }

    /// The other question of the same call still resolves to the option it named, ticked — the read
    /// that already worked has to go on working.
    @Test(arguments: [picked, argo])
    func `an option named under one question is still ticked`(_ result: String) throws {
        let chosen = try #require(Self.answered(result).answered(Self.ticket))

        #expect(chosen.words == "#713 — PlanPill")
        #expect(chosen.isChosen)
    }

    /// Why the read is per question rather than over the whole payload. Both questions offer the
    /// same words, and only the first was answered with them: read over the blob, the second
    /// question ticks an option nobody took there.
    @Test
    func `a label named under one question is not ticked under another that offered it too`()
        throws {
        let keep = Ask.Option.labelled(["Keep the ground", "Drop the ground"])
        let first = Ask.Question(text: "What happens to the ground?", options: keep)
        let second = Ask.Question(text: "And to the stroke?", options: keep)
        let settled = FeedAsk(
            ask: Ask(questions: [first, second]),
            isAnswered: true,
            answer: """
            Your questions have been answered: "What happens to the ground?"="Keep the \
            ground", "And to the stroke?"="neither, take it off entirely". You can now \
            continue with these answers in mind.
            """,
        )

        #expect(settled.chosen(in: second) == nil)
        let typed = try #require(settled.answered(second))
        #expect(typed.words == "neither, take it off entirely")
        #expect(!typed.isChosen)
    }

    /// Degrade-down, kept. A payload that names no question at all is one blob covering the call,
    /// so it is drawn under none of them rather than under each — one fact twice is the louder
    /// reading (#1207).
    @Test
    func `a payload that names no question is drawn under none of them`() {
        let settled = Self.answered("Neither — I opened a new one.")

        #expect(settled.answered(Self.ticket) == nil)
        #expect(settled.answered(Self.branch) == nil)
    }

    /// The result the repo's own transcript fixture carries (`askOffered.jsonl`) — one question,
    /// and no `You can now continue…` tail after the pair. The read closes on the quote the pair
    /// ends with, so the tail is not what it depends on.
    @Test
    func `a one-question result with no tail after the pair still names its question`() throws {
        let marked = Ask.Question(
            text: "Where should the chosen option be marked?",
            options: Ask.Option.labelled(["On the option itself", "Beside the question"]),
        )
        let settled = FeedAsk(
            ask: Ask(questions: [marked]),
            isAnswered: true,
            answer: """
            Your questions have been answered: "Where should the chosen option be \
            marked?"="On the option itself"
            """,
        )

        let named = try #require(settled.answered(marked))
        #expect(named.words == "On the option itself")
        #expect(named.isChosen)
    }

    /// Argo's spelling has no mark opening a segment, only ` → ` closing the question — so a
    /// question whose words END another question's would read its neighbour's answer as its own.
    /// The segment's own leading ` · ` is what stops that.
    @Test
    func `a question whose words end another question's does not read that one's answer`() throws {
        let short = Ask.Question(text: "what should the branch be called?", options: [])
        let long = Ask.Question(text: "and what should the branch be called?", options: [])
        let settled = FeedAsk(
            ask: Ask(questions: [short, long]),
            isAnswered: true,
            answer: """
            Answered in Argo, by the person this Session belongs to. · what should the branch \
            be called? → off the ticket number · and what should the branch be called? → off \
            the slug
            """,
        )

        #expect(try #require(settled.answered(short)).words == "off the ticket number")
        #expect(try #require(settled.answered(long)).words == "off the slug")
    }

    /// Typed words may quote something themselves. The pair closes on the quote the writer follows
    /// with a comma or the sentence's full stop, so the answer is carried whole rather than cut at
    /// the first inner quote — a verbatim read is never reworded, and half a sentence is a
    /// rewording.
    @Test
    func `typed words that quote something are carried whole`() throws {
        let settled = Self.answered("""
        Your questions have been answered: "Which ticket should I implement?"="#713 — \
        PlanPill", "And what should the branch be called?"="the one you called "the short \
        slug" yesterday". You can now continue with these answers in mind.
        """)

        let typed = try #require(settled.answered(Self.branch))
        #expect(typed.words == "the one you called \"the short slug\" yesterday")
    }

    /// The lane folds with the row or the map stops matching the column, so it takes the same
    /// per-question read.
    @Test
    func `the overview lane lays the typed answer under its own question`() throws {
        let card = Self.answered(Self.picked).card

        #expect(card.questions.count == 2)
        let typed = try #require(card.questions.last)
        #expect(typed.under == .answered("argo/#1664-ask-typed-answer"))
    }

    private static func answered(_ result: String) -> FeedAsk {
        FeedAsk(ask: Ask(questions: [ticket, branch]), isAnswered: true, answer: result)
    }
}
