import ArgoUI
import SwiftUI

/// The plinth a wait stands on, and the row it drops into the reading when it ends
/// (`cockpit-feed-waiting.md`, #1323).
///
/// The pair is the whole design: while the wait runs the reading is UNTOUCHED and the plinth at the
/// foot carries it; when it ends the plinth is gone and exactly one settled row is in the reading.
/// A still can judge both, which is why they are stills and not previews.
extension SpecimenRegistry {
    static let waiting: [SpecimenEntry] = [
        // The plinth over a reading that already has something in it — the judgement `startingFeed`
        // cannot make: whether the plinth reads as the feed's foot rather than as the composer's
        // head, and whether the words separate from the last row above them.
        SpecimenEntry("waitPlinth") {
            SpecimenScene.sessions(FeedProjection.previewRows)
                .environment(\.argoFeedWait, .starting)
        },
        // The same plinth with movement off. The ion parks at the centre of its rail and the words,
        // the mark and the elapsed reading all stay — the elapsed reading is what carries the state
        // with nothing moving, which is the whole reason it is on the plinth.
        SpecimenEntry("waitPlinthStill") {
            SpecimenScene.sessions(FeedProjection.previewRows)
                .environment(\.argoFeedWait, .starting)
                .environment(\.argoStillsMotion, true)
                .environment(\.argoAgesWait, 401)
        },
        // The wait, over: the plinth gone and one settled row at the head of the reading. Judged
        // against the rows below it — a settled wait has to read as one more thing that happened.
        SpecimenEntry("waitSettled") {
            SpecimenScene.sessions(FeedProjection.previewSettledWaitRows)
        },
        // The wait, failed. Drawn exactly as a failed call is, so the judgement is that the two are
        // told apart by nothing but their words.
        SpecimenEntry("waitFailed") {
            SpecimenScene.sessions(FeedProjection.previewFailedWaitRows)
        },
    ]
}
