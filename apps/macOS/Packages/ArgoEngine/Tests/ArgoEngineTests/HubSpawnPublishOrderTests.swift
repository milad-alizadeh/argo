@testable import ArgoEngine
import Foundation
import Testing

/// WHEN in a spawn each of its two rows reaches the roster, which is a fact about the awaits and
/// not about the rows (#1681).
///
/// Both halves are measurements the shell rests a rule on, and read from source alone both look
/// like one moment. The first: `spawnSession` publishes the provisional row and then suspends — the
/// folder spelling it owes that row (#959) — so a reader on the main actor gets a pass over a
/// roster carrying the claim BEFORE the caller is handed the claim to point at, which is what puts
/// the spawn's own id in `CockpitNavigationModel`'s `rosterBeforeStart`. The second: the re-key
/// retiring that row is ONE pass, so the window has a succession edge to follow at the only pass
/// where the claim leaves.
@Suite("Hub spawn publish order")
@MainActor
struct HubSpawnPublishOrderTests {
    /// What a main-actor reader saw while the spawn ran, and whether it had answered yet. A class
    /// because the reader is a `Task` of its own and what it records outlives it.
    @MainActor
    private final class Spawning {
        var seen: [[String]] = []
        /// Set the instant the spawn answers, which is what makes every roster above it earlier.
        var hasAnswered = false
    }

    @Test
    func `publishes the provisional row before the spawn returns`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let spawning = Spawning()
        // Scheduled on the main actor before the spawn starts, so it runs at the spawn's own
        // suspension points and at no other moment. It records only while the spawn is still
        // running, which is what makes the assertion below one about ORDER.
        let reader = Task { @MainActor in
            while !spawning.hasAnswered {
                spawning.seen.append(fixture.hub.sessions.map(\.id))
                await Task.yield()
            }
        }
        defer { spawning.hasAnswered = true }

        let claim = try await fixture.hub.spawnSession(seed: SessionSeed(ticket: 899))
        spawning.hasAnswered = true
        await reader.value

        #expect(
            spawning.seen.contains { $0.contains(claim.value) },
            "Nothing could read the provisional row until the spawn returned the claim.",
        )
    }

    /// The re-key is one pass, and the shell's hold depends on it being one.
    ///
    /// The claim row is retired by the same call that binds the record to it — `reconcileSpawns`,
    /// off `TranscriptWatch.onPublished`. So no pass can show the CLI's row standing BESIDE the
    /// claim's, and none can show it without the claim absorbed. That leaves reconciliation an edge
    /// to follow at the one pass where the claim leaves: a pass that retired the row and carried no
    /// succession would reach the neighbour fallback with the started Session still on the roster,
    /// which is #1681's report.
    ///
    /// Driven a batch at a time over a LIVE observation, because the claim is what a whole-file
    /// helper would step over: `hubObserveToEnd` reports the end state and the question here is
    /// every state before it.
    @Test
    func `retires the claim row in the same pass that absorbs it`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession(seed: SessionSeed(ticket: 899))
        let (observation, continuation) = hubLiveObservation(id: spawnedChainID)
        await fixture.hub.startObserving(observation)

        var passes: [[HubSession]] = [fixture.hub.sessions]
        for batch in [
            [TranscriptEvent.cwd(fixture.projectURL.path)],
            [.prompt(text: "First", images: [], atMs: Date().epochMs)],
        ] {
            continuation.yield(batch)
            try? await Task.sleep(for: .milliseconds(60))
            passes.append(fixture.hub.sessions)
        }
        continuation.finish()
        await hubTailEnded(fixture.hub, transcriptID: observation.id)
        passes.append(fixture.hub.sessions)

        #expect(
            passes.allSatisfy { rows in
                !(rows.contains { $0.id == claim.value }
                    && rows.contains { $0.id == spawnedChainID })
            },
            "A pass drew the CLI's row beside the claim's, so the re-key is not one pass.",
        )
        #expect(
            passes.allSatisfy { rows in
                rows.first { $0.id == spawnedChainID }.map {
                    $0.absorbedIDs.contains(claim.value)
                } ?? true
            },
            "A pass published the CLI's row with the claim absorbed by nothing.",
        )
        #expect(
            passes.last?.map(\.id) == [spawnedChainID],
            "The route never reached the re-key, so neither expectation above was tested.",
        )
    }
}
