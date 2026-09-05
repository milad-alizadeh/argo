import Foundation

/// A row's own words with every recognised Ticket URL said the way Argo says a Ticket (#1178).
///
/// It rewrites the agent's MARKDOWN rather than the typeset, and that is what keeps the change to
/// one line: a `[#1175: title](url)` is a link the rest of the feed already draws, hit-tests, reads
/// out to VoiceOver and reaches by keyboard. Nothing downstream of here learns a new span kind.
///
/// The record itself is untouched. This is a READING of a row's words, taken where the row is drawn
/// and where it is measured — `FeedRow`'s projection stays verbatim, and so does what the copy chip
/// hands over.
///
/// Pure, and asked per visible row per body pass rather than cached. The guard is the whole reason
/// that is affordable: a row with no `://` in it and a Project with no Ticket provider bound both
/// return the string they were handed, unexamined.
enum FeedTicketProse {
    /// What every URL the agent typed begins with. The `//` is in it deliberately — a bare `http:`
    /// is not a link the markdown reader makes.
    private static let scheme = "://"
    /// A fence's own opener, either spelling. A line beginning with one puts the reading inside
    /// code, where a URL is a URL and nothing is reworded.
    private static let fences = ["```", "~~~"]

    static func worded(_ text: String, as links: FeedTicketLinks) -> String {
        guard links.readsAny, text.contains(scheme) else { return text }
        var fenced = false
        var lines: [String] = []
        for line in text.split(separator: "\n", omittingEmptySubsequences: false) {
            let opener = fences.contains { line.trimmingCharacters(in: .whitespaces).hasPrefix($0) }
            if opener {
                fenced.toggle()
            }
            lines.append(opener || fenced ? String(line) : worded(line: line, as: links))
        }
        return lines.joined(separator: "\n")
    }

    /// One line, its inline code spans left alone.
    ///
    /// Split on the backtick rather than walked: a span is code because it was WRITTEN between
    /// backticks, which is the same rule `MarkedProse` reads them by, and the odd pieces of that
    /// split are exactly the insides. Joined back with the character it was split on, so a line
    /// with nothing to reword comes back byte for byte.
    private static func worded(line: Substring, as links: FeedTicketLinks) -> String {
        line.split(separator: "`", omittingEmptySubsequences: false)
            .enumerated()
            .map { at, span in at.isMultiple(of: 2) ? worded(span: span, as: links) : String(span) }
            .joined(separator: "`")
    }

    /// One stretch of ordinary prose, every recognised URL in it replaced by its Ticket's words.
    private static func worded(span: Substring, as links: FeedTicketLinks) -> String {
        var reworded = ""
        var copied = span.startIndex
        var at = span.startIndex
        while at < span.endIndex {
            guard opensALink(span, at: at), let link = link(in: span, from: at),
                  let words = links.words(of: link.url)
            else {
                at = span.index(after: at)
                continue
            }
            reworded += span[copied ..< at] + "[\(escaped(words))](\(link.text))"
            copied = link.end
            at = link.end
        }
        return reworded + span[copied...]
    }
}
