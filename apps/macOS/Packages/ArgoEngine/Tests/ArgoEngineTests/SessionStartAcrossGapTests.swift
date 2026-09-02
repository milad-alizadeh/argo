@testable import ArgoEngine
import Foundation
import Testing

/// When a Session's start is published, against a reading that runs into a gap (#1056).
///
/// A bounded read marks its seam MID-STREAM, so the records ahead of the seam were read out of a
/// whole file and the ones behind it were not. The start is therefore NOT withheld on an excerpt:
/// it is withheld only where it would have to come from beyond the seam.
@Suite("Session start across a gap")
struct SessionStartAcrossGapTests {
    private static let projectURL = URL(fileURLWithPath: "/tmp/argo-session-start")

    /// The records ahead of the seam were read out of a whole file, so the oldest of them IS the
    /// oldest moment the file holds — and a gap opening later does not un-read them.
    @Test
    @MainActor
    func `a start taken before the gap stands after it`() async {
        let hub = testHub(projectURL: Self.projectURL)

        await hubObserveToEnd(hub, hubTestObservation(id: "read-to-a-gap", events: [
            .prompt(text: "Read the contract", images: [], atMs: 1000),
            .turnEnded(.endTurn),
            .excerpted,
            .prompt(text: "And now the palette", images: [], atMs: 5000),
        ]))

        #expect(hub.sessions.first?.startedAtMs == 1000)
    }

    /// The refusal the other half of the rule makes: nothing opened the stretch behind the seam, so
    /// a moment read from beyond it cannot be shown to be the earliest one the file holds. A start
    /// only ever moves backwards, so a stamp older than the head's is the one shape in which the
    /// refusal is observable at all.
    @Test
    @MainActor
    func `a moment read beyond the gap is refused as the start`() async {
        let hub = testHub(projectURL: Self.projectURL)

        await hubObserveToEnd(hub, hubTestObservation(id: "beyond-the-gap", events: [
            .prompt(text: "Read the contract", images: [], atMs: 1000),
            .turnEnded(.endTurn),
            .excerpted,
            .compaction(atMs: 500),
        ]))

        #expect(hub.sessions.first?.startedAtMs == 1000)
    }
}
