import ArgoEngine
import ArgoUI

// The two states #1664 could not be looked at, both on a call of TWO questions: one of them
// answered in somebody's own words, and one of them closed while the other is still open.

package extension FeedProjection {
    /// A call of two questions where the second was answered in somebody's OWN words (#1664).
    ///
    /// The result is a real `AskUserQuestion` payload, verbatim: the CLI names each question and
    /// puts its answer beside it. Judged against `feedAskAnswered` — the first question resolves to
    /// the option it named and takes a tick, the second carries the typed words and takes the
    /// `answered` mark instead, because nothing on its list was named. Before #1664 the second
    /// question drew nothing at all.
    static let previewAskAnsweredTyped = answeredRows([previewAskWhere, previewAskEsc], """
    Your questions have been answered: "Where should the ask take its answer?"="In the feed, \
    where it was asked", "What does esc do on an ask?"="nothing, but it should clear the field \
    first". You can now continue with these answers in mind.
    """)

    /// A waiting call whose FIRST question closes on an `Answer` of its own — a many-of question,
    /// whose field is open beside its boxes from the start.
    ///
    /// The state worth looking at is one press in: tick a box, press `Answer`, and the card has to
    /// say that question is answered and that the reply is held for the second one. First and not
    /// second on purpose, because the mark then has a question BELOW it as well as above: that is
    /// the ordering where a line bound to its question by proximity alone would read as the wrong
    /// question's.
    ///
    /// A still specimen cannot set what the row is holding, so this is the render the press is made
    /// on (`docs/agents/visual-verification.md`, the AX walk).
    static let previewAskClosable = askRows([
        Ask.Question(
            text: previewAskEsc.text,
            options: previewAskEsc.options,
            allowsMultiple: true,
        ),
        previewAskWhere,
    ])

    private static let previewAskWhere = Ask.Question(
        text: "Where should the ask take its answer?",
        options: Ask.Option.labelled([
            "In the feed, where it was asked",
            "In the composer's slot",
        ]),
    )

    private static let previewAskEsc = Ask.Question(
        text: "What does esc do on an ask?",
        options: Ask.Option.labelled([
            "Nothing — an ask has no refusal",
            "Clears the selection",
        ]),
    )
}
