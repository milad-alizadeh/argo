import Foundation

// A sequence diagram's source, read whole or not at all.
//
// The half that matters is the `nil`, exactly as it is for the flowchart: a line this reader has no
// rule for — a directive it does not know, an unclosed `loop`, an arrow mermaid spells and Argo
// does not draw — leaves the block the fence it is today (#859).

extension MermaidSequence {
    /// The sequence diagram this source draws, or `nil` for anything this reader cannot.
    static func read(_ source: String) -> MermaidSequence? {
        var lines = MermaidSource.lines(of: source)
        // The keyword alone. `sequenceDiagram autonumber` numbers every message, which is a
        // diagram this reader would draw wrong rather than not at all.
        guard let header = lines.first, header.lowercased() == "sequencediagram" else { return nil }
        lines.removeFirst()
        var build = MermaidSequenceBuild()
        for line in lines {
            guard build.add(line) else { return nil }
        }
        // A header on its own is a diagram with nothing in it, and an unclosed block is half a one.
        guard build.isBalanced, !build.participants.isEmpty, !build.events.isEmpty else {
            return nil
        }
        return MermaidSequence(participants: build.participants, events: build.events)
    }

    /// Whether `name` is one mermaid would accept for a participant, and not empty.
    static func isName(_ name: some StringProtocol) -> Bool {
        !name.isEmpty && name.allSatisfy(MermaidScan.isIdentifier)
    }
}
