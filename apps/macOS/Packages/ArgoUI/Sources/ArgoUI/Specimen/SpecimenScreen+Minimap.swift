import SwiftUI

// The overview lane's own states (#402, #658, #382). Its own file because the lane has six of them
// and the catalog's switch is already at its ceiling — the arm there hands over to this one.

/// Which state of the lane a specimen shows.
enum MinimapLaneState: Equatable {
    case following
    case held
    case shortReading
    case namingTurn
    case everyPrompt
    case kinds
}

extension SpecimenScreen {
    /// The lane's states, keyed by the case that shows each.
    ///
    /// A map rather than a second `switch specimen`, which could only be made exhaustive with a
    /// `default` — and a `default` is exactly what would let a case added later render the wrong
    /// lane in silence. The catalog's own switch stays the exhaustive one, and it still fails the
    /// build for a `Specimen` case nobody handled.
    static let laneStates: [Specimen: MinimapLaneState] = [
        .minimapLane: .following,
        .minimapLaneHeld: .held,
        .minimapLaneShortReading: .shortReading,
        .minimapLaneNamingTurn: .namingTurn,
        .minimapLaneEveryPrompt: .everyPrompt,
        .minimapLaneKinds: .kinds,
    ]

    @ViewBuilder var minimap: some View {
        switch Self.laneStates[specimen] ?? .following {
        // A session at the length a real one reaches, following the end: the rectangle is at the
        // foot of the lane and the marks above it are the whole transcript.
        case .following:
            overview(FeedProjection.longRows)
        case .held:
            // The reader partway up the same session. What this settles is the one thing a still
            // can settle about a scrub: that the rectangle stands where the reading actually is.
            overview(FeedProjection.longRows, held: FeedProjection.longHeldRowID)
        case .shortReading:
            // Nothing to scroll. The lane draws the reading at its own size rather than stretching
            // three rows to fill it, which would read as a session ten times the length.
            overview(Array(FeedProjection.previewRows.prefix(3)))
        case .namingTurn:
            // The pointer on one Turn. The Ion Blue line spans exactly that block and its prompt is
            // drawn beside the lane — the one state a still cannot reach without being told.
            overview(FeedProjection.longRows, naming: .turn(atShare: 0.4))
        case .everyPrompt:
            // ⇧⌘. Every Turn on screen named at once, and the ones too close together to be read
            // dropped rather than stacked.
            overview(FeedProjection.longRows, naming: .everyTurn)
        case .kinds:
            // A reading with every kind in it, so the vocabulary can be judged in one look: prose,
            // commands, a mutation's two inks, a failure, a run of pictures and a question waiting.
            overview(FeedProjection.previewRows)
        }
    }
}
