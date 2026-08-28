import Foundation

/// The words a layered diagram sets, in the three runs its plan places them in: every node, then
/// every edge that carries one, then every enclosure's title.
///
/// The order is a CONTRACT between a model and its `laid`, not an incidental — `MermaidLayout`
/// pairs one `Text` to one caption by position alone. Held here rather than spelled per reader,
/// because a contract each reader states for itself is a contract two readers can drift on.
struct MermaidLabels: Equatable, Sendable {
    let nodes: [MermaidLabel]
    let edges: [MermaidLabel]
    let groups: [MermaidLabel]

    var all: [MermaidLabel] {
        nodes + edges + groups
    }

    /// A word on a connector. Quieter than the nodes it joins: it is said ABOUT the diagram.
    static func edge(_ text: String) -> MermaidLabel {
        MermaidLabel(text: text, face: MermaidMeasure.edgeFace, role: .note)
    }

    /// An enclosure's own title, on the same terms at the frame's weight.
    static func group(_ text: String) -> MermaidLabel {
        MermaidLabel(text: text, face: MermaidMeasure.groupFace, role: .note)
    }
}
