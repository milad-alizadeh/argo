/// The record's answer to one `AskUserQuestion`, read one question at a time.
///
/// #1207 took a call's answer for ONE payload covering every question in it. It is not: both
/// writers name each question and put its answer beside it, so a question of a longer call can be
/// spoken for and a typed answer to one of four is drawable rather than lost (#1664).
///
/// Two writers, two spellings. Claude Code's own picker writes `"question"="answer"` pairs, comma
/// joined, under a `Your questions have been answered:` head — `askOffered.jsonl` carries one.
/// Argo's own gate writes `question → answer` segments joined by ` · `, because an answered ask is
/// a `PreToolUse` deny whose reason IS the answer (`AskReply.reason`) and a deny reason arrives as
/// the tool result verbatim.
///
/// Keyed on the question's own verbatim words, which is the only handle either spelling offers —
/// no id crosses the two sides, the same reason `FeedAskProjection.matches` matches by value.
/// DERIVED: this is a reading of somebody else's prose, so a payload neither spelling fits names
/// nothing, and degrade-down draws nothing rather than a guess.
enum FeedAskAnswers {
    /// What the record says this question was answered with, or `nil` where it did not name it.
    static func said(about question: String, in answer: String) -> String? {
        quoted(question, in: answer) ?? arrowed(question, in: answer)
    }

    /// `"question"="answer"` — the answer runs to the quote that closes it.
    private static func quoted(_ question: String, in answer: String) -> String? {
        guard let opened = answer.range(of: "\"\(question)\"=\""),
              let closed = answer[opened.upperBound...].firstIndex(of: "\"")
        else { return nil }
        return words(answer[opened.upperBound ..< closed])
    }

    /// `question → answer` — the answer runs to the next segment, or to the end of the line. One
    /// line always: the socket frames on newlines, so `AskReply` never writes a second.
    private static func arrowed(_ question: String, in answer: String) -> String? {
        guard let opened = answer.range(of: "\(question)\(Self.beforeAnswer)") else { return nil }
        let rest = answer[opened.upperBound...]
        let ended = rest.range(of: Self.betweenAnswers)?.lowerBound ?? rest.endIndex
        return words(rest[..<ended])
    }

    /// `AskReply.reason`'s two marks, spelled here because the reader has to know what the writer
    /// put between the words. They live in `ArgoEngine` and are not exported; a change to either
    /// side without the other reads as a record that named no question.
    private static let beforeAnswer = " → "
    private static let betweenAnswers = " · "

    private static func words(_ said: Substring) -> String? {
        let said = String(said).trimmed
        return said.isEmpty ? nil : said
    }
}
