import Foundation

/// Whether a typed string reads as a TERM the backlog's own search answers, or a QUESTION the
/// field can offer to ask — the rule `docs/designs/cockpit-backlog-question.md` proposes and
/// calls untested: *ends in a question mark, or six words and up.*
///
/// Written down as its own seam because #1316 exists to settle one argument, not to build a
/// feature: is this rule stable enough that the leading glyph can swap on it without flickering
/// while a reader types. Nothing here draws — no UI takes this ticket.
package enum BacklogQueryIntentProjection {
    package enum Kind: Sendable, Equatable {
        case term
        case question
    }

    /// A trailing `?` decides on its own — a six-word term does not stop being one for having a
    /// stray mark at the end. Below that length, six words is what the design names, and nothing
    /// here rounds it: `unwrap the fold state` is five words and a term, `where did the fold
    /// state go` is six and a question, and the field has to pick a line somewhere.
    package static func kind(of query: String) -> Kind {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasSuffix("?") {
            return .question
        }
        let words = trimmed.split(whereSeparator: \.isWhitespace)
        return words.count >= 6 ? .question : .term
    }

    /// Every prefix of `query`, shortest first — what a reader's field has actually shown, one
    /// character at a time, on the way to the string they finish on. The rule's accuracy is
    /// judged on the last of these; its STABILITY is judged on all of them, because a glyph that
    /// is right at the end and wrong four times on the way there is worse than a glyph that is
    /// simply wrong.
    package static func prefixes(of query: String) -> [String] {
        guard !query.isEmpty else { return [] }
        return (1 ... query.count).map { String(query.prefix($0)) }
    }

    /// How many times `kind` changes its answer while `query` is typed one character at a time —
    /// the number the design calls "the real bar," separate from whether the final answer is
    /// right. A rule can be 100% accurate at the end and still fail this on every query with a
    /// `?` in the middle.
    package static func flips(typing query: String) -> Int {
        let kinds = prefixes(of: query).map(kind(of:))
        return zip(kinds, kinds.dropFirst()).filter { $0 != $1 }.count
    }
}
