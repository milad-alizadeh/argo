import Foundation

/// The ids a transcript joins itself by — a call to the result that answers it, a record to its
/// parent, a report to the call that delegated it — replaced by ids that join the same way and
/// name nothing real.
///
/// First appearance decides the number, so the k-th distinct id is always the k-th minted one:
/// re-running the pass over its own output hands every synthetic id straight back.
struct SyntheticIdentifiers {
    private var minted: [String: String] = [:]

    /// The synthetic id standing for `raw`, minted on first sight.
    mutating func id(for raw: String) -> String {
        if let known = minted[raw] {
            return known
        }
        let fresh = String(format: "00000000-0000-4000-8000-%012d", minted.count)
        minted[raw] = fresh
        return fresh
    }

    /// `text` with the contents of each `<tag>…</tag>` mapped and everything around them scrambled.
    ///
    /// A finished agent's report names the call it answers INSIDE its prose, so an id scrambled
    /// there is a report Argo can no longer join to the call it belongs to — a row of a different
    /// kind, from a fixture that was meant to hold the shape.
    mutating func scrambled(_ text: String, keepingJoinsIn tags: [String]) -> String {
        var out = ""
        var rest = Substring(text)
        while let quoted = Self.firstJoin(in: rest, tags) {
            out += SyntheticLorem.scrambled(String(rest[rest.startIndex ..< quoted.lowerBound]))
            out += id(for: String(rest[quoted]))
            rest = rest[quoted.upperBound...]
        }
        return out + SyntheticLorem.scrambled(String(rest))
    }

    /// Where the first quoted id in `text` sits — the run between the first opening tag of any of
    /// `tags` and the closing tag that follows it.
    /// Whether the text is ALREADY what this pass makes of one: every stretch outside a quoted id
    /// is its own scramble. The ids themselves are exempt, being minted rather than scrambled.
    static func isScrambled(_ text: String, keepingJoinsIn tags: [String]) -> Bool {
        var rest = Substring(text)
        while let quoted = firstJoin(in: rest, tags) {
            let outside = String(rest[rest.startIndex ..< quoted.lowerBound])
            guard SyntheticLorem.scrambled(outside) == outside else { return false }
            rest = rest[quoted.upperBound...]
        }
        return SyntheticLorem.scrambled(String(rest)) == String(rest)
    }

    private static func firstJoin(in text: Substring, _ tags: [String]) -> Range<String.Index>? {
        let opened = tags.compactMap { tag -> Range<String.Index>? in
            guard let open = text.range(of: "<\(tag)>"),
                  let close = text.range(of: "</\(tag)>", range: open.upperBound ..< text.endIndex)
            else { return nil }
            return open.upperBound ..< close.lowerBound
        }
        return opened.min { $0.lowerBound < $1.lowerBound }
    }
}
