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
        [mark(number), title].compactMap(\.self).joined(separator: " — ")
    }

    /// `#1261` — the number on its own, as the provider writes it: a `#` and the digits, and never
    /// a separator between them.
    ///
    /// Every surface that DRAWS the number asks here, and the reason is the `Text` on the other
    /// end. `Text("#\(number)")` is a `LocalizedStringKey`, so SwiftUI formats the interpolated
    /// `Int` as a QUANTITY for the reader's locale and a four-digit ticket reads `#1,261` (#1263).
    /// A number below a thousand looked right, which is why the fault stood until this repo passed
    /// issue 1000. Handing a `String` to `Text` takes the verbatim initializer instead, so the
    /// spelling below is the spelling drawn — in any locale.
    static func mark(_ number: Int) -> String {
        "#\(number)"
    }

    /// Whether a title already names this Ticket as a word of its own — `#741` as the words above
    /// spell it, or the bare `741` a `/implement 741` opened with.
    ///
    /// A word and not a substring: the `852` inside `…/issues/852` is not a number the row is
    /// saying to anyone, and a row reading exactly that is what #1072 was reported against.
    static func names(number: Int, in title: String) -> Bool {
        let spellings = Set([mark(number), "\(number)"])
        let words = title.split(whereSeparator: \.isWhitespace)
        return words.contains { spellings.contains(String($0)) }
    }
}
