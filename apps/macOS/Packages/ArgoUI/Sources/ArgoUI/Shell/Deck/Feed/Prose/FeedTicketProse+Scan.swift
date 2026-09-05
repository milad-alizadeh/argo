import Foundation

// Where a URL the agent typed starts and stops, mirrored off the markdown reader's own answer
// rather than guessed at: the boundaries below are the ones `AttributedString(markdown:)` autolinks
// by, so a run this rewords is exactly a run the feed already drew as a link (#1178).

extension FeedTicketProse {
    /// One URL as it was written. Where the words after it start again is `text.endIndex`, which
    /// is why the run is not carried as a range beside it.
    struct Link {
        var text: Substring
        var url: URL
    }

    /// The punctuation a sentence puts after a link and the reader never means as part of it. The
    /// markdown reader drops each of these too, so a link at the end of a sentence is one link
    /// either way.
    private static var sentencePunctuation: Set<Character> {
        [".", ",", ";", ":", "!", "?", "'", "\""]
    }

    /// What is escaped inside the link's own words. A Ticket's title is the provider's prose and
    /// may hold anything: an unescaped `]` would end the link on the title's own bracket, and an
    /// unescaped `*` would set half of it in italics.
    private static var escapes: Set<Character> {
        ["\\", "[", "]", "*", "_", "`"]
    }

    /// Whether a URL may START here: at the head of the stretch, after whitespace, or inside a
    /// bracket the reader opened — but never straight after `](`, which is a markdown link's own
    /// destination and already says what its words are.
    ///
    /// `<https://…>` is left alone for the same reason from the other side: it is an autolink whose
    /// angle brackets would still be around the rewritten words.
    static func opensALink(_ span: Substring, at index: String.Index) -> Bool {
        guard span[index...].hasPrefix("http") else { return false }
        guard index > span.startIndex else { return true }
        let opener = span.index(before: index)
        if span[opener].isWhitespace {
            return true
        }
        guard span[opener] == "(" else { return false }
        return opener == span.startIndex || span[span.index(before: opener)] != "]"
    }

    /// The URL starting at `from`, or nothing where the run is not one.
    ///
    /// It runs to the next whitespace and is then given back whatever the sentence around it lent
    /// it — the full stop, the comma, the bracket the reader opened before it.
    static func link(in span: Substring, from start: String.Index) -> Link? {
        let run = span[start...].prefix { !$0.isWhitespace }
        let text = trimmed(run)
        guard text.contains("://"), let url = URL(string: String(text)) else { return nil }
        return Link(text: text, url: url)
    }

    /// The link's own words, safe to set between brackets.
    static func escaped(_ words: String) -> String {
        String(words.flatMap { escapes.contains($0) ? ["\\", $0] : [$0] })
    }

    private static func trimmed(_ run: Substring) -> Substring {
        var text = run
        while let last = text.last, sentencePunctuation.contains(last) || closesNothing(
            last,
            in: text,
        ) {
            text = text.dropLast()
        }
        return text
    }

    /// Whether a trailing `)` closes a bracket the URL itself opened. It usually does not — the
    /// reader put the whole link in brackets — and a URL that genuinely carries a pair keeps it.
    private static func closesNothing(_ last: Character, in text: Substring) -> Bool {
        guard last == ")" else { return false }
        return text.count(where: { $0 == ")" }) > text.count(where: { $0 == "(" })
    }
}
