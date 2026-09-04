import ArgoEngine

extension FeedProjection {
    /// The question Argo's own gate is holding, where no row above is drawing it (#1190).
    ///
    /// The two sides arrive independently: Argo holds the question the moment the hook does, and
    /// the CLI writes the call whenever it writes it. Without this the roster says `Needs input`
    /// at DIRECT over a reading with nothing in it to answer — and the gap is not only the window
    /// before the record catches up, since a Turn that ends drops the question from the record's
    /// side while the gate goes on holding it.
    ///
    /// Beside the stream rather than in it, and at the foot of the work: the hook payload names no
    /// record id, so there is no row it can be placed relative to and the newest moment of the
    /// reading is the only honest position left.
    static func standing(
        _ asking: FeedAskProjection.Asking,
        over rows: [FeedRow.Content],
    )
        -> [FeedRow.Content] {
        guard let live = asking.live, !rows.contains(where: isDrawingLiveAsk) else { return [] }
        return [.ask(FeedAsk(ask: live.ask, isAnswered: false, answer: nil, offer: asking))]
    }

    /// Whether `offering` already handed the gate's question to a row of the record's own.
    private static func isDrawingLiveAsk(_ content: FeedRow.Content) -> Bool {
        guard case let .ask(ask) = content else { return false }
        return ask.live != nil
    }

    /// What every ask row is told about answering (#712). Over the WHOLE feed rather than per row,
    /// because both facts are about the feed a row sits in: whether this Session can be driven at
    /// all reaches every ask row, and the gate's live question reaches exactly one.
    ///
    /// The LAST match wins. Two identical questions in one Session both match by value — there is
    /// no id either side shares — and the newest is the one still waiting.
    static func offering(
        _ contents: [FeedRow.Content],
        _ asking: FeedAskProjection.Asking,
    )
        -> [FeedRow.Content] {
        let held = contents.lastIndex { waits(for: asking.live, $0) }
        return contents.enumerated().map { position, content in
            guard case let .ask(ask) = content else { return content }
            return .ask(FeedAsk(
                ask: ask.ask,
                isAnswered: ask.isAnswered,
                answer: ask.answer,
                offer: FeedAskProjection.Asking(
                    live: position == held ? asking.live : nil,
                    isDriveable: asking.isDriveable,
                ),
            ))
        }
    }

    private static func waits(
        for live: FeedAskProjection.Live?,
        _ content: FeedRow.Content,
    )
        -> Bool {
        guard case let .ask(ask) = content else { return false }
        return ask.isPending && FeedAskProjection.matches(live, ask.ask)
    }

    /// The question a call put, where it put one. Read BEFORE the call line, because a question is
    /// not work: drawn as `Called AskUserQuestion` it says the mechanism and never what was asked.
    static func asked(
        _ call: ToolCall,
        answeredBy outcomes: [String: ToolCallOutcome],
    )
        -> FeedRow.Content? {
        FeedAskReading.asked(call, answeredBy: outcomes[call.id]).map(FeedRow.Content.ask)
    }
}
