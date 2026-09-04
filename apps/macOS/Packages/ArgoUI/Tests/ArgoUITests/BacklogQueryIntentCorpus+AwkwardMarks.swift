@testable import ArgoUI

extension BacklogQueryIntentCorpus {
    /// Long or mark-bearing, and NOT actually questions — the half of the awkward middle carrying
    /// a literal `?` or a real question's own wording, without being one.
    static let awkwardMiddle: [Entry] = urlQueries + longTerms + shortQuestions + embeddedMarks
        + titleShapedNoMark + numbersWithContext

    /// URLs and paths with a literal `?` that is not a question mark — the case that flips the
    /// glyph TWICE: into `.question` at the mark, back to `.term` once more text follows it.
    private static let urlQueries: [Entry] = [
        Entry(
            query: "https://api.example.com/tickets?state=open",
            expected: .term, group: "awkward: url query",
        ),
        Entry(
            query: "grafana.internal/d/api-latency?from=now-6h",
            expected: .term, group: "awkward: url query",
        ),
        Entry(
            query: "argo.internal/tickets?assignee=me&state=open",
            expected: .term, group: "awkward: url query",
        ),
    ]

    /// A short question the six-word floor misses on its own — a real false negative unless it
    /// carries its own `?`, which every one of these does.
    private static let shortQuestions: [Entry] = [
        Entry(query: "is 1242 done?", expected: .question, group: "awkward: short question"),
        Entry(query: "who owns this?", expected: .question, group: "awkward: short question"),
        Entry(query: "why blocked?", expected: .question, group: "awkward: short question"),
        Entry(query: "still open?", expected: .question, group: "awkward: short question"),
        Entry(query: "any ticket for 1293?", expected: .question, group: "awkward: short question"),
        Entry(query: "swift gate flaky?", expected: .question, group: "awkward: short question"),
        Entry(query: "1075 fixed?", expected: .question, group: "awkward: short question"),
    ]

    /// A pasted quote or title carrying an internal `?`, ending as a term — the reader is talking
    /// ABOUT a question, not asking one.
    private static let embeddedMarks: [Entry] = [
        Entry(
            query: "renamed \"what happened to the ordering menu?\" to a clearer title",
            expected: .term, group: "awkward: embedded mark",
        ),
        Entry(
            query: "the ticket titled is there a ticket for the fold bug got closed",
            expected: .term, group: "awkward: embedded mark",
        ),
        Entry(
            query: "1293 asks what state is it in but is actually closed now",
            expected: .term, group: "awkward: embedded mark",
        ),
    ]

    /// A ticket title that reads like a question in its own wording, with no mark and under six
    /// words — a genuine hard case the corpus still calls a TERM, since a pasted title is what the
    /// reader is searching for, not asking.
    private static let titleShapedNoMark: [Entry] = [
        Entry(
            query: "what happened to the ordering menu",
            expected: .term, group: "awkward: title-shaped, no mark",
        ),
        Entry(
            query: "is there a ticket for the fold state bug",
            expected: .term, group: "awkward: title-shaped, no mark",
        ),
    ]

    /// A number pasted with surrounding words — still a term.
    private static let numbersWithContext: [Entry] = [
        Entry(
            query: "see 1242 for the ordering menu removal",
            expected: .term,
            group: "short term",
        ),
        Entry(query: "duplicate of 1075", expected: .term, group: "short term"),
    ]
}
