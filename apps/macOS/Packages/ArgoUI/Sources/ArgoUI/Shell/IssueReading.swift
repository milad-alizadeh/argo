import Foundation

/// How a linked Ticket is worded wherever it is read as one thing — the house form, in the one
/// place every surface asks for it.
///
/// It exists because three surfaces say it: the ⓘ panel's Issue fact, the roster row's title and
/// the deck header's (#745). A second composition anywhere would let them disagree about a fact
/// they are all reading off the same link.
enum IssueReading {
    /// What a number is joined to its words with, and what a title is set against the thing said
    /// about it with. A colon and not the em dash this form carried until #1291: these words are a
    /// TITLE wherever `SessionTitle` resolves to them, and no title the cockpit draws carries an em
    /// dash.
    ///
    /// Named here because three readings spend it — this form, the header tooltip's issue line, and
    /// `SessionTitle`'s own respelling — and a separator pasted at three call sites is how they
    /// come to be punctuated three ways.
    static let joiner = ": "

    /// `#476: Anchor the feed on its newest line`, and `#510` alone where the provider named
    /// nothing.
    static func words(number: Int, title: String?) -> String {
        [mark(number), title].compactMap(\.self).joined(separator: joiner)
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
    ///
    /// The word is read without the punctuation it sits between, because the separator `words`
    /// joins with rides on the number's own word — `#741:` since #1291, and a title carrying
    /// `(#741)` says the number just as plainly. A path is untouched by that: `…/issues/852`
    /// ends on a digit, so nothing is trimmed off its tail and it still names no number.
    static func names(number: Int, in title: String) -> Bool {
        title
            .split(whereSeparator: \.isWhitespace)
            .contains { $0.trimmingCharacters(in: .punctuationCharacters) == "\(number)" }
    }
}
