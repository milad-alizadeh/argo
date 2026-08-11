import ArgoEngine

/// A question the agent asked, plus whatever answered it, as the row the feed draws. The two are
/// separate records that can sit arbitrarily far apart in the file, and the absence of the second
/// is the point — an unanswered question is the only thing in the feed entitled to attention ink.
enum FeedAskReading {
    /// `nil` where this call put no question, which is every call but one tool's. A call NAMED
    /// `AskUserQuestion` whose input carried nothing readable also lands here: it stays an ordinary
    /// call line, because a question with no words is not a question the feed can put to anybody.
    static func asked(_ call: ToolCall, answeredBy outcome: ToolCallOutcome?) -> FeedAsk? {
        guard let ask = call.ask else { return nil }
        return FeedAsk(ask: ask, isAnswered: hasAnswered(outcome), answer: answer(in: outcome))
    }

    /// Whether the record has answered the question — the result EXISTING and being resolved, not
    /// what it carried. A result still in flight has settled nothing; one that came back holding
    /// something unreadable has.
    private static func hasAnswered(_ outcome: ToolCallOutcome?) -> Bool {
        guard let outcome else { return false }
        return outcome.status != .pending && outcome.status != .inProgress
    }

    /// What came back, verbatim, where anything readable did. This is what the chosen option is
    /// read from, and nothing else is.
    private static func answer(in outcome: ToolCallOutcome?) -> String? {
        guard case let .output(output) = outcome?.result else { return nil }
        return output.text
    }
}
