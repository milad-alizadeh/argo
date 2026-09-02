import ArgoDesign
import SwiftUI

/// A Turn while it is RUNNING, in the three ways a still can catch it: at rest, with movement
/// switched off, and after a wait long enough to have cooled.
extension SpecimenRegistry {
    static let live: [SpecimenEntry] = [
        // A Turn in progress, at the foot of the work it has done so far. The judgement is whether
        // it reads as the reading CONTINUING while sitting between the last thing the agent did and
        // the spend below it — in the same tertiary ink as every other mark, so the ellipsis is
        // doing the whole of the work.
        SpecimenEntry("feedWorking") {
            SpecimenScene.sessions(FeedProjection.previewWorkingRows)
        },
        // The command the agent is running RIGHT NOW, under the ones that finished and the one
        // that failed. Two judgements a still can make: whether the live row separates from the
        // dead ones at rest, and whether the failure keeps its ink while the ion crosses the row
        // above it. The pass itself only shows in motion.
        SpecimenEntry("feedCallInFlight") {
            SpecimenScene.sessions(FeedProjection.previewPendingCallRows)
        },
        // Both live states again with movement off. A loop has no shorter answer, so Reduce Motion
        // gets a STILL rather than a faster pass — and a still is the only half of this design
        // a PNG can judge on its own.
        //
        // The thread parked at the centre of the measure, dimmer. The judgement is whether it still
        // reads as LIVE with nothing moving — and whether a bar across the column reads as work
        // rather than as the hairline that means a Turn ended.
        SpecimenEntry("feedWorkingStill") {
            SpecimenScene.sessions(FeedProjection.previewWorkingRows)
                .environment(\.argoStillsMotion, true)
        },
        // The same row with no pass over it: the rest ink alone has to separate the live command
        // from the dead ones, which is the whole of what Reduce Motion leaves it.
        SpecimenEntry("feedCallInFlightStill") {
            SpecimenScene.sessions(FeedProjection.previewPendingCallRows)
                .environment(\.argoStillsMotion, true)
        },
        // The cooled end of `ArgoWaitAge`, forced. A period is not a thing a PNG can carry, but the
        // glow falling away is — and these are the rungs nobody would otherwise see without sitting
        // through the wait that produces them.
        //
        // Ninety seconds in: the third rung. Judged against `feedWorking` beside it — the same
        // thread, dimmer, on a wait that has stopped being part of the interaction.
        SpecimenEntry("feedWorkingAged") {
            SpecimenScene.sessions(FeedProjection.previewWorkingRows)
                .environment(\.argoAgesWait, 90)
        },
        // Past five minutes, the coldest rung there is. Nothing here warms toward
        // `state.attention`: a long think needs nothing, so it must not read as an alarm.
        SpecimenEntry("feedWorkingCooled") {
            SpecimenScene.sessions(FeedProjection.previewWorkingRows)
                .environment(\.argoAgesWait, 360)
        },
        // The other live state at the same rung. The wash cools by the ladder's proportion rather
        // than to its number, so the judgement is whether the command still reads as the live one
        // against the finished rows above it.
        SpecimenEntry("feedCallInFlightCooled") {
            SpecimenScene.sessions(FeedProjection.previewPendingCallRows)
                .environment(\.argoAgesWait, 360)
        },
    ]
}
