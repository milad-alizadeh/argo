@testable import ArgoUI

/// ~100 queries a reader would really type into the backlog's search field, each hand-labelled
/// with what it IS — a term the plain field should answer, or a question the ask should be
/// offered for — independent of what `BacklogQueryIntentProjection` says about it. The test suite
/// compares the rule against this ground truth; the label here is never derived from the rule
/// itself, or the corpus proves nothing.
///
/// Every entry is what the reader finishes typing. `BacklogQueryIntentProjectionTests` walks each
/// one's own PREFIXES too — the field sees those first, and the design's real bar is whether the
/// rule holds still on the way there, not just at the end (#1316).
///
/// Split across five extension files, one per category below `+ShortTerms`: a single body here
/// crossed `type_body_length` (`.swiftlint.yml`), and the categories are the unit a reader of the
/// corpus actually wants to jump to.
enum BacklogQueryIntentCorpus {
    struct Entry {
        let query: String
        let expected: BacklogQueryIntentProjection.Kind
        /// A label for grouping the report, not for grading — see the file comment.
        let group: String
    }

    static let entries: [Entry] = shortTerms + ticketNumbers + pastedTitles + realQuestions
        + awkwardMiddle
}
