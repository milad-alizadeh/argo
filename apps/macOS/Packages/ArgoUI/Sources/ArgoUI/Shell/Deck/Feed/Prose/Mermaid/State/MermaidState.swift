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

    /// The figures a state machine is drawn with.
    ///
    /// `[*]` is TWO of these — a filled dot where it is a source, a ringed dot where it is a
    /// target — which is why the reader makes a node per END rather than one node for the token.
    /// A machine whose `[*]` were one node would start where it finishes.
    enum Figure: Equatable, Sendable {
        case state, start, end, choice, fork, note
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
    struct Composite: Equatable, Sendable {
        let name: String
        let title: String
        let members: [String]
    }

    func node(named name: String) -> Node? {
        nodes.first { $0.name == name }
    }
}

extension MermaidState {
    /// One label per caption the plan places, in that order: every node, then every transition that
    /// carries a word, then every composite's title.
    ///
    /// The view builds one `Text` from each of these before SwiftUI has told it a measure, so this
    /// order is a contract between the model and `laid` rather than an incidental.
    var labels: [MermaidLabel] {
        nodeLabels + transitionLabels + compositeLabels
    }

    var nodeLabels: [MermaidLabel] {
        nodes.map {
            $0.figure == .note
                ? MermaidLabel(text: $0.label, face: MermaidMeasure.edgeFace, role: .note)
                : MermaidLabel(text: $0.label)
        }
    }

    var transitionLabels: [MermaidLabel] {
        transitions.compactMap(\.label).map {
            MermaidLabel(text: $0, face: MermaidMeasure.edgeFace, role: .note)
        }
    }

    var compositeLabels: [MermaidLabel] {
        composites.map {
            MermaidLabel(text: $0.title, face: MermaidMeasure.groupFace, role: .note)
        }
    }

    var names: [String] {
        nodes.map(\.name)
    }
}
