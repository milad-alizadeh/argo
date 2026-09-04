import ArgoUI
import SwiftUI

/// Where the reading LANDS, and the lane that says so. A subject of its own rather than more feed
/// entries, because what these settle is the minimap beside the rows and not a kind of row: the
/// reading in the whole deck is `feedAtScale` and empty is `emptyFeed`, both in
/// `SpecimenRegistry+Feed.swift`.
extension SpecimenRegistry {
    static let lane: [SpecimenEntry] = [
        SpecimenEntry("feedLeftBehind") {
            SpecimenScene.sessions(FeedProjection.longRows, held: FeedProjection.longHeldRowID)
        },
        SpecimenEntry("feedLeftBehindInSilence") {
            SpecimenScene.sessions(
                FeedProjection.longSilentRows,
                held: FeedProjection.longHeldRowID,
            )
        },
        // A session at the length a real one reaches, following the end: the rectangle is at the
        // foot of the lane and the marks above it are the whole transcript.
        SpecimenEntry("minimapLane") { SpecimenScene.overview(FeedProjection.longRows) },
        // The reader partway up the same session. What this settles is the one thing a still can
        // settle about a scrub: that the rectangle stands where the reading actually is.
        SpecimenEntry("minimapLaneHeld") {
            SpecimenScene.overview(FeedProjection.longRows, held: FeedProjection.longHeldRowID)
        },
        // A session past the length the lane can draw a mark a row, where it draws a mark a Turn
        // instead (#1173). The one state the coarsening can be looked at in: the marks are Turns
        // at their true extents, and the whole session is in the lane rather than a fraction of it.
        SpecimenEntry("minimapLaneAtTurnGrain") {
            SpecimenScene.overview(FeedProjection.deepRows)
        },
        // Nothing to scroll. The lane draws the reading at its own size rather than stretching
        // three rows to fill it, which would read as a session ten times the length.
        SpecimenEntry("minimapLaneShortReading") {
            SpecimenScene.overview(Array(FeedProjection.previewRows.prefix(3)))
        },
        // The pointer on one Turn. The Ion Blue line spans exactly that block and its prompt is
        // drawn beside the lane — the one state a still cannot reach without being told.
        SpecimenEntry("minimapLaneNamingTurn") {
            SpecimenScene.overview(FeedProjection.longRows, naming: .turn(atShare: 0.4))
        },
        // ⇧⌘. Every Turn on screen named at once, and the ones too close together to be read drawn
        // as a line with no words.
        SpecimenEntry("minimapLaneEveryPrompt") {
            SpecimenScene.overview(FeedProjection.longRows, naming: .everyTurn)
        },
        // A reading with every kind in it, so the vocabulary can be judged in one look: prose,
        // commands, a mutation's two inks, a failure, a run of pictures and a question waiting.
        SpecimenEntry("minimapLaneKinds") { SpecimenScene.overview(FeedProjection.previewRows) },
        // The lane beside markdown: a table drawn as its cells, paragraphs at the widths they
        // wrapped to, and a one-line prompt worth one line of lane.
        SpecimenEntry("minimapLaneMarkdown") {
            SpecimenScene.overview(FeedProjection.previewMarkdownRows)
        },
    ]
}
