import SwiftUI

// The overview lane's own states (#402, #658, #382). Its own file because the lane has six of them
// and the catalog's switch is already at its ceiling — the arm there hands over to this one.

extension SpecimenScreen {
    @ViewBuilder var minimap: some View {
        switch specimen {
        case .minimapLaneHeld:
            // The reader partway up a real session. What this settles is the one thing a still can
            // settle about a scrub: that the rectangle stands where the reading actually is.
            overview(FeedProjection.longRows, held: FeedProjection.longHeldRowID)
        case .minimapLaneShortReading:
            // Nothing to scroll. The lane draws the reading at its own size rather than stretching
            // three rows to fill it, which would read as a session ten times the length.
            overview(Array(FeedProjection.previewRows.prefix(3)))
        case .minimapLaneNamingTurn:
            // The pointer on one Turn. The Ion Blue line spans exactly that block and its prompt is
            // drawn over the miniature — the one state a still cannot reach without being told.
            overview(FeedProjection.longRows, naming: .turn(atShare: 0.4))
        case .minimapLaneEveryPrompt:
            // ⇧⌘. Every Turn on screen named at once, and the ones too close together to be read
            // dropped rather than stacked.
            overview(FeedProjection.longRows, naming: .everyTurn)
        case .minimapLaneKinds:
            // A reading with every kind in it, so the vocabulary can be judged in one look: prose,
            // commands, a mutation's two inks, a run of pictures and a question waiting.
            overview(FeedProjection.previewRows)
        // A session at the length a real one reaches, following the end: the rectangle is at the
        // foot of the lane and the marks above it are the whole transcript. The default arm rather
        // than a case of its own, because the catalog's switch already proved the case is a lane's.
        default:
            overview(FeedProjection.longRows)
        }
    }
}
