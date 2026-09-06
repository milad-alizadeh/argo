import Foundation

/// Whether a typed string reads as a TERM the backlog's own search answers, or a QUESTION the
/// field can offer to ask.
///
/// **This is not the rule `docs/designs/cockpit-backlog-question.md` proposed.** That one — *ends
/// in a question mark, or six words and up* — was tested by #1316 against
/// `BacklogQueryIntentCorpus` and FAILED on both of the risks the design itself named: 19 of 106
/// terms read as questions (every long pasted title crosses six words), and the leading glyph
/// changed its mind at least once for 51 of them. The superseded rule is kept in the test target
/// as `BacklogQueryIntentSupersededRule`, so the verdict that reopened the design stays checkable
/// rather than becoming a claim in a comment.
///
/// What replaced it reads the two things a reader actually types when they mean to ask: an
/// **interrogative opener**, and a **question mark that terminates words**. Length is not
/// consulted at all, which is what stops a pasted title from becoming a question by growing.
///
/// **Stability is structural here, not measured.** Both clauses are monotone over prefixes: an
/// opener is fixed the moment the first word is finished, and a mark that has been typed stays
/// typed. So the answer can go `.term → .question` and never back, for EVERY string — which is
/// the design's "the glyph changes once", proved rather than counted. `flips(typing:)` exists to
/// hold that property to the corpus.
package enum BacklogQueryIntentProjection {
    package enum Kind: Sendable, Equatable {
        case term
        case question
    }

    /// The interrogatives and the yes/no auxiliaries an English question opens on. A closed set,
    /// because the clause is only sound while it is one: a word admitted here turns every ticket
    /// title starting with it into a question, and titles are the corpus's largest group.
    ///
    /// Determiners are deliberately absent. `any ticket for 1293?` is a question, and it is caught
    /// by its mark — admitting `any` would cost every `any` in a title and buy nothing the mark
    /// does not already cover.
    private static let openers: Set<String> = [
        "am", "are", "can", "could", "did", "do", "does", "had", "has", "have", "how", "is",
        "should", "was", "were", "what", "what's", "whats", "when", "where", "which", "who",
        "who's", "whom", "whose", "why", "will", "would",
    ]

    /// What the field's leading glyph reads. `.question` on either clause, and the two are OR'd
    /// rather than ranked because they catch disjoint halves of the corpus: the opener catches
    /// the questions typed without a mark, and the mark catches the ones that open on a noun
    /// (`still open?`, `1075 fixed?`).
    package static func kind(of query: String) -> Kind {
        opensWithAnInterrogative(query) || marksAQuestion(query) ? .question : .term
    }

    /// Whether the FIRST word is an interrogative — and only once that word is **finished**.
    ///
    /// The completion test is the whole reason this clause is stable. Read without it, `island`
    /// passes through `is` on the way to being typed and the glyph fires and retracts inside one
    /// word, which is the flicker #1316 failed the old rule for. A word is finished when
    /// whitespace follows it, and from that character on the first word can never change again.
    private static func opensWithAnInterrogative(_ query: String) -> Bool {
        let leading = query.drop(while: \.isWhitespace)
        guard let finished = leading.firstIndex(where: \.isWhitespace) else { return false }
        return openers.contains(leading[leading.startIndex ..< finished].lowercased())
    }

    /// Whether a `?` in the string terminates **at least two words**.
    ///
    /// The two-word floor is what tells a question's mark from a URL's. `tickets?state=open` puts
    /// its mark after one unbroken run of characters; `still open?` puts it after two words. That
    /// one distinction is what took the corpus's three double-flipping query strings — the ones
    /// the old rule read as questions the instant the mark landed and un-read a character later —
    /// down to no flip at all.
    ///
    /// Every `?` is considered, not just a trailing one, because a trailing-only test is not
    /// monotone: the reader who types past their mark would watch the glyph go back.
    private static func marksAQuestion(_ query: String) -> Bool {
        query.indices.contains { index in
            query[index] == "?"
                && query[query.startIndex ..< index].split(whereSeparator: \.isWhitespace)
                .count >= 2
        }
    }

    /// Every prefix of `query`, shortest first — what a reader's field has actually shown, one
    /// character at a time, on the way to the string they finish on.
    package static func prefixes(of query: String) -> [String] {
        guard !query.isEmpty else { return [] }
        return (1 ... query.count).map { String(query.prefix($0)) }
    }

    /// How many times `kind` changes its answer while `query` is typed one character at a time.
    ///
    /// Under the rule above this is 0 or 1 for every string there is, and the suite asserts that
    /// over the whole corpus. It stays a function rather than becoming a comment because it is
    /// the guard on the property: a clause added here that reads the text as a whole — a length,
    /// a trailing character, a count of anything — breaks monotonicity, and this is what notices.
    package static func flips(typing query: String) -> Int {
        let kinds = prefixes(of: query).map(kind(of:))
        return zip(kinds, kinds.dropFirst()).filter { $0 != $1 }.count
    }
}
