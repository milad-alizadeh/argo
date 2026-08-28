import Foundation

/// One way mermaid spells an arrow between two participants, and what that spelling means.
///
/// The tokens are tried LONGEST FIRST and that is the whole subtlety: `-->>` read with `-->` first
/// is a dotted line whose destination is called `>B`, and it would draw without ever failing.
struct MermaidArrow: Equatable, Sendable {
    let token: String
    let stroke: MermaidSequence.Stroke
    let head: MermaidSequence.Head

    /// Every arrow this reader draws. Mermaid's bidirectional `<<->>` is deliberately absent: it is
    /// one line saying two things, and a diagram using it degrades to its source rather than to an
    /// arrow pointing the wrong way.
    static let spellings = [
        MermaidArrow(token: "-->>", stroke: .dotted, head: .filled),
        MermaidArrow(token: "--)", stroke: .dotted, head: .open),
        MermaidArrow(token: "--x", stroke: .dotted, head: .cross),
        MermaidArrow(token: "-->", stroke: .dotted, head: .none),
        MermaidArrow(token: "->>", stroke: .solid, head: .filled),
        MermaidArrow(token: "-)", stroke: .solid, head: .open),
        MermaidArrow(token: "-x", stroke: .solid, head: .cross),
        MermaidArrow(token: "->", stroke: .solid, head: .none),
    ]

    /// The arrow at the cursor, stepped over. `nil` where the text there is not one.
    static func read(_ scan: inout MermaidScan) -> MermaidArrow? {
        guard let arrow = spellings.first(where: { scan.matches($0.token) }),
              scan.take(arrow.token)
        else { return nil }
        return arrow
    }
}

extension MermaidSequence.Message {
    /// The message this line writes — `A->>B: Hello`, with mermaid's `+`/`-` shorthand between the
    /// arrow and its destination. `nil` for a line that is not one, which is what lets the reader
    /// try the keywords first and fall through to here.
    static func read(_ line: String) -> Self? {
        var scan = MermaidScan(line)
        let from = scan.takeRun(where: MermaidSequence.isNameCharacter)
        guard !from.isEmpty else { return nil }
        scan.skipSpaces()
        guard let arrow = MermaidArrow.read(&scan) else { return nil }
        scan.skipSpaces()
        let activates = scan.take("+")
        let deactivates = !activates && scan.take("-")
        let to = scan.takeRun(where: MermaidSequence.isNameCharacter)
        guard !to.isEmpty else { return nil }
        scan.skipSpaces()
        // Everything after the `:` is the message, verbatim — a colon inside it included, which is
        // why this is the rest of the line and not a split.
        guard scan.take(":") || scan.isDone else { return nil }
        return MermaidSequence.Message(
            from: from,
            to: to,
            text: scan.rest.trimmingCharacters(in: .whitespaces),
            stroke: arrow.stroke,
            head: arrow.head,
            activates: activates,
            deactivates: deactivates,
        )
    }
}
