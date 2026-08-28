import Foundation

/// A sequence diagram under construction: the participants met so far, the events read so far, and
/// how many blocks are still open.
///
/// Every name a line mentions is REGISTERED here, declared or not, which is what puts an implicit
/// participant in first-use order without a second pass over the source.
struct MermaidSequenceBuild {
    private(set) var participants: [MermaidSequence.Participant] = []
    private(set) var events: [MermaidSequence.Event] = []
    private var open = 0

    var isBalanced: Bool {
        open == 0
    }

    /// One line, added. `false` is a line this reader has no rule for, which refuses the whole
    /// source — nothing is skipped, because a source read half-way would draw a diagram nobody
    /// wrote.
    mutating func add(_ line: String) -> Bool {
        if let handled = declared(line) {
            return handled
        }
        if let handled = framed(line) {
            return handled
        }
        if let handled = noted(line) {
            return handled
        }
        return messaged(line)
    }

    /// The four lines that say something ABOUT a participant rather than between two. `nil` is a
    /// line that is none of them.
    private mutating func declared(_ line: String) -> Bool? {
        for (keyword, isActor) in [("participant", false), ("actor", true)] {
            guard let rest = MermaidSequenceKeyword.rest(after: keyword, of: line) else { continue }
            guard let declared = MermaidSequenceKeyword.participant(rest, isActor: isActor)
            else { return false }
            declare(declared)
            return true
        }
        for (keyword, turnsOn) in [("activate", true), ("deactivate", false)] {
            guard let name = MermaidSequenceKeyword.rest(after: keyword, of: line) else { continue }
            guard MermaidSequence.isName(name) else { return false }
            use(name)
            events.append(turnsOn ? .activate(name) : .deactivate(name))
            return true
        }
        return nil
    }

    /// A block opened, divided or closed. A divider or an `end` with nothing open is a source this
    /// reader refuses rather than one it silently straightens out.
    private mutating func framed(_ line: String) -> Bool? {
        if MermaidSequenceKeyword.rest(after: "end", of: line)?.isEmpty == true {
            guard open > 0 else { return false }
            open -= 1
            events.append(.closes)
            return true
        }
        if let opening = MermaidSequenceKeyword.opening(of: line) {
            open += 1
            events.append(.opens(opening.block, opening.title))
            return true
        }
        guard let title = MermaidSequenceKeyword.divider(of: line) else { return nil }
        guard open > 0 else { return false }
        events.append(.divides(title))
        return true
    }

    private mutating func noted(_ line: String) -> Bool? {
        guard let rest = MermaidSequenceKeyword.rest(after: "note", of: line) else { return nil }
        guard let note = MermaidSequenceKeyword.note(rest) else { return false }
        for name in note.over {
            use(name)
        }
        events.append(.note(note))
        return true
    }

    private mutating func messaged(_ line: String) -> Bool {
        guard let message = MermaidSequence.Message.read(line) else { return false }
        use(message.from)
        use(message.to)
        events.append(.message(message))
        return true
    }

    /// A participant the source declared. It keeps whatever place it already had — mermaid draws a
    /// name in the order it was first MET, and a declaration after the fact only says more about
    /// it.
    private mutating func declare(_ participant: MermaidSequence.Participant) {
        guard let at = participants.firstIndex(where: { $0.name == participant.name }) else {
            participants.append(participant)
            return
        }
        participants[at] = participant
    }

    /// A name a line mentioned. New names take a column of their own, labelled with themselves.
    private mutating func use(_ name: String) {
        guard !participants.contains(where: { $0.name == name }) else { return }
        participants.append(MermaidSequence.Participant(name: name, label: name))
    }
}
