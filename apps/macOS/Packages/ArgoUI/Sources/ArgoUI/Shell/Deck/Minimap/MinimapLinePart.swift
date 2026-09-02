import Foundation
import ProseText

/// One piece of a row the feed says in a single line, as the row draws it: the words, the face they
/// are set in, and the ink they take.
///
/// A call's line is six of these and not one bar. Each carries its own ink because the row draws
/// them in their own inks — the `+n` in the added role and the `−n` in the removed one — and a lane
/// that painted the whole sentence one colour and then guessed a fixed slab at the trailing edge
/// lost both the position and the proportion of the one fact a reader scans a mutation for.
struct MinimapLinePart: Equatable, Sendable {
    /// What it says. Empty for a piece drawn as a shape rather than as words — a call's mark.
    var text: String
    var ink: FeedInk
    var face: ProseFace = .body
    /// A column the row reserves whatever the words measure. `nil` for a piece as wide as it reads.
    var width: CGFloat?
}

extension MinimapLinePart {
    /// A word of the sentence, as wide as it measures.
    static func words(_ text: String, _ ink: FeedInk, in face: ProseFace = .body)
        -> MinimapLinePart {
        MinimapLinePart(text: text, ink: ink, face: face)
    }

    /// A fixed column — the mark a call opens with, drawn empty where the kind has no glyph so that
    /// every verb in a run of calls starts on one vertical.
    static func column(_ width: CGFloat, _ ink: FeedInk) -> MinimapLinePart {
        MinimapLinePart(text: "", ink: ink, width: width)
    }

    /// How wide this piece is drawn: its column where it has one, and what its words measure
    /// otherwise.
    @MainActor var drawnWidth: CGFloat {
        width ?? ProseMetrics.width(of: text, in: face)
    }
}
