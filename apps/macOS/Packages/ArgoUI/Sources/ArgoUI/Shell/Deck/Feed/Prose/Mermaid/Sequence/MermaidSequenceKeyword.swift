import Foundation

/// The keywords a sequence diagram's lines open with, and what each of them says.
///
/// A keyword is matched as a WORD and never as a prefix: `endpoint->>B` is a message, and reading
/// its first three characters as `end` would close a block nobody opened and refuse the diagram.
enum MermaidSequenceKeyword {
    /// The words after `keyword`, or `nil` where this line does not open with it.
    static func rest(after keyword: String, of line: String) -> String? {
        guard line.lowercased().hasPrefix(keyword) else { return nil }
        let rest = line.dropFirst(keyword.count)
        guard rest.first.map({ !MermaidSequence.isNameCharacter($0) }) ?? true else { return nil }
        return rest.trimmingCharacters(in: .whitespaces)
    }

    /// A participant as it was declared: `A`, or `A as Alice` where the words after `as` are what
    /// the box says. `nil` for a name mermaid would not accept.
    static func participant(_ rest: String, isActor: Bool) -> MermaidSequence.Participant? {
        let name: String
        let label: String
        if let split = rest.range(of: " as ") {
            name = String(rest[..<split.lowerBound]).trimmingCharacters(in: .whitespaces)
            label = String(rest[split.upperBound...]).trimmingCharacters(in: .whitespaces)
        } else {
            name = rest
            label = rest
        }
        guard MermaidSequence.isName(name), !label.isEmpty else { return nil }
        return MermaidSequence.Participant(name: name, label: label, isActor: isActor)
    }

    /// Where a note stands, longest phrase first so `left of` is never read as a participant called
    /// `left`.
    private static let placements: [(phrase: String, placement: MermaidSequence.Note.Placement)] = [
        ("left of", .left), ("right of", .right), ("over", .over),
    ]

    /// A note as it was written — the words after `Note`, which name a placement, the participants
    /// it stands by, and the text after the `:`.
    static func note(_ rest: String) -> MermaidSequence.Note? {
        guard let spelling = placements.first(where: { rest.lowercased().hasPrefix($0.phrase) })
        else { return nil }
        let body = rest.dropFirst(spelling.phrase.count)
        let parts = body.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
        guard parts.count == 2 else { return nil }
        let over = parts[0].split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
        // `over` spans one participant or two; `left of` and `right of` stand beside exactly one.
        let span = spelling.placement == .over ? 1 ... 2 : 1 ... 1
        guard span.contains(over.count), over.allSatisfy(MermaidSequence.isName) else { return nil }
        let text = parts[1].trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return nil }
        return MermaidSequence.Note(placement: spelling.placement, over: over, text: text)
    }

    /// The block this line opens and the words after its keyword, or `nil` for a line that opens
    /// none.
    static func opening(of line: String) -> (block: MermaidSequence.Block, title: String)? {
        for block in MermaidSequence.Block.allCases {
            if let title = rest(after: block.rawValue, of: line) {
                return (block, title)
            }
        }
        return nil
    }

    /// The words after a block's own divider. `else`, `and` and `option` divide `alt`, `par` and
    /// `critical`; which of them divides which is mermaid's to enforce, not this reader's.
    static func divider(of line: String) -> String? {
        for keyword in ["else", "and", "option"] {
            if let title = rest(after: keyword, of: line) {
                return title
            }
        }
        return nil
    }
}
