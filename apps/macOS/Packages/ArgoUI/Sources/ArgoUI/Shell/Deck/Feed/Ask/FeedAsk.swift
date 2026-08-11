import ArgoEngine

/// A question put to somebody, as the feed draws it: what was asked, what was offered, and which
/// way it went. Holds the engine's `Ask` whole, since every word of it is carried verbatim.
///
/// A pending question is the only attention-coloured thing in the feed; an answered one is history.
struct FeedAsk: Equatable, Sendable {
    let ask: Ask
    /// Whether the record has answered it at all — the existence of a result, not what was in it.
    /// Apart from `answer` because they degrade in opposite directions: a question answered with an
    /// unreadable payload is SETTLED, and degrade-down says it must resolve quiet.
    let isAnswered: Bool
    /// What came back, verbatim. `nil` where nothing answered it — and also where what answered it
    /// carried nothing readable, which is why it cannot be what pendingness is read from.
    let answer: String?

    var questions: [Ask.Question] {
        ask.questions
    }

    var isPending: Bool {
        !isAnswered
    }

    /// Which of the offered options the answer named, or `nil`.
    ///
    /// DERIVED and deliberately weak: the answer is prose, not a field naming an option, so the
    /// reading is that the answer CONTAINS the label. Nothing is marked where no option is named.
    /// Where two labels are named, the longer wins — one label containing another is the only way
    /// both can be true of one answer.
    func chosen(in question: Ask.Question) -> String? {
        guard let answer else { return nil }
        return question.options
            .filter(answer.contains)
            .max { $0.count < $1.count }
    }
}
