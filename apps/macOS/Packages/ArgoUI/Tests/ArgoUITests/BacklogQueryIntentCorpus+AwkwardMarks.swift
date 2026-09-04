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

    /// A short question the six-word floor misses on its own — caught here only where it also
    /// carries its own `?`. The last two carry NEITHER signal: the design's own named risk, "a
    /// short question reads as a term," made concrete — these are the corpus's real false
    /// negatives, not a hypothetical the write-up gestures at.
    private static let shortQuestions: [Entry] = [
        Entry(query: "is 1242 done?", expected: .question, group: "awkward: short question"),
        Entry(query: "who owns this?", expected: .question, group: "awkward: short question"),
        Entry(query: "why blocked?", expected: .question, group: "awkward: short question"),
        Entry(query: "still open?", expected: .question, group: "awkward: short question"),
        Entry(query: "any ticket for 1293?", expected: .question, group: "awkward: short question"),
        Entry(query: "swift gate flaky?", expected: .question, group: "awkward: short question"),
        Entry(query: "1075 fixed?", expected: .question, group: "awkward: short question"),
        Entry(
            query: "why blocked", expected: .question,
            group: "awkward: short question, no mark",
        ),
        Entry(
            query: "still open", expected: .question,
            group: "awkward: short question, no mark",
        ),
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

    /// A ticket-title FRAGMENT that opens with a question word, with no mark and truly under six
    /// words — a genuine hard case the corpus still calls a TERM, since a pasted fragment is what
    /// the reader is searching for, not asking. (The longer titles that open the same way —
    /// `pastedTitles`, `longTerms` — already cross the six-word floor and land in the false-
    /// positive count; these two are here specifically because they do NOT, so the rule agrees
    /// with the ground truth and this category stays distinct from that one.)
    private static let titleShapedNoMark: [Entry] = [
        Entry(
            query: "what happened here",
            expected: .term,
            group: "awkward: title-shaped, no mark",
        ),
        Entry(
            query: "is this ticket closed",
            expected: .term, group: "awkward: title-shaped, no mark",
        ),
    ]

    /// A number pasted with surrounding words. The first is long enough to cross the six-word
    /// floor, so it lands with `longTerms` in spirit — grouped there, not as a short term, so a
    /// reader of the group label is not told it is short when it is one of the false positives.
    private static let numbersWithContext: [Entry] = [
        Entry(
            query: "see 1242 for the ordering menu removal",
            expected: .term,
            group: "awkward: long term",
        ),
        Entry(query: "duplicate of 1075", expected: .term, group: "short term"),
    ]
}
