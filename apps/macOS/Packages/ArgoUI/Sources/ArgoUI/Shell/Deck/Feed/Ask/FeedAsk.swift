import ArgoEngine

/// A question put to somebody, as the feed draws it: what was asked, what was offered, and which
/// way it went. Holds the engine's `Ask` whole, since every word of it is carried verbatim.
///
/// A pending question is the only attention-coloured thing in the feed; an answered one is history.
package struct FeedAsk: Equatable, Sendable {
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
    /// How Argo knows this question was put (`CONTEXT.md`, "Honesty tier"): `derived` for one read
    /// out of the record, `direct` for the one Argo's own gate is holding, and `convention` for one
    /// the agent REPORTED over the companion plugin (#1205).
    ///
    /// Only `convention` changes what the row draws, and it changes it twice: the row says where
    /// the question came from, and it never offers a card. Argo answered that call `Recorded` the
    /// moment it arrived, so there is no held reply a press could reach — an affordance there would
    /// be exactly the one that cannot work.
    ///
    /// A `var` set at each of the three construction sites rather than a fifth initializer
    /// parameter, which the cap forbids (`apps/macOS/.swiftlint.yml`). `derived` is the default
    /// because it is the lowest of the three: a row nobody stated a tier for is never a false
    /// `direct`.
    private(set) var tier: Tier = .derived

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

    /// The same question told something new about answering it. On `FeedAsk` rather than in the
    /// projection that calls it, so what a row KEEPS across that swap is settled once, here,
    /// beside the fields it keeps — a rebuild at the call site drops a new field silently.
    func offered(_ offer: FeedAskProjection.Asking) -> Self {
        FeedAsk(ask: ask, isAnswered: isAnswered, answer: answer, offer: offer).known(via: tier)
    }

    /// The same question at a stated tier. Spelled here beside `offered`, which rebuilds the row
    /// and would otherwise drop the tier silently — the trap that comment names, closed.
    func known(via tier: Tier) -> Self {
        var stated = self
        stated.tier = tier
        return stated
    }

    /// Whether the row states where the question came from — true only where Argo did not read it
    /// off the record or hold it at its own gate, which is what makes it not a row Argo owns.
    var isReported: Bool {
        tier == .convention
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

    /// The three shapes a question row takes. Answered HERE so the row, its arithmetic height and
    /// the overview lane cannot disagree about which one a question is in (#1207).
    enum Reading {
        /// Argo is holding the question open, so the row is the thing you press.
        case waiting
        /// Nobody has answered it and nothing here can reach it: a Session Argo cannot drive
        /// (#546), a gate that has not raised it yet, one reported over the plugin (#1205).
        case pending
        /// The record has settled it.
        case settled
    }

    var reading: Reading {
        if isWaiting {
            return .waiting
        }
        return isAnswered ? .settled : .pending
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

    /// Whether the card draws a ground at all — and so whether it has anything to hold its words
    /// off. Read off the same ink the ground is, so the row, its height and the lane cannot
    /// disagree about which cards are inset (#1207).
    var hasGround: Bool {
        ink == .attention
    }

    /// The options of one question, numbered, in the order they were offered. Drawn while the row
    /// is waiting or pending; a settled row draws `answered(_:)` instead (#1207).
    func offers(in question: Ask.Question) -> [FeedAskOffer] {
        FeedAskOffer.numbered(question.options, chosen: chosen(in: question))
    }

    /// The way one question went, as the settled row draws it (#1207). `nil` where the record has
    /// not settled this ask, and where nothing readable came back.
    ///
    /// The option's own label where the answer named one, and the record's prose where it named
    /// none — a free-form ask, or an answer that agreed with nothing on the list.
    ///
    /// The prose stands in only where the call put ONE question, because a call's answer is one
    /// payload covering every question in it: under each of two it would draw one fact twice. A
    /// question of a longer call that named no option draws nothing — degrade-down takes the
    /// quieter reading.
    func answered(_ question: Ask.Question) -> FeedAskAnswer.Words? {
        guard isAnswered else { return nil }
        if let chosen = chosen(in: question) {
            return FeedAskAnswer.Words(words: chosen, isChosen: true)
        }
        guard questions.count == 1, let answer, !answer.trimmed.isEmpty else { return nil }
        return FeedAskAnswer.Words(words: answer, isChosen: false)
    }

    /// The card as the overview lane draws it: the same words at the same indents, and the ink
    /// read HERE so the lane cannot disagree with the row about which questions are still waiting.
    ///
    /// The lane folds with the row or the map stops matching the column (#1207): a settled
    /// question lays its answer where the map used to lay a line per option.
    var card: MinimapAskCard {
        MinimapAskCard(
            questions: questions.map { question in
                MinimapAskCard.Question(text: question.text, under: laneReading(of: question))
            },
            // The row's own caption, so the lane says the same thing about the channel the row
            // does — and takes the same height for saying it.
            caption: isReported ? FeedAskLine.reportedWords : nil,
            ink: ink,
            // Off the same reading the ROW's ground is, not off `isPending`: a lane still ruled
            // beside a question nobody here can answer is the map disagreeing with the reading.
            isRuled: ink == .attention,
        )
    }

    /// What the lane lays under one question — the same fork the row draws on.
    private func laneReading(of question: Ask.Question) -> MinimapAskCard.Question.Under {
        switch reading {
        case .waiting, .pending:
            let offered = offers(in: question).map {
                MinimapAskCard.Offer(marker: $0.marker, label: $0.label)
            }
            return offered.isEmpty ? .nothing : .offered(offered)
        case .settled:
            return answered(question).map { .answered($0.words) } ?? .nothing
        }
    }

    /// Which of the offered options the answer named, or `nil`.
    ///
    /// DERIVED and deliberately weak: the answer is prose, not a field naming an option, so the
    /// reading is that the answer CONTAINS the label. Nothing is chosen where no option is named.
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
