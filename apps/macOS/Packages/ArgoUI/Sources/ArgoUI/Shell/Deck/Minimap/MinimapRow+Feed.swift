import Foundation

// A feed row read as the shapes the lane draws it with (#382). The one place the miniature's
// vocabulary meets the feed's, and the reason the lane reads as the reading shrunk rather than as a
// legend beside it: every span here is the row's own alignment, and every ink is the row's own.

extension MinimapRow {
    /// One feed row as the lane draws it, at the height the table measured for it across `measure`
    /// points of column.
    init(_ row: FeedRow, height: CGFloat, measure: CGFloat) {
        self.init(height: height)
        runs = MinimapRow.runs(of: row.content, height: height, measure: measure)
        if case let .prompt(text) = row.content {
            prompt = text
        }
        endsTurn = row.content.endsTurn
    }

    private static func runs(
        of content: FeedRow.Content,
        height: CGFloat,
        measure: CGFloat,
    )
        -> [MinimapRun] {
        let lines = MinimapRuns.lines(inside: height)
        switch content {
        // The one row that is a SHAPE in the feed rather than lines of text: a filled bubble on the
        // trailing edge. Drawn here the way it is read there — one solid block, as wide as the
        // words made the bubble and no wider than the bubble may run.
        case let .prompt(text):
            let width = min(
                ArgoFeedRow.bubbleShare, MinimapRuns.fill(of: text.count, across: measure),
            )
            return [MinimapRun(ink: .prompt, line: 0, span: (1 - width) ... 1)]
        case let .message(text):
            return MinimapRuns.leading(MinimapRuns.fills(of: text.count, over: lines), .message)
        case let .thought(text):
            return MinimapRuns.leading(MinimapRuns.fills(of: text.count, over: lines), .thought)
        case let .call(call):
            return call.runs(across: measure)
        case let .survey(survey):
            return [sentence(survey.spoken, in: .command, across: measure)]
        case let .unreadable(unreadable):
            return [sentence(unreadable.label, in: .unreadable, across: measure)]
        // Three rows the lane draws as a shape rather than as a length. A gallery is a container, a
        // question is the one thing that crosses the whole lane, and a mark is a rule — none of
        // them is a sentence running out across the column, so none takes a sentence's width.
        case .gallery:
            return [MinimapRun(ink: .media, line: 0, span: 0 ... 1)]
        case .ask:
            return [MinimapRun(ink: .attention, line: 0, span: 0 ... 1)]
        case .mark:
            return [MinimapRun(ink: .boundary, line: 0, span: 0 ... 1)]
        }
    }

    private static func sentence(
        _ words: String,
        in ink: MinimapInk,
        across measure: CGFloat,
    )
        -> MinimapRun {
        MinimapRun(
            ink: ink,
            line: 0,
            span: 0 ... MinimapRuns.fill(of: words.count, across: measure),
        )
    }
}

private extension FeedRow.Content {
    /// Whether a Turn ends at this row. The feed's own punctuation and nothing else: the stop
    /// reason the host reported, and the interruption that stands in for one.
    ///
    /// Switched with no `default`, so a mark added to the feed has to say whether it closes a Turn
    /// rather than inheriting an answer written for the ones that exist today.
    var endsTurn: Bool {
        guard case let .mark(mark) = self else { return false }
        switch mark {
        case .turnEnded, .interrupted: return true
        case .compacted, .spent, .handedOff, .permissionExpired, .working: return false
        }
    }
}

private extension FeedCall {
    /// A call as the lane draws it: one slab for the sentence, and the mutation's two halves at the
    /// end of it where the record carried a patch to count — which is exactly where the row itself
    /// draws `+n −n`.
    func runs(across measure: CGFloat) -> [MinimapRun] {
        let sentence = MinimapRuns.fill(of: spoken.count, across: measure)
        guard let churn, !churn.isSilent else {
            return [MinimapRun(ink: .command, line: 0, span: 0 ... sentence)]
        }
        let share = ArgoMinimapLane.churnShare
        let head = max(0, min(sentence, 1 - share))
        let split = head + share * CGFloat(churn.added) / CGFloat(churn.added + churn.removed)
        return [
            MinimapRun(ink: .command, line: 0, span: 0 ... head),
            MinimapRun(ink: .added, line: 0, span: head ... split),
            MinimapRun(ink: .removed, line: 0, span: split ... head + share),
        ]
    }
}
