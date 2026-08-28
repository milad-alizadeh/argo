import Foundation

/// What stands where a relationship meets the box at one of its ends.
///
/// UML says the FORM of a class relationship twice — once in the stroke, once in the mark — and the
/// mark is the half that says which way round it is. An open triangle is inheritance and a filled
/// diamond is composition; a diagram that swapped them would say the opposite of what its author
/// meant and still look plausible. Crow's foot says the same thing about an entity's cardinality:
/// the MAXIMUM stands at the box's own face and the minimum a step behind it.
enum MermaidTerminal: Equatable, Sendable {
    /// Nothing: a plain link, or the far end of a one-way relationship.
    case none
    /// An arrowhead: an association, or a dependency where the stroke is dashed.
    case arrow
    /// A hollow triangle, at the PARENT: inheritance, or realisation where the stroke is dashed.
    case triangle
    /// A diamond at the WHOLE — filled for composition, hollow for aggregation.
    case diamond(isSolid: Bool)
    /// An entity's own cardinality: a fork at the face for many and a bar for one, with a ring for
    /// a minimum of none and a second bar for a minimum of one behind it.
    case crowsFoot(isMany: Bool, isOptional: Bool)

    /// How far back off the face the WHOLE mark reaches, which is the room the lane between two
    /// ranks has to keep for it. Bigger than `room` for a crow's foot, whose minimum mark stands a
    /// step behind the maximum the stroke was trimmed to.
    var depth: CGFloat {
        guard case let .crowsFoot(isMany, _) = self else { return room }
        return (isMany ? MermaidMeasure.footLength : MermaidMeasure.footStep / 2)
            + MermaidMeasure.footStep + MermaidMeasure.footDot / 2
    }

    /// How much of the stroke this mark takes off the box's face, so the line stops where the mark
    /// begins. A crow's foot's fork stops the stroke at its own apex; the bar that says ONE is
    /// drawn across the line rather than in front of it, so that end gives up nothing.
    var room: CGFloat {
        switch self {
        case .none: 0
        case .arrow: MermaidMeasure.arrowLength
        case .triangle: MermaidMeasure.markLength
        case .diamond: MermaidMeasure.diamondLength
        case let .crowsFoot(isMany, _): isMany ? MermaidMeasure.footLength : 0
        }
    }
}
