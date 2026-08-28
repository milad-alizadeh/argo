/// How a linked Ticket is worded wherever it is read as one thing — the house form, in the one
/// place every surface asks for it.
///
/// It exists because three surfaces say it: the ⓘ panel's Issue fact, the roster row's title and
/// the deck header's (#745). A second composition anywhere would let them disagree about a fact
/// they are all reading off the same link.
enum IssueReading {
    /// `#476 — Anchor the feed on its newest line`, and `#510` alone where the provider named
    /// nothing.
    static func words(number: Int, title: String?) -> String {
        ["#\(number)", title].compactMap(\.self).joined(separator: " — ")
    }
}
