@testable import ArgoEngine
import Testing

/// Wait until a transcript's tail is over, read off the Hub's own projection rather than a handle
/// into its task table.
@MainActor
func hubTailEnded(
    _ hub: Hub,
    transcriptID: String,
    at location: SourceLocation = #_sourceLocation,
) async {
    await settle(
        until: { hub.observations.contains { $0.id == transcriptID && $0.state == .stopped } },
        message: "the tail on \(transcriptID) never ended",
        at: location,
    )
    // The tail ending is not what the tail READ arriving on the roster: the join publishes at a
    // bounded rate, and every reader of the roster stands on the revision that publish stamps
    // (#1538). A publish waiting on the window is exactly the gap between the two, so a caller
    // reading the roster right after this would otherwise read the one before the batch.
    await settle(
        until: { hub.watch.waitingPublish == nil },
        message: "the change from \(transcriptID) never published",
        at: location,
    )
}
