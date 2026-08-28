import Foundation

// A state machine's source, read whole or not at all.
//
// The half that matters is the `nil`, exactly as it is for the flowchart and the sequence diagram:
// a line this reader has no rule for, an unclosed block, a note about a state nobody named — all of
// them leave the block the fence it is today (#859).

extension MermaidState {
    /// The state machine this source draws, or `nil` for anything this reader cannot.
    static func read(_ source: String) -> MermaidState? {
        var lines = MermaidSource.lines(of: source)
        let headers = ["statediagram", "statediagram-v2"]
        guard let header = lines.first, headers.contains(header.lowercased()) else { return nil }
        lines.removeFirst()
        var build = MermaidStateBuild()
        var note: MermaidStateNote?
        for line in lines {
            guard Self.step(line, into: &build, note: &note) else { return nil }
        }
        // A header on its own is a diagram with nothing in it, and an unclosed block — a composite
        // or a note — is half a one.
        guard build.isBalanced, note == nil, !build.machine.nodes.isEmpty else { return nil }
        return build.machine
    }

    /// One line, read. `false` is a line this reader has no rule for, which refuses the source.
    private static func step(
        _ line: String,
        into build: inout MermaidStateBuild,
        note: inout MermaidStateNote?,
    )
        -> Bool {
        if note != nil {
            return gathered(line, into: &build, note: &note)
        }
        if line == "}" {
            return build.closeComposite()
        }
        if let rest = word("direction", of: line) {
            guard let direction = MermaidDirection.named(rest) else { return false }
            build.direction = direction
            return true
        }
        if let rest = word("note", of: line) {
            return opened(rest, into: &build, note: &note)
        }
        if let rest = word("state", of: line) {
            return declared(rest, into: &build)
        }
        return line.contains(MermaidStateWord.arrow)
            ? moved(line, into: &build)
            : described(line, into: &build)
    }

    /// One line of a `note` block: `end note` closes it, anything else is more of its words. A
    /// block that closes with nothing in it said nothing, which is a source this reader refuses.
    private static func gathered(
        _ line: String,
        into build: inout MermaidStateBuild,
        note: inout MermaidStateNote?,
    )
        -> Bool {
        guard line.lowercased() == "end note" else {
            note?.add(line)
            return true
        }
        guard let gathered = note, !gathered.text.isEmpty else { return false }
        build.attach(gathered)
        note = nil
        return true
    }

    /// A note, in either spelling: `note right of A : words`, or the same header on its own with
    /// its words on the lines up to `end note`.
    ///
    /// A note about a state nobody named has nothing to attach to, so it refuses the source rather
    /// than floating free of the machine.
    private static func opened(
        _ rest: String,
        into build: inout MermaidStateBuild,
        note: inout MermaidStateNote?,
    )
        -> Bool {
        let cut = MermaidStateWord.split(rest)
        guard let about = MermaidStateWord.placement(of: cut?.head ?? rest),
              build.has(about) else { return false }
        guard let words = cut?.tail else {
            note = MermaidStateNote(about: about)
            return true
        }
        guard !words.isEmpty else { return false }
        build.attach(MermaidStateNote(about: about, text: words))
        return true
    }

    /// The rest of a line after `keyword `, or `nil` where the line does not open with it. The
    /// space is the point: `stateful --> A` names a state, and reading it as a declaration would
    /// refuse a diagram nothing is wrong with.
    static func word(_ keyword: String, of line: String) -> String? {
        guard line.lowercased().hasPrefix("\(keyword) ") else { return nil }
        return String(line.dropFirst(keyword.count)).trimmingCharacters(in: .whitespaces)
    }
}
