import Foundation

/// Compartmented boxes joined by annotated relationships — what a class diagram and an entity
/// diagram BOTH are.
///
/// One model and not two. The ticket makes the pair one piece of work because the compartment
/// renderer serves both, and once the boxes are compartments and the ends are terminals there is
/// nothing left for a second model to say: the difference between the two diagram types is entirely
/// in the READERS that state this, and in which terminals those readers produce (#865).
struct MermaidCompartmented: Equatable, Sendable {
    let direction: MermaidDirection
    /// Every box, in the order the source first named one.
    let boxes: [Box]
    let relations: [MermaidRelation]

    struct Box: Equatable, Sendable {
        let name: String
        var compartments: MermaidCompartments
    }

    var names: [String] {
        boxes.map(\.name)
    }

    /// The words this diagram sets, in the four runs its plan places them in: every box's own
    /// lines, then each relationship's word, then the word at each of its ends.
    ///
    /// The order is a CONTRACT with `laid` — `MermaidLayout` pairs one `Text` to one caption by
    /// position alone.
    var labels: [MermaidLabel] {
        boxes.flatMap(\.compartments.labels)
            + relations.compactMap(\.label).map(MermaidLabels.edge)
            + relations.compactMap(\.tailWord).map(MermaidLabels.edge)
            + relations.compactMap(\.headWord).map(MermaidLabels.edge)
    }
}

/// One relationship: which two boxes it joins, how it is stroked, what stands at each end, and the
/// three words it can carry — its own, and one against each of the boxes it names.
struct MermaidRelation: Equatable, Sendable {
    let from: String
    let to: String
    var tail: MermaidTerminal = .none
    var head: MermaidTerminal = .none
    var line: MermaidFigure.Line = .solid
    /// The word written on the line itself.
    var label: String?
    /// The word written against each box — a cardinality on both sides of the trade.
    var tailWord: String?
    var headWord: String?
}
