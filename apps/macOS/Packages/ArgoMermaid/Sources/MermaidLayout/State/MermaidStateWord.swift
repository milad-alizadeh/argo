import Foundation

/// The pieces a state machine's lines are cut into: names, the `:` that opens a description, and
/// the `[*]` that is a start at one end of a transition and an end at the other.
enum MermaidStateWord {
    /// The token both pseudo-states are written as.
    static let terminal = "[*]"
    static let arrow = "-->"

    /// A name mermaid would accept for a state — `MermaidScan`'s one identifier rule, so a state
    /// machine and a flowchart cannot disagree about what a name is.
    static func isName(_ name: some StringProtocol) -> Bool {
        !name.isEmpty && name.allSatisfy(MermaidScan.isIdentifier)
    }

    /// A name, or the terminal token — the two things either end of a transition can be.
    static func isEnd(_ word: String) -> Bool {
        word == terminal || isName(word)
    }

    /// Which state a note's header is about: `right of A`, `left of A`, `over A`. The side is not
    /// kept — a note is placed by the layered pass like everything else, so where the source asked
    /// for it is a request the layout has no way to honour without a second placement rule.
    static func placement(of header: String) -> String? {
        let words = header.split(separator: " ").map(String.init)
        let named = words.count == 3 && ["left", "right"].contains(words[0].lowercased())
            && words[1].lowercased() == "of"
        if named, isName(words[2]) {
            return words[2]
        }
        guard words.count == 2, words[0].lowercased() == "over", isName(words[1]) else {
            return nil
        }
        return words[1]
    }

    /// The keyword inside `<<…>>`, where the text is one at all.
    static func annotation(_ text: String) -> String? {
        guard text.hasPrefix("<<"), text.hasSuffix(">>"), text.count > 4 else { return nil }
        return String(text.dropFirst(2).dropLast(2))
    }
}
