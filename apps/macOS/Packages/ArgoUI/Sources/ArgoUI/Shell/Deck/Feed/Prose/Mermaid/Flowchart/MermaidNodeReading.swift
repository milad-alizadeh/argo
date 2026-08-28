import Foundation

// One node as it is spelled: a name, and the brackets around its label that say what figure it is
// drawn as.
//
// The openers are tried LONGEST FIRST and that is the whole subtlety: `[[Sub]]` read with `[` first
// is a rect whose label is `[Sub`, and it would draw without ever failing.

/// One way mermaid lets a node's label be bracketed, and the figure those brackets name.
struct MermaidSpelling: Equatable, Sendable {
    let open: String
    let close: String
    let shape: MermaidFlowchart.Shape
}

extension MermaidFlowchart.Node {
    /// Every spelling mermaid gives a node's label, longest opener first.
    static let spellings = [
        MermaidSpelling(open: "[[", close: "]]", shape: .subroutine),
        MermaidSpelling(open: "[(", close: ")]", shape: .cylinder),
        MermaidSpelling(open: "([", close: "])", shape: .stadium),
        MermaidSpelling(open: "((", close: "))", shape: .circle),
        MermaidSpelling(open: "{{", close: "}}", shape: .hexagon),
        MermaidSpelling(open: "[", close: "]", shape: .rect),
        MermaidSpelling(open: "(", close: ")", shape: .rounded),
        MermaidSpelling(open: "{", close: "}", shape: .diamond),
        MermaidSpelling(open: ">", close: "]", shape: .flag),
    ]

    /// The node at the cursor, or `nil` where the text there is not one. A bare name is a node with
    /// itself for a label and a plain rect for a figure, which is what mermaid draws it as.
    static func read(_ scan: inout MermaidScan) -> Self? {
        let name = scan.takeRun(where: isNameCharacter)
        guard !name.isEmpty else { return nil }
        guard opensLabel(scan) else { return MermaidFlowchart.Node(name: name, label: name) }
        guard let spelled = readLabel(&scan) else { return nil }
        return MermaidFlowchart.Node(name: name, label: spelled.label, shape: spelled.shape)
    }

    /// A name mermaid would accept for a node. Deliberately narrow: `-` reads as a link and a space
    /// reads as the end of the node, so a line using either is one this reader leaves as a fence.
    static func isNameCharacter(_ character: Character) -> Bool {
        character.isLetter || character.isNumber || character == "_"
    }

    /// Whether a label's own brackets open at the cursor. Asked before reading one so a bracket
    /// that fails to close refuses the line, rather than reading as no bracket at all.
    static func opensLabel(_ scan: MermaidScan) -> Bool {
        spellings.contains { scan.matches($0.open) }
    }

    /// The bracketed label at the cursor and the figure its brackets name. A quoted label is taken
    /// VERBATIM — that is the whole point of quoting it, and the only way a label carrying a
    /// bracket or a pipe can be written at all.
    static func readLabel(_ scan: inout MermaidScan)
        -> (label: String, shape: MermaidFlowchart.Shape)? {
        guard let spelling = spellings.first(where: { scan.matches($0.open) }),
              scan.take(spelling.open)
        else { return nil }
        if scan.take("\"") {
            guard let quoted = scan.takeUpTo("\""), scan.take("\""), scan.take(spelling.close)
            else { return nil }
            return (quoted, spelling.shape)
        }
        guard let plain = scan.takeUpTo(spelling.close), scan.take(spelling.close) else {
            return nil
        }
        let label = plain.trimmingCharacters(in: .whitespaces)
        return label.isEmpty ? nil : (label, spelling.shape)
    }
}
