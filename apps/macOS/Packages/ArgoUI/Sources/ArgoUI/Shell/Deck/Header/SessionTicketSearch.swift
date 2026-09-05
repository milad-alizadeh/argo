import Foundation

/// What the ticket picker's field narrows the backlog to (#1231).
///
/// A derivation and not a store: the query lives in the picker, the options come from
/// `SessionTicketLinking`, and what a query keeps is a pure function of the two — which is what
/// lets the matching be asserted without a view.
enum SessionTicketSearch {
    /// One Ticket a query kept, cut into the three runs its row draws.
    struct Match: Equatable, Identifiable {
        let option: SessionTicketLinking.Option

        /// Where the reader's characters sit in `option.label`. Empty where nothing was typed,
        /// which is a row with nothing lifted rather than a row with everything lifted.
        let matched: Range<Int>

        var id: Int {
            option.number
        }

        /// The label ahead of what matched, what matched, and the label after it. Cut here rather
        /// than at the draw site: the range indexes CHARACTERS of the label, and a view that
        /// sliced it by any other measure would lift the wrong run.
        var before: String {
            String(label[..<matched.lowerBound])
        }

        var highlighted: String {
            String(label[matched])
        }

        var after: String {
            String(label[matched.upperBound...])
        }

        private var label: [Character] {
            Array(option.label)
        }
    }

    /// The tickets a query keeps, in the order the picker draws them.
    ///
    /// An empty field is not a filter: it keeps the backlog whole, in the order it arrived, which
    /// `SessionTicketLinking.over(tickets:session:link:)` already sorted newest first — the most
    /// likely Tickets, without a second notion of recency to disagree with the first.
    ///
    /// A typed query matches a substring of the whole label, so the number and the title are both
    /// reachable off one pass and the mark a reader read elsewhere (`#1217`) is as typeable as the
    /// digits alone. A substring rather than a subsequence: over words this short, a fuzzy rule
    /// surfaces rows nobody recognises above the one they meant (`ComposerMenu+Commands`).
    static func matches(
        over options: [SessionTicketLinking.Option],
        on query: String,
    )
        -> [Match] {
        let wanted = Array(query.trimmingCharacters(in: .whitespaces))
        guard !wanted.isEmpty else {
            return options.map { Match(option: $0, matched: 0 ..< 0) }
        }
        // Two runs rather than one sort: a number typed is a number meant, so the row whose own
        // number carries the characters stands above one that merely says them in its sentence.
        // Appending keeps each run in the order the backlog served it.
        var numbered: [Match] = []
        var titled: [Match] = []
        for option in options {
            guard let matched = range(of: wanted, in: option.label) else { continue }
            let match = Match(option: option, matched: matched)
            if matched.upperBound <= IssueReading.mark(option.number).count {
                numbered.append(match)
            } else {
                titled.append(match)
            }
        }
        return numbered + titled
    }

    /// Where the reader's characters sit in a label, counted in the label's OWN characters.
    ///
    /// Folded a character at a time rather than over the whole string: `String.lowercased()` is
    /// not length-preserving for every scalar, so a range measured over a folded copy can index
    /// past the end of the original — and the original is what the row draws.
    private static func range(of wanted: [Character], in label: String) -> Range<Int>? {
        let over = Array(label)
        guard wanted.count <= over.count else { return nil }
        for start in 0 ... (over.count - wanted.count)
            where isSame(Array(over[start ..< start + wanted.count]), wanted) {
            return start ..< (start + wanted.count)
        }
        return nil
    }

    private static func isSame(_ run: [Character], _ wanted: [Character]) -> Bool {
        zip(run, wanted).allSatisfy { $0.lowercased() == $1.lowercased() }
    }
}
