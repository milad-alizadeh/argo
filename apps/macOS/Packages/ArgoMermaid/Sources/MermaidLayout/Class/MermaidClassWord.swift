import Foundation

/// The pieces a class diagram's lines are cut into: names, annotations, and the tildes mermaid
/// writes a generic parameter in.
enum MermaidClassWord {
    /// A name mermaid would accept for a class. Deliberately narrow, like the flowchart's and the
    /// state machine's: a line using anything else is one this reader leaves as a fence.
    static func isName(_ name: some StringProtocol) -> Bool {
        !name.isEmpty && name.allSatisfy(MermaidScan.isIdentifier)
    }

    /// The keyword inside `<<…>>`, where the text is one at all.
    static func annotation(_ text: String) -> String? {
        guard text.hasPrefix("<<"), text.hasSuffix(">>"), text.count > 4 else { return nil }
        return String(text.dropFirst(2).dropLast(2))
    }

    /// A class as it is named and as it is drawn: `Store~Item~` is the class `Store`, drawn with
    /// its parameter. The tildes are the SPELLING, so nothing downstream carries them — a relation
    /// naming `Store` has to reach the very same box.
    static func named(_ text: String) -> (name: String, title: String)? {
        guard let open = text.firstIndex(of: "~") else {
            return isName(text) ? (text, text) : nil
        }
        let name = String(text[text.startIndex ..< open])
        guard isName(name), text.hasSuffix("~"), text.count > name.count + 2,
              let title = angled(text) else { return nil }
        return (name, title)
    }

    /// The same words with every generic drawn the way mermaid draws it, in angle brackets, or
    /// `nil` where the tildes do not balance — a line this reader leaves as a fence.
    ///
    /// Nesting is the point: mermaid documents `List~List~int~~`, and a run that cut the tildes
    /// into pairs would draw the inner one as `<>`. A `~` is a delimiter only where one is already
    /// open or a type name stands right before it, so the `~` that means package visibility at the
    /// head of a member is left alone. It CLOSES where what follows cannot start a type name.
    static func angled(_ text: String) -> String? {
        let characters = Array(text)
        var drawn = ""
        var depth = 0
        for (at, character) in characters.enumerated() {
            guard character == "~", depth > 0 || isIdentifier(characters, before: at) else {
                drawn.append(character)
                continue
            }
            let opens = depth == 0 || isIdentifier(characters, before: at + 2)
            drawn.append(opens ? "<" : ">")
            depth += opens ? 1 : -1
        }
        guard depth == 0 else { return nil }
        return drawn
    }

    /// Whether the character before this index could be part of a type name.
    private static func isIdentifier(_ characters: [Character], before at: Int) -> Bool {
        characters.indices.contains(at - 1) && MermaidScan.isIdentifier(characters[at - 1])
    }
}
