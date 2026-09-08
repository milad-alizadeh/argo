import Foundation

/// A settled `AskUserQuestion`'s result → what it says about ONE of the questions it answered.
///
/// #1207 read a call's result as one payload covering every question in it. It is not: both
/// writers name each question and put its answer beside it, so a question of a longer call can be
/// spoken for and a typed answer to one of four is drawable rather than lost (#1664).
///
/// Two writers, two spellings, both read off a source opened for #1664:
///
/// - **The CLI's own picker** writes `"question"="answer"` pairs, comma joined, under a
///   `Your questions have been answered:` head and above a `You can now continue…` tail.
///   `ArgoEngineTests/Fixtures/askOffered.jsonl` carries a one-question result without that tail,
///   and a two-question one read out of a real transcript on 2026-09-08 carries both: `… "The
///   session's worktree directory is missing…"="Exit worktree, keep, then re-enter", "Which
///   ticket am I implementing?"="1681". You can now continue with these answers in mind.`
/// - **Argo's own gate** writes `question → answer` segments joined by ` · ` after a head naming
///   itself, because an answered ask is a `PreToolUse` deny whose reason IS the answer
///   (`AskReply.reason`) and a deny reason arrives as the tool result verbatim.
///
/// Keyed on the question's own verbatim words, which is the only handle either spelling offers —
/// no id crosses the two sides, the same reason `FeedAskProjection.matches` matches by value.
///
/// DERIVED, and every read is anchored at both ends: a segment this cannot close names nothing, so
/// a payload neither spelling fits falls back to the whole blob and degrade-down draws nothing
/// rather than a guess.
enum FeedAskResultReading {
    /// What the result says this question was answered with, or `nil` where it did not name it.
    static func said(about question: String, in result: String) -> String? {
        quoted(question, in: result) ?? arrowed(question, in: result)
    }

    /// `"question"="answer"` — the answer runs to the quote that closes the pair, which is the
    /// first one the writer follows with a `,` or the sentence's own full stop. Anchored that way
    /// because typed words may quote something themselves, and stopping at the first `"` inside
    /// them would draw half a sentence as the whole answer.
    private static func quoted(_ question: String, in result: String) -> String? {
        guard let opened = result.range(of: "\"\(question)\"=\"") else { return nil }
        let rest = result[opened.upperBound...]
        var searched = rest.startIndex
        while let quote = rest[searched...].firstIndex(of: "\"") {
            let after = rest.index(after: quote)
            guard after < rest.endIndex, rest[after] != ",", rest[after] != "." else {
                return words(rest[..<quote])
            }
            searched = after
        }
        return nil
    }

    /// `question → answer` — the answer runs to the next segment, or to the end of the line, and
    /// the segment's own leading ` · ` opens it.
    ///
    /// Anchored at the front as well, because a bare search finds the FIRST match: a question
    /// whose words end another question's ("what should the branch be called?" inside "and what
    /// should the branch be called?") would otherwise read its neighbour's answer as its own.
    /// `AskReply.reason` puts a head before every segment, so each one has a ` · ` to open it.
    private static func arrowed(_ question: String, in result: String) -> String? {
        let segment = "\(Self.betweenAnswers)\(question)\(Self.beforeAnswer)"
        guard let opened = result.range(of: segment) else { return nil }
        let rest = result[opened.upperBound...]
        let ended = rest.range(of: Self.betweenAnswers)?.lowerBound ?? rest.endIndex
        return words(rest[..<ended])
    }

    /// `AskReply.reason`'s two marks, spelled here because the reader has to know what the writer
    /// put between the words. They live in `ArgoEngine` and are not exported; a change to either
    /// side without the other reads as a result that named no question.
    private static let beforeAnswer = " → "
    private static let betweenAnswers = " · "

    private static func words(_ said: Substring) -> String? {
        let said = String(said).trimmed
        return said.isEmpty ? nil : said
    }
}
