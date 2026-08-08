import ArgoEngine

/// A question put to somebody, as the feed draws it: what was asked, what was offered, and which
/// way it went.
///
/// It holds the engine's `Ask` whole rather than restating its shape, because every word in it is
/// carried verbatim — a second copy of the same fields is a second place for one of them to be
/// quietly reworded on the way to the screen.
///
/// The one state that matters is whether it is still WAITING. A pending question is the only
/// attention-coloured thing in the feed; an answered one is history, and history that goes on
/// glowing is what teaches a reader that the colour means nothing.
struct FeedAsk: Equatable, Sendable {
    let ask: Ask
    /// Whether the record has answered it at all — the existence of a result, not what was in it.
    ///
    /// Kept apart from `answer` deliberately, because they degrade in opposite directions. A
    /// question answered with a payload nothing could read is SETTLED: somebody replied, and going
    /// on demanding attention for it is the loud reading of an ambiguity that must resolve quiet.
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
    /// DERIVED, and deliberately weak: the answer is prose the host wrote, not a field naming an
    /// option, so the reading is that the answer NAMES the option. Nothing is marked where no
    /// option is named — a chosen mark on the wrong option is a worse row than one with no mark at
    /// all. Where two labels are named, the longer wins: one label containing another is the only
    /// way both can be true of one answer.
    func chosen(in question: Ask.Question) -> String? {
        guard let answer else { return nil }
        return question.options
            .filter(answer.contains)
            .max { $0.count < $1.count }
    }
}
