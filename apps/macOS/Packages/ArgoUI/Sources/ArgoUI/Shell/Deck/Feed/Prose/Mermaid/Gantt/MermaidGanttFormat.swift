import Foundation

/// The two date grammars a `gantt` source writes, translated into the one the platform reads.
///
/// `dateFormat` is dayjs and `axisFormat` is d3, because mermaid inherited one of each; both are
/// turned into a `DateFormatter` pattern here so nothing downstream does arithmetic on a string.
/// A token neither table knows is `nil`, which leaves the whole block a fence (#903).
enum MermaidGanttFormat {
    /// What mermaid itself assumes when a source names neither.
    static let defaultInput = "yyyy-MM-dd"
    static let defaultAxis = "yyyy-MM-dd"

    /// dayjs' tokens, longest first — `YYYY` has to be taken before `YY` reads two of it.
    private static let inputTokens = [
        ("YYYY", "yyyy"), ("YY", "yy"), ("MMMM", "MMMM"), ("MMM", "MMM"), ("MM", "MM"),
        ("M", "M"), ("DD", "dd"), ("D", "d"), ("HH", "HH"), ("H", "H"), ("hh", "hh"),
        ("h", "h"), ("mm", "mm"), ("m", "m"), ("ss", "ss"), ("s", "s"), ("SSS", "SSS"),
        ("A", "a"), ("a", "a"),
    ]

    /// d3's, each a `%` and one letter, zero-padded as d3 spells them.
    private static let axisTokens: [Character: String] = [
        "Y": "yyyy", "y": "yy", "m": "MM", "d": "dd", "e": "d", "b": "MMM", "B": "MMMM",
        "a": "EEE", "A": "EEEE", "H": "HH", "I": "hh", "M": "mm", "S": "ss", "p": "a",
        "j": "DDD", "%": "'%'",
    ]

    static func input(_ pattern: String) -> String? {
        translate(pattern) { rest in
            inputTokens.first { rest.hasPrefix($0.0) }.map { ($0.0.count, $0.1) }
        }
    }

    /// The same tokens unpadded, for d3's `-` and `_` pad flags. Only the ones that differ: a
    /// month's name and a year are the same width either way, and a Unicode pattern says width in
    /// the token itself — `MM` is the padded month and `M` the bare one.
    private static let axisBare: [Character: String] = [
        "Y": "y", "m": "M", "d": "d", "H": "H", "I": "h", "M": "m", "S": "s", "j": "D",
    ]

    /// The pad flags d3 writes between the `%` and its letter: `-` for none, `_` for a space and
    /// `0` for a zero. A space-padded field is not a thing a `DateFormatter` spells, so `_` takes
    /// the bare spelling — a nit of width on a centred label, and never a wrong date.
    private static let pads: Set<Character> = ["-", "_", "0"]

    static func axis(_ pattern: String) -> String? {
        translate(pattern) { rest in
            guard rest.hasPrefix("%") else { return nil }
            var body = rest.dropFirst()
            var length = 2
            var bare = false
            if let flag = body.first, pads.contains(flag) {
                body = body.dropFirst()
                length = 3
                bare = flag != "0"
            }
            guard let letter = body.first else { return nil }
            guard let unicode = bare ? axisBare[letter] ?? axisTokens[letter] : axisTokens[letter]
            else { return nil }
            return (length, unicode)
        }
    }

    /// One pattern walked left to right: a token the table knows is translated, and anything else
    /// is a literal. A LETTER that is no token is refused rather than quoted — in either grammar
    /// that is a spelling this reader does not know, and quoting it would draw a chart whose ticks
    /// say something the source never wrote.
    private static func translate(
        _ pattern: String,
        token: (Substring) -> (length: Int, unicode: String)?,
    )
        -> String? {
        var rest = Substring(pattern)
        var built = ""
        while let next = rest.first {
            if let found = token(rest) {
                built += found.unicode
                rest = rest.dropFirst(found.length)
                continue
            }
            guard !next.isLetter else { return nil }
            built += next == "'" ? "''" : String(next)
            rest = rest.dropFirst()
        }
        return built.isEmpty ? nil : built
    }
}
