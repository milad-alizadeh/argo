import Foundation

/// A state machine as its source wrote it: the states it named, the transitions between them, and
/// the composite blocks drawn around them.
///
/// Everything here is a fact the SOURCE stated. Nothing is placed or measured — that is `laid`'s,
/// and it is the layered pass of the flowchart under a different set of figures (#863).
struct MermaidState: Equatable, Sendable {
    let direction: MermaidDirection
    /// Every node, in the order the source first named one — the machine's own states, the marks
    /// `[*]` stands for, the pseudo-states and the notes.
    let nodes: [Node]
    let transitions: [Transition]
    /// The composite blocks, in the order they were opened, each carrying the names it holds.
    let composites: [Composite]

    struct Node: Equatable, Sendable {
        let name: String
        /// What the figure says. A bare state's name IS its own description, and a mark that
        /// carries no words says nothing.
        var label: String
        var figure: Figure = .state
    }

    /// The figures a state machine is drawn with. `[*]` is TWO of them, which is why the reader
    /// makes a node per END of the transition rather than one node for the token.
    enum Figure: Equatable, Sendable {
        case state, start, end, choice, fork, note

        /// Whether the figure is drawn big enough to hold words. The marks are not: mermaid draws
        /// a described choice as the same small diamond, so the description is not shown.
        var carriesWords: Bool {
            self == .state || self == .note
        }
    }

    struct Transition: Equatable, Sendable {
        let from: String
        let to: String
        /// The word written after the `:`.
        var label: String?
        var kind: Kind = .transition

        /// What joins the two. An attachment is a note's own tether: it says the note is ABOUT the
        /// state, which is a quieter thing than a machine moving from one state to another.
        enum Kind: Equatable, Sendable {
            case transition, attachment
        }
    }

    /// A composite block: the id transitions name it by, the words on its frame, and every state
    /// inside it — a nested block's members included, so the outer frame really contains the inner.
    ///
    /// Never empty in a machine the reader returned: a frame around nothing draws nothing, and the
    /// transitions naming it would then point at no node at all.
    struct Composite: Equatable, Sendable {
        let name: String
        let title: String
        var members: [String]
    }

    func node(named name: String) -> Node? {
        nodes.first { $0.name == name }
    }
}

extension MermaidState {
    /// The words this machine sets, in the runs `MermaidLabels` orders them in.
    var captions: MermaidLabels {
        MermaidLabels(
            nodes: nodes.map {
                $0.figure == .note ? MermaidLabels.edge($0.label) : MermaidLabel(text: $0.label)
            },
            edges: transitions.compactMap(\.label).map(MermaidLabels.edge),
            groups: composites.map { MermaidLabels.group($0.title) },
        )
    }

    var labels: [MermaidLabel] {
        captions.all
    }

    var names: [String] {
        nodes.map(\.name)
    }
}
