import Foundation

/// A sequence diagram as its source wrote it: who takes part, and what happens between them in the
/// order it was written.
///
/// The events are ONE flat list and the blocks are markers in it rather than a tree. A source is
/// written flat — `loop` … `end` with anything at all between — and a reader that built a tree
/// would have to decide what a stray `end` means before the layout ever sees it. Flat, the layout
/// walks it with a stack and an unbalanced source is refused by counting alone.
struct MermaidSequence: Equatable, Sendable {
    /// Everyone the diagram names, in the order it first named them — declared or merely used.
    let participants: [Participant]
    let events: [Event]

    struct Participant: Equatable, Sendable {
        let name: String
        /// What the box says. `participant A as Alice` says `Alice`; a bare name is its own label.
        var label: String
        /// Declared with `actor` rather than `participant`, and drawn as its own figure so the two
        /// are told apart before either is read.
        var isActor = false
    }

    enum Event: Equatable, Sendable {
        case message(Message)
        case note(Note)
        case activate(String)
        case deactivate(String)
        /// A block opened, and the words written after its keyword.
        case opens(Block, String)
        /// A block's own divider — `else`, `and`, `option` — and the words after it.
        case divides(String)
        case closes
    }

    /// The block constructs a frame is drawn around. Each is its own keyword and its own word in
    /// the frame's corner, which is the only thing that tells one frame from another.
    enum Block: String, Equatable, Sendable, CaseIterable {
        case loop, alt, opt, par, critical
    }

    struct Message: Equatable, Sendable {
        let from: String
        let to: String
        /// What is written after the `:`. Empty is a message mermaid still draws, so this is a
        /// string rather than an optional — one message, one caption, whatever it says.
        var text = ""
        var stroke: Stroke = .solid
        var head: Head = .filled
        /// The `+` and `-` shorthand, which activate and deactivate the far end of the arrow.
        var activates = false
        var deactivates = false
    }

    enum Stroke: Equatable, Sendable {
        case solid, dotted
    }

    /// What stands at the far end of an arrow. Four marks and not two, because mermaid gives the
    /// same line four meanings and a reader has to tell a reply from a call from a loss.
    enum Head: Equatable, Sendable {
        case none, filled, open, cross
    }

    struct Note: Equatable, Sendable {
        let placement: Placement
        /// One participant for `left of` and `right of`; one or two for `over`.
        let over: [String]
        let text: String

        enum Placement: Equatable, Sendable {
            case left, right, over
        }
    }
}

extension MermaidSequence {
    var messages: [Message] {
        events.compactMap { event -> Message? in
            guard case let .message(message) = event else { return nil }
            return message
        }
    }

    var notes: [Note] {
        events.compactMap { event -> Note? in
            guard case let .note(note) = event else { return nil }
            return note
        }
    }

    /// What each frame writes in its corner, in the order the events open and divide them —
    /// `loop [every minute]` for an opening and `[error]` for a divider, which is how mermaid
    /// itself labels the two.
    ///
    /// One per opening and one per divider, an empty one INCLUDED: the captions are paired with
    /// these by position, and a title dropped for saying nothing would slide every later caption
    /// one place along.
    var frameTitles: [String] {
        events.indices.compactMap(frameTitle(at:))
    }

    /// What the frame opened or divided at this event writes, or `nil` for an event that writes no
    /// frame word at all. One rule, so the captions the layout places and the labels the view
    /// builds cannot say two different things.
    func frameTitle(at event: Int) -> String? {
        guard events.indices.contains(event) else { return nil }
        switch events[event] {
        case let .opens(block, title):
            return title.isEmpty ? block.rawValue : "\(block.rawValue) [\(title)]"
        case let .divides(title):
            return title.isEmpty ? "" : "[\(title)]"
        case .message, .note, .activate, .deactivate, .closes:
            return nil
        }
    }

    /// One label per caption the plan places, in that order: every participant, then every message,
    /// then every note, then every frame's own word.
    ///
    /// The view builds one `Text` from each of these before SwiftUI has told it a measure, so this
    /// order is a contract between the model and `laid` rather than an incidental.
    var labels: [MermaidLabel] {
        var labels: [MermaidLabel] = participants.map { MermaidLabel(text: $0.label) }
        let aside = MermaidMeasure.edgeFace
        labels += messages.map { MermaidLabel(text: $0.text, face: aside, role: .note) }
        labels += notes.map { MermaidLabel(text: $0.text, face: aside, role: .note) }
        let framed = MermaidMeasure.groupFace
        labels += frameTitles.map { MermaidLabel(text: $0, face: framed, role: .note) }
        return labels
    }

    var names: [String] {
        participants.map(\.name)
    }

    /// Where a participant stands across the diagram, or `nil` for a name nobody declared. The
    /// reader registers every name it reads, so `nil` here is a name the layout invented.
    func column(of name: String) -> Int? {
        participants.firstIndex { $0.name == name }
    }
}
