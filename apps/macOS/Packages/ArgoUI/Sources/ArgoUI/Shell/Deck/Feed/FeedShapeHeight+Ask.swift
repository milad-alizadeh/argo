import ArgoDesign
import ArgoEngine
import CoreGraphics
import ProseText

// A question, at the height its card stands — one shape per `FeedAsk.Reading` (#1207), which is
// the fork `FeedAskLine` draws on.

extension FeedShapeHeight {
    /// The card: every question inside it, and the card's own breathing room.
    func asked(_ ask: FeedAsk) -> CGFloat {
        // Only a card with a ground is inset: with none there is nothing to hold the words off, and
        // the row sets flush with the reading above it (#1207).
        let inset = ask.hasGround ? ArgoFeedRow.askCardInset : 0
        let inside = measure - inset * 2
        guard inside > 0 else { return 0 }
        let questions = ask.questions.map { question(ask, asking: $0, across: inside) }
        let parts = questions + [reported(ask, across: inside)].compactMap(\.self)
        return Self.stacked(parts, step: ArgoFeedRow.blockStep) + inset * 2
    }

    /// The caption a question that arrived over the companion plugin carries, and `nil` for every
    /// row that does not — one line of the meta rung on the marker grid (`FeedAskLine.reported`).
    private func reported(_ ask: FeedAsk, across inside: CGFloat) -> CGFloat? {
        guard ask.isReported else { return nil }
        // The caption's OWN face and no body-line floor under it: the glyph beside it is drawn
        // inline, so it sets its height from the words rather than the other way round.
        return Self.unleaded(
            FeedAskLine.reportedWords,
            in: ProseFace(rung: ArgoTypography.rowMeta.rung),
            across: inside - Self.markerIndent,
        )
    }

    /// One question: its words on whichever column its glyph takes, and whatever stands under
    /// them.
    private func question(_ ask: FeedAsk, asking question: Ask.Question, across inside: CGFloat)
        -> CGFloat {
        let step = ask.reading == .waiting ? ArgoSpacing.comfortable : ArgoFeedRow.stepBeforeProse
        let asked = ask.reading == .settled
            ? Self.symbolLine(question.text, across: inside)
            : Self.gridLine(question.text, across: inside)
        return Self.stacked(
            [asked, under(ask, question, across: inside)].compactMap(\.self),
            step: step,
        )
    }

    /// What stands under one question, per `FeedAsk.reading`. `nil` where the reading draws
    /// nothing at all: a pending question that offered none, and a settled one nothing readable
    /// answered.
    private func under(_ ask: FeedAsk, _ question: Ask.Question, across inside: CGFloat)
        -> CGFloat? {
        switch ask.reading {
        case .waiting:
            held(question, across: inside)
        case .pending:
            listed(ask.offers(in: question), across: inside)
        case .settled:
            // One line on the glyph column, the same one the question above it takes.
            ask.answered(question).map { Self.symbolLine($0.words, across: inside) }
        }
    }

    /// The options as they were offered, one per line on the same grid — `FeedAskOptions`. `nil`
    /// where the question offered none, which draws nothing at all.
    private func listed(_ offers: [FeedAskOffer], across inside: CGFloat) -> CGFloat? {
        guard !offers.isEmpty else { return nil }
        return Self.stacked(
            offers.map { Self.gridLine($0.label, across: inside) },
            step: ArgoFeedRow.askOptionGap,
        )
    }

    /// One line of the marker grid: the words beside the column their mark sits in, never shorter
    /// than that column's own line.
    static func gridLine(_ text: String, across inside: CGFloat) -> CGFloat {
        max(bodyLine, unleaded(text, in: .body, across: inside - markerIndent))
    }

    /// How far the words on that grid are held off the leading edge — the mark's own column and the
    /// gap after it, which is the pair `FeedMarker` and `feedMarkerColumn()` draw.
    static var markerIndent: CGFloat {
        ArgoFeedRow.markerWidth + ArgoFeedRow.markerGap
    }

    /// One line on the GLYPH column instead — what a settled question and its answer take, and what
    /// every verb in the feed takes (`feedSymbolColumn()`).
    static func symbolLine(_ text: String, across inside: CGFloat) -> CGFloat {
        max(bodyLine, unleaded(text, in: .body, across: inside - symbolIndent))
    }

    /// The glyph column and the gap after it — `feedSymbolColumn()` and `ArgoFeedRow.callGap`.
    static var symbolIndent: CGFloat {
        ArgoFeedRow.callSymbolWidth + ArgoFeedRow.callGap
    }
}

extension FeedShapeHeight {
    /// What a question Argo is holding open draws under it: the cards, the way out of them, and the
    /// field that closes the act — `FeedAskOfferList`, indented under the question's words.
    private func held(_ question: Ask.Question, across inside: CGFloat) -> CGFloat? {
        let column = inside - Self.markerIndent
        guard column > 0 else { return nil }
        let cards = question.options.indices.map { Self.card(question, at: $0, across: column) }
        let other = question.options.isEmpty || question.allowsMultiple
            ? nil
            : Self.bodyLine + ArgoSpacing.base * 2
        let answer = question.allowsMultiple || question.options.isEmpty
            ? ArgoComposerVessel.decisionHeight
            : nil
        let rows = cards + [other, answer].compactMap(\.self)
        return rows.isEmpty ? nil : Self.stacked(rows, step: ArgoSpacing.snug)
    }

    /// One pressable option: its label, the line under it where the host offered one, and the
    /// card's own padding — `FeedAskOfferRow`.
    private static func card(_ question: Ask.Question, at ordinal: Int, across column: CGFloat)
        -> CGFloat {
        let option = question.options[ordinal]
        let box = question.allowsMultiple ? ArgoComposerVessel.askBoxSize + ArgoFeedRow
            .markerGap : 0
        let words = column - ArgoSpacing.comfortable * 2 - markerIndent - box
        let label = unleaded(option.label, in: .body, across: words)
        // A tick box taller than the line's own ascent hangs below the baseline it is aligned to,
        // and the row grows by exactly what hangs — see `ProseBaseline`.
        let ticked = question.allowsMultiple
            ? ArgoComposerVessel.askBoxSize + ProseBaseline.under(.body)
            : 0
        let detail = option.detail.map {
            ArgoFeedRow.stepBeforeProse
                + unleaded($0, in: ProseFace(rung: ArgoTypography.rowMeta.rung), across: words)
        }
        return max(bodyLine, ticked, label + (detail ?? 0)) + ArgoSpacing.base * 2
    }
}
