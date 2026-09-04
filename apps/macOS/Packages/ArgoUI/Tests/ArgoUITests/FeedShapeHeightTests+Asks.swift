import ArgoEngine
@testable import ArgoUI

// The question rows, which are THREE shapes under one case (#1207): a settled question folds its
// offer out and draws the way it went, a pending one nothing here can reach draws its offer as a
// reading, and one Argo is holding open draws the cards you press, a field and an `Answer`. All
// three are on screen in the shipping app, so all three have to be worked out.

extension FeedShapeHeightTests {
    static let questions: [Row] = [
        Row(name: "ask, settled with nothing readable", content: .ask(settled(oneOf))),
        Row(name: "ask, settled and answered", content: .ask(answered(oneOf, "The attention ink"))),
        Row(name: "ask, settled where the answer named no option", content: .ask(
            answered(oneOf, "Neither — keep the ground and drop the stroke."),
        )),
        Row(name: "ask, settled free-form", content: .ask(answered(freeForm, "The roll-up"))),
        Row(name: "ask, settled with an answer that wraps", content: .ask(answered(
            wrapping,
            "Neither of the two, because the words the record came back with run past the measure "
                + "the card gives them and have to wrap at least twice.",
        ))),
        Row(name: "ask, settled with options", content: .ask(pending(oneOf))),
        Row(name: "ask, settled two questions", content: .ask(answered(both, "The attention ink"))),
        Row(name: "ask, two questions", content: .ask(pending(both))),
        Row(name: "ask, a question that wraps", content: .ask(pending(wrapping))),
        Row(name: "ask, waiting one-of", content: .ask(waiting(oneOf))),
        Row(name: "ask, waiting many-of", content: .ask(waiting(manyOf))),
        Row(name: "ask, waiting free-form", content: .ask(waiting(freeForm))),
        Row(name: "ask, waiting with a detail line", content: .ask(waiting(detailed))),
        Row(name: "ask, reported over the plugin", content: .ask(reported(oneOf))),
        Row(name: "ask, reported and wrapping", content: .ask(reported(wrapping))),
    ]

    /// A question the agent raised over the companion plugin (#1205): a reading with the caption
    /// under it, and nothing pressable — the one ask shape that carries a line the others do not.
    private static func reported(_ ask: Ask) -> FeedAsk {
        FeedAsk(ask: ask, isAnswered: false, answer: nil).known(via: .convention)
    }

    /// A question the record has settled with nothing readable in the payload. Settled, so the
    /// offer is folded out — and with no words to put in its place the row is the question alone.
    private static func settled(_ ask: Ask) -> FeedAsk {
        FeedAsk(ask: ask, isAnswered: true, answer: nil)
    }

    /// A question the record has settled, with what came back — the folded reading (#1207).
    private static func answered(_ ask: Ask, _ answer: String) -> FeedAsk {
        FeedAsk(ask: ask, isAnswered: true, answer: answer)
    }

    /// A question nobody has answered that nothing here can reach — its offer, read. The state a
    /// Session Argo cannot drive is in (#546), and the one the fold must not touch.
    private static func pending(_ ask: Ask) -> FeedAsk {
        FeedAsk(ask: ask, isAnswered: false, answer: nil)
    }

    /// A question Argo is holding open, which is what makes the row the thing you press.
    private static func waiting(_ ask: Ask) -> FeedAsk {
        FeedAsk(
            ask: ask,
            isAnswered: false,
            answer: nil,
            offer: FeedAskProjection.Asking(
                live: FeedAskProjection.Live(sessionID: "one", askID: "ask", ask: ask),
                isDriveable: true,
            ),
        )
    }

    private static let oneOf = Ask(questions: [
        Ask.Question(
            text: "Which ink should the row take?",
            options: Ask.Option.labelled(["The attention ink", "The ordinary ink"]),
        ),
    ])

    private static let manyOf = Ask(questions: [
        Ask.Question(
            text: "Which of these should the pass cover?",
            options: Ask.Option.labelled(["The feed", "The lane", "The roster"]),
            allowsMultiple: true,
        ),
    ])

    private static let freeForm = Ask(questions: [
        Ask.Question(text: "What should it be called?", options: []),
    ])

    private static let both = Ask(questions: oneOf.questions + freeForm.questions)

    private static let wrapping = Ask(questions: [
        Ask.Question(
            text: "Which of the two readings should the row take, given that the words run past "
                + "the measure the card gives them and have to wrap at least twice?",
            options: Ask.Option.labelled([
                "The one that keeps the attention ink until the record settles the question",
                "The one that goes quiet the moment anything answers",
            ]),
        ),
    ])

    private static let detailed = Ask(questions: [
        Ask.Question(text: "Which route?", options: [
            Ask.Option(label: "Rebuild", detail: "Slower, and the geometry is settled afterwards"),
            Ask.Option(label: "Reuse", detail: "Instant, and the heights are the ones already had"),
        ]),
    ])
}
