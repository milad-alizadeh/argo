import Foundation

// The three lines that are not a block, a direction or a note: a `state` declaration, a transition,
// and a description given after the fact.
//
// Read whole or refused. A line understood by half would draw a machine nobody wrote, which is
// worse than the fence it would otherwise have stayed (#859).

extension MermaidState {
    /// `state X {`, `state "words" as X`, `state X <<choice>>`, and the bare `state X`.
    static func declared(_ rest: String, into build: inout MermaidStateBuild) -> Bool {
        if rest.hasSuffix("{") {
            let body = String(rest.dropLast()).trimmingCharacters(in: .whitespaces)
            guard let named = spelled(body) else { return false }
            build.openComposite(named.name, titled: named.title)
            return true
        }
        if let mark = marked(rest) {
            build.add(mark)
            return true
        }
        guard let named = spelled(rest) else { return false }
        build.add(Node(name: named.name, label: named.title))
        return true
    }

    /// `A --> B`, with the word after a `:` where it carries one.
    static func moved(_ line: String, into build: inout MermaidStateBuild) -> Bool {
        let cut = MermaidStateWord.split(line)
        let ends = (cut?.head ?? line).components(separatedBy: MermaidStateWord.arrow)
            .map { $0.trimmingCharacters(in: .whitespaces) }
        guard ends.count == 2, ends.allSatisfy(MermaidStateWord.isEnd) else { return false }
        let label = cut?.tail
        guard label?.isEmpty != true else { return false }
        let from = build.end(ends[0], isSource: true)
        let to = build.end(ends[1], isSource: false)
        build.add(Transition(from: from, to: to, label: label))
        return true
    }

    /// `id : the words`, which describes a state named anywhere in the source.
    static func described(_ line: String, into build: inout MermaidStateBuild) -> Bool {
        guard let cut = MermaidStateWord.split(line),
              MermaidStateWord.isName(cut.head), !cut.tail.isEmpty else { return false }
        build.describe(cut.head, as: cut.tail)
        return true
    }

    /// A name and the words on it: `X`, or `"the words" as X` where the two differ.
    private static func spelled(_ body: String) -> (name: String, title: String)? {
        guard body.hasPrefix("\"") else {
            return MermaidStateWord.isName(body) ? (body, body) : nil
        }
        let rest = body.dropFirst()
        guard let close = rest.firstIndex(of: "\"") else { return nil }
        let title = String(rest[rest.startIndex ..< close])
        let after = String(rest[rest.index(after: close)...])
            .trimmingCharacters(in: .whitespaces)
        guard let name = MermaidState.word("as", of: after),
              MermaidStateWord.isName(name), !title.isEmpty else { return nil }
        return (name, title)
    }

    /// `state X <<choice>>` and its siblings. A fork and a join are the same bar drawn twice: they
    /// differ in which way the transitions run through them, which the bar itself never says.
    private static func marked(_ rest: String) -> Node? {
        let words = rest.split(separator: " ").map(String.init)
        guard words.count == 2, MermaidStateWord.isName(words[0]),
              let annotation = MermaidStateWord.annotation(words[1]) else { return nil }
        switch annotation.lowercased() {
        case "choice": return Node(name: words[0], label: "", figure: .choice)
        case "fork", "join": return Node(name: words[0], label: "", figure: .fork)
        default: return nil
        }
    }
}
