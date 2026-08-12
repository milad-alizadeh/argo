import SwiftUI

// The overview lane's own states (#402, #658, #382). Its own file because the catalog's switch is
// already at its ceiling — the arms there name a state and hand over to this one.

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
    @ViewBuilder func minimap(_ state: MinimapLaneState) -> some View {
        switch state {
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
            // drawn as a line with no words.
            overview(FeedProjection.longRows, naming: .everyTurn)
        case .kinds:
            // A reading with every kind in it, so the vocabulary can be judged in one look: prose,
            // commands, a mutation's two inks, a failure, a run of pictures and a question waiting.
            overview(FeedProjection.previewRows)
        }
    }
}
