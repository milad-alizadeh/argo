import Foundation

/// The pieces an entity diagram's lines are cut into: names and their aliases, attributes, and the
/// two characters crow's foot spells a cardinality with.
enum MermaidEntityWord {
    /// A name mermaid would accept for an entity. Wider than a class's, because `LINE-ITEM` is the
    /// spelling its own documentation uses.
    static func isName(_ name: some StringProtocol) -> Bool {
        !name.isEmpty && name.allSatisfy { MermaidScan.isIdentifier($0) || $0 == "-" }
    }

    /// An entity as it is named and as it is drawn: `CUSTOMER["Customer account"]` is the entity
    /// `CUSTOMER`, drawn under its alias. Relationships name the entity, never the alias.
    static func named(_ text: String) -> (name: String, title: String)? {
        guard text.hasSuffix("]"), let open = text.firstIndex(of: "[") else {
            return isName(text) ? (text, text) : nil
        }
        // Mermaid's own page writes `CUSTOMER ["Customer account"]`, a space and all.
        let name = String(text[text.startIndex ..< open]).trimmingCharacters(in: .whitespaces)
        let alias = String(text[text.index(after: open) ..< text.index(before: text.endIndex)])
            .trimmingCharacters(in: CharacterSet(charactersIn: "\""))
        guard isName(name), !alias.isEmpty else { return nil }
        return (name, alias)
    }

    /// `CUSTOMER {` and `CUSTOMER["Customer account"] {`, the line that opens an attribute block.
    static func block(_ line: String) -> (name: String, title: String)? {
        guard line.hasSuffix("{") else { return nil }
        return named(String(line.dropLast()).trimmingCharacters(in: .whitespaces))
    }

    /// One attribute: a type and a name, whatever key markers follow them, and the comment.
    ///
    /// The keys are kept because they are the point of the line — a schema nobody can read the
    /// keys off is not a schema. The comment's own quotes are NOT: mermaid quotes it only so it can
    /// hold spaces, exactly as it quotes an edge label.
    static func attribute(_ line: String) -> String? {
        let at = line.firstIndex(of: "\"")
        let head = at.map { String(line[line.startIndex ..< $0]) } ?? line
        let words = head.split(separator: " ", omittingEmptySubsequences: true).map(String.init)
        guard words.count > 1, words.prefix(2).allSatisfy(Self.isField) else { return nil }
        let comment = at.map { MermaidSource.unquoted(String(line[$0...])) } ?? ""
        return (words + (comment.isEmpty ? [] : [comment])).joined(separator: " ")
    }

    /// What one end's two characters mean. The MAXIMUM stands against the entity and the minimum
    /// behind it, so the pair is mirrored between the two ends of the token.
    static func terminal(_ mark: String, isTail: Bool) -> MermaidTerminal? {
        let characters = Array(mark)
        guard characters.count == 2,
              let isMany = most(isTail ? characters[0] : characters[1], isTail: isTail),
              let isOptional = least(isTail ? characters[1] : characters[0]) else { return nil }
        return .crowsFoot(isMany: isMany, isOptional: isOptional)
    }

    /// The maximum: a bar for one, and a fork facing away from its own entity for many.
    private static func most(_ mark: Character, isTail: Bool) -> Bool? {
        switch mark {
        case "|": false
        case "}": isTail ? true : nil
        case "{": isTail ? nil : true
        default: nil
        }
    }

    /// The minimum: a bar for one, a ring for none.
    private static func least(_ mark: Character) -> Bool? {
        switch mark {
        case "|": false
        case "o": true
        default: nil
        }
    }

    /// A word that can stand as an attribute's type or its name — mermaid allows brackets, dots and
    /// a leading `*`, and a line whose first two words are neither is not an attribute at all.
    private static func isField(_ word: String) -> Bool {
        guard let first = word.first else { return false }
        return first.isLetter || first == "*"
    }
}
