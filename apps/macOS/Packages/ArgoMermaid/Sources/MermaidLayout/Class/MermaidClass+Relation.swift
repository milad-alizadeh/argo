import Foundation

// A relationship line, read: the classes at either end, the cardinality written against each of
// them, the word written on the line, and the pair of marker and stroke that says which of UML's
// six relationships this is.
//
// The six are not six spellings. They are FOUR markers times TWO strokes, and mermaid says which
// end each marker belongs to inside the token itself — so `Animal <|-- Duck` and `Duck --|> Animal`
// are the same relationship written twice, and both point at the parent (#865).

extension MermaidClass {
    /// `true` where the line is a relationship this reader read, `false` where it is one it could
    /// not, and `nil` where it is no relationship at all.
    static func related(_ line: String, into build: inout MermaidClassBuild) -> Bool? {
        let cut = MermaidSource.split(line)
        guard let join = MermaidJoin.read(cut?.head ?? line, terminal: terminal) else { return nil }
        guard let from = end(join.before, quotedLast: true),
              let to = end(join.after, quotedLast: false),
              cut?.tail.isEmpty != true else { return false }
        build.name(from.name, titled: from.title)
        build.name(to.name, titled: to.title)
        build.relate(MermaidRelation(
            from: from.name,
            to: to.name,
            tail: join.tail,
            head: join.head,
            line: join.line,
            label: cut.map { MermaidSource.unquoted($0.tail) },
            tailWord: from.word,
            headWord: to.word,
        ))
        return true
    }

    /// What a run of marker characters means at one end of the token. The spelling is mirrored —
    /// `<|` faces the class on its left and `|>` the one on its right — so the same figure is read
    /// from either side.
    private static func terminal(_ mark: String, isTail: Bool) -> MermaidTerminal? {
        switch mark {
        case "": MermaidTerminal.none
        case "*": .diamond(isSolid: true)
        case "o": .diamond(isSolid: false)
        case "<": isTail ? .arrow : nil
        case ">": isTail ? nil : .arrow
        case "<|": isTail ? .triangle : nil
        case "|>": isTail ? nil : .triangle
        default: nil
        }
    }

    /// One end of the token: the class it names, how that class is drawn, and the cardinality
    /// quoted against it. The quote stands between the class and the line, so which side of the
    /// text it is on is which end this is.
    private struct End {
        let name: String
        let title: String
        var word: String?
    }

    private static func end(_ text: String, quotedLast: Bool) -> End? {
        let parts = text.components(separatedBy: "\"")
        guard parts.count > 1 else {
            return MermaidClassWord.named(text).map { End(name: $0.name, title: $0.title) }
        }
        guard parts.count == 3, !parts[1].isEmpty,
              (quotedLast ? parts[2] : parts[0]).trimmingCharacters(in: .whitespaces).isEmpty,
              let named = MermaidClassWord.named(
                  (quotedLast ? parts[0] : parts[2]).trimmingCharacters(in: .whitespaces),
              )
        else { return nil }
        return End(name: named.name, title: named.title, word: parts[1])
    }
}
