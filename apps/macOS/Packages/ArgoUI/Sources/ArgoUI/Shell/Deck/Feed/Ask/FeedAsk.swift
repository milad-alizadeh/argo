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
    /// The gate's handle on this question, where Argo is holding it open and can answer it (#712).
    /// Absent for every row the record has already settled, for a Session Argo cannot drive, and
    /// for one whose live question is a different one — which is what makes the row a READING
    /// again the moment any of those is true.
    let live: FeedAskProjection.Live?

    init(ask: Ask, isAnswered: Bool, answer: String?, live: FeedAskProjection.Live? = nil) {
        self.ask = ask
        self.isAnswered = isAnswered
        self.answer = answer
        self.live = live
    }

    var questions: [Ask.Question] {
        ask.questions
    }

    var isPending: Bool {
        !isAnswered
    }

    /// Whether this row is the thing you press rather than the thing you read. Both facts at once:
    /// the record has not settled it, and Argo is holding the question that raised it.
    var isWaiting: Bool {
        isPending && live != nil
    }

    /// The ink this row is drawn in, answered HERE rather than in the view, so the lane and the row
    /// cannot disagree about which questions are still waiting. An answered question is history and
    /// takes the same ink as anything else the record has finished with.
    ///
    /// Off `isWaiting` rather than `isPending`: the attention ink now means *this is waiting on
    /// YOU*, and on a Session Argo cannot drive it is not — nothing you do here reaches the agent
    /// (#546). Amber nobody can act on is the affordance that lies, which is the one thing this
    /// screen is designed against.
    var ink: FeedInk {
        isWaiting ? .attention : .message
    }

    /// The options of one question, numbered, in the order they were offered — what the row draws.
    func offers(in question: Ask.Question) -> [FeedAskOffer] {
        FeedAskOffer.numbered(question.options, chosen: chosen(in: question))
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
            .map(\.label)
            .filter(answer.contains)
            .max { $0.count < $1.count }
    }
}
