import Foundation

/// The Ticket a pull request body says it closes, read the way the code host reads it.
///
/// This is the native half of the join (ADR-0014): `/implement` writes `Closes #<N>` because that
/// is the industry's own mechanism, and Argo reads back exactly what GitHub itself acts on — the
/// nine keywords it documents, a `#`, and a number.
enum ClosingReference {
    /// GitHub's own closing keywords, verbatim from its linking documentation. Matched
    /// case-insensitively, which is how GitHub matches them.
    private static let keywords = [
        "close", "closes", "closed",
        "fix", "fixes", "fixed",
        "resolve", "resolves", "resolved",
    ]

    /// The first Ticket number the body closes, and `nil` for a body that closes none.
    static func number(in body: String) -> Int? {
        let words = body.split(whereSeparator: \.isWhitespace).map(Self.bare)
        for (index, word) in words.enumerated()
            where keywords.contains(word.lowercased()) {
            guard let next = words.dropFirst(index + 1).first,
                  let number = self.number(marked: next)
            else { continue }
            return number
        }
        return nil
    }

    /// The word without the punctuation people wrap it in — GitHub links `(closes #12)` and
    /// `Closes: #12` the same as the bare form, so reading only the bare form under-reads the
    /// native tier and falls through to a lower-authority one.
    private static func bare(_ word: Substring) -> String {
        String(word.trimmingCharacters(in: CharacterSet(charactersIn: "(),.:;[]{}<>\"'")))
    }

    /// The digits behind a `#`, and `nil` for anything else — including `#0`, which providers
    /// never issue and which is therefore a misread rather than a link.
    private static func number(marked word: String) -> Int? {
        guard word.hasPrefix("#"),
              let number = Int(word.dropFirst().prefix(while: \.isNumber)), number > 0
        else { return nil }
        return number
    }
}
