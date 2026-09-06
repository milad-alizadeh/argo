@testable import ArgoUI

/// The rule `docs/designs/cockpit-backlog-question.md` PROPOSED and called untested: *ends in a
/// question mark, or six words and up.* #1316 tested it against `BacklogQueryIntentCorpus`,
/// returned FAIL, and reopened the design.
///
/// It lives here, in the test target, rather than beside the shipped rule: nothing draws on it and
/// nothing may. Its only remaining job is to make #1316's verdict re-runnable — a superseded rule
/// deleted outright turns the evidence into a sentence somebody has to trust, and this repo's
/// answer to that is to keep the measurement and not the prose.
enum BacklogQueryIntentSupersededRule {
    /// A trailing `?` decided on its own, and below that six words was the floor.
    static func kind(of query: String) -> BacklogQueryIntentProjection.Kind {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasSuffix("?") {
            return .question
        }
        return trimmed.split(whereSeparator: \.isWhitespace).count >= 6 ? .question : .term
    }

    /// How many times the superseded rule changed its answer while `query` was typed — the number
    /// that failed it, measured the same way `BacklogQueryIntentProjection.flips(typing:)` measures
    /// the shipped one, so the two are comparable.
    static func flips(typing query: String) -> Int {
        let kinds = BacklogQueryIntentProjection.prefixes(of: query).map(kind(of:))
        return zip(kinds, kinds.dropFirst()).filter { $0 != $1 }.count
    }
}
