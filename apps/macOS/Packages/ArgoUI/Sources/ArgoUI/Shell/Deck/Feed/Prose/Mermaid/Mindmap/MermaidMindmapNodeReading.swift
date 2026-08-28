import Foundation

// One mindmap line as it is spelled: an optional id, the brackets that say what figure the node is
// drawn as, and the prose between them.
//
// Not the flowchart's node reading, and that is the point. There a name is an identifier and a
// label is bracketed; here the bare line IS the text, spaces and punctuation and all, and two of
// the six bracket pairs close with the character the other four open with.

extension MermaidMindmap.Node {
    /// One way mermaid lets a mindmap node be bracketed, and the figure those brackets name. Its
    /// own type rather than `MermaidSpelling`: two of the six close with a character another
    /// opens with, and none of them names a flowchart's `Shape`.
    struct Spelling: Equatable, Sendable {
        let open: String
        let close: String
        let outline: MermaidOutline
    }

    /// Every spelling mermaid gives a mindmap node, longest opener first. `))bang((` before `)`,
    /// or a bang reads as a cloud whose text starts with a bracket.
    static let spellings: [Spelling] = [
        Spelling(open: "))", close: "((", outline: .bang),
        Spelling(open: "((", close: "))", outline: .ellipse),
        Spelling(open: "{{", close: "}}", outline: .hexagon),
        Spelling(open: "[", close: "]", outline: .rect),
        Spelling(open: "(", close: ")", outline: .rounded),
        Spelling(open: ")", close: "(", outline: .cloud),
    ]

    /// The node this line states, or `nil` where its brackets never close — which is what a fence
    /// still streaming in looks like.
    static func read(_ line: String) -> Self? {
        var scan = MermaidScan(line)
        // Mermaid's own handle for the node, which says nothing this draws.
        _ = scan.takeRun(where: MermaidFlowchart.Node.isNameCharacter)
        guard let spelling = spellings.first(where: { scan.matches($0.open) }) else {
            return MermaidMindmap.Node(text: broken(line))
        }
        guard scan.take(spelling.open), let inside = scan.takeUpTo(spelling.close),
              scan.take(spelling.close), scan.isDone
        else { return nil }
        let text = broken(unquoted(inside).trimmingCharacters(in: .whitespaces))
        return text.isEmpty ? nil : MermaidMindmap.Node(text: text, outline: spelling.outline)
    }

    /// The text with mermaid's own break in it made a real one, so a node set over two lines is two
    /// lines rather than one carrying markup.
    private static func broken(_ text: String) -> String {
        ["<br/>", "<br />", "<br>"].reduce(text) {
            $0.replacingOccurrences(of: $1, with: "\n")
        }
    }

    /// A quoted label taken verbatim, which is the only way text carrying its own bracket can be
    /// written at all.
    private static func unquoted(_ text: String) -> String {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        guard trimmed.count > 1, trimmed.hasPrefix("\""), trimmed.hasSuffix("\"") else {
            return text
        }
        return String(trimmed.dropFirst().dropLast())
    }
}
