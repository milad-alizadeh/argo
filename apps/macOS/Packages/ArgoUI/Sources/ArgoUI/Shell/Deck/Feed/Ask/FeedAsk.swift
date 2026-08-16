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
    /// Whether this Session can be driven at all (#546). Apart from `live`, because their absences
    /// mean opposite things: a question nothing can reach is not waiting on anybody, while a
    /// driveable Session whose gate has not raised this one yet is still waiting exactly as #534
    /// drew it. `true` where nothing said otherwise — a reading of a live cockpit, not of a dead
    /// Session.
    let isDriveable: Bool

    init(
        ask: Ask,
        isAnswered: Bool,
        answer: String?,
        offer: FeedAskProjection.Asking = .none,
    ) {
        self.ask = ask
        self.isAnswered = isAnswered
        self.answer = answer
        self.live = offer.live
        self.isDriveable = offer.isDriveable
    }

    var questions: [Ask.Question] {
        ask.questions
    }

    /// What makes this the same question across a rebuild — the words asked and the options
    /// offered, which is the whole of what somebody is answering. The marks a waiting row holds
    /// are keyed by it, so they cannot survive into a different question (`FeedRowView`).
    ///
    /// Not the gate's `askID`: a row on a Session with no live handle still has to be told apart
    /// from its neighbour, and the id is exactly what those rows lack.
    var identity: String {
        questions.map { question in
            ([question.text] + question.options.map(\.label)).joined(separator: "\u{1F}")
        }.joined(separator: "\u{1E}")
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
    /// Off DRIVEABILITY and not off `isWaiting`: the attention ink means *this is waiting on YOU*,
    /// and on a Session Argo cannot drive it is not — nothing you do here reaches the agent
    /// (#546). Amber nobody can act on is the affordance that lies, which is the one thing this
    /// screen is designed against.
    ///
    /// A driveable Session whose gate has not raised this question keeps the ink, though it draws
    /// no cards: it IS still waiting, and quieting it there would render a question nobody
    /// answered as one somebody did.
    var ink: FeedInk {
        isPending && isDriveable ? .attention : .message
    }

    /// The options of one question, numbered, in the order they were offered — what the row draws.
    func offers(in question: Ask.Question) -> [FeedAskOffer] {
        FeedAskOffer.numbered(question.options, chosen: chosen(in: question))
    }

    /// The card as the overview lane draws it: the same words at the same indents, and the ink read
    /// HERE so the lane cannot disagree with the row about which questions are still waiting.
    ///
    /// The offers come from `offers(in:)` rather than the bare labels, because the row sets each
    /// one behind its NUMBER in the marker column — so the lane needs the same numbers to place
    /// them.
    var card: MinimapAskCard {
        MinimapAskCard(
            questions: questions.map { question in
                MinimapAskCard.Question(
                    text: question.text,
                    offers: offers(in: question).map {
                        MinimapAskCard.Offer(marker: $0.marker, label: $0.label)
                    },
                )
            },
            ink: ink,
            // Off the same reading the ROW's ground is, not off `isPending`: a lane still ruled
            // beside a question nobody here can answer is the map disagreeing with the reading.
            isRuled: ink == .attention,
        )
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
