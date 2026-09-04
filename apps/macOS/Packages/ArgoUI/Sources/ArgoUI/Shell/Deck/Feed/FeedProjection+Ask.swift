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
        // DIRECT: both ends of the hook this came up are Argo's own, which is what entitles the row
        // to the cards below it.
        return [.ask(
            FeedAsk(ask: live.ask, isAnswered: false, answer: nil, offer: asking)
                .known(via: .direct),
        )]
    }

    /// The question the agent REPORTED over the companion plugin, at the foot of the work (#1205).
    ///
    /// A seam of its own beside `standing`, not a second way into it, because the two are answered
    /// by different acts. `standing`'s question is one Argo's own gate is HOLDING: the hook is
    /// blocked, the answer goes back down the socket it came up, and the row is the thing you
    /// press. This one arrived as an MCP call Argo answered `Recorded` the moment it landed — there
    /// is no held reply left to reach, so the row states the question and the reader answers where
    /// an answer can actually go, which is the composer.
    ///
    /// It is drawn at CONVENTION and says so, because degrade-down forbids a row Argo does not own
    /// being indistinguishable from one it does.
    ///
    /// `offer` carries the feed's own driveability and no live handle: the ink means *this is
    /// waiting on YOU*, and on a Session nothing can reach it is not — the same rule every ask row
    /// beside it takes (#546).
    ///
    /// Drawn only where no row above is already putting these words, on `standing`'s own ground and
    /// by the same value match (#1203): two cards asking the same thing would put one question to
    /// the reader twice, and — since `FeedAsk.identity` is what was asked — hand the recycled table
    /// two rows under one id. The gate's copy is the one that survives, being the one that can be
    /// answered where it stands.
    static func reported(
        _ ask: Ask?,
        _ asking: FeedAskProjection.Asking,
        over rows: [FeedRow.Content],
    )
        -> [FeedRow.Content] {
        guard let ask, !rows.contains(where: { isPendingAsk(of: ask, $0) }) else { return [] }
        return [.ask(
            FeedAsk(
                ask: ask,
                isAnswered: false,
                answer: nil,
                offer: FeedAskProjection.Asking(live: nil, isDriveable: asking.isDriveable),
            )
            .known(via: .convention),
        )]
    }

    /// Whether `offering` already handed the gate's question to a row of the record's own.
    private static func isDrawingLiveAsk(_ content: FeedRow.Content) -> Bool {
        guard case let .ask(ask) = content else { return false }
        return ask.live != nil
    }

    /// Whether a row is already putting these exact words and still waiting on them. An ANSWERED
    /// row asking the same thing is history, and history does not stand for a question being asked
    /// now.
    private static func isPendingAsk(of ask: Ask, _ content: FeedRow.Content) -> Bool {
        guard case let .ask(drawn) = content else { return false }
        return drawn.isPending && drawn.ask == ask
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
            return .ask(ask.offered(FeedAskProjection.Asking(
                live: position == held ? asking.live : nil,
                isDriveable: asking.isDriveable,
            )))
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
