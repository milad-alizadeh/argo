@testable import ArgoEngine
import Foundation
import Testing

/// WHEN in a spawn the provisional row reaches the roster, which is a fact about the await and not
/// about the row (#1681).
///
/// `spawnSession` publishes the row and then suspends — the folder spelling it owes its own row
/// (#959) — so a reader on the main actor gets a pass over a roster carrying the claim BEFORE the
/// caller has been handed the claim to point at. Every consequence of that is the shell's
/// (`RosterSelectionPressAfterPublishTests`), and this is the measurement it rests on: read from
/// source alone the two look simultaneous.
@Suite("Hub spawn publish order")
@MainActor
struct HubSpawnPublishOrderTests {
    /// Every roster a main-actor reader saw while the spawn ran. A class because the reader is a
    /// `Task` of its own and what it records outlives it.
    @MainActor
    private final class Rosters {
        var seen: [[String]] = []
    }

    @Test
    func `publishes the provisional row before the spawn returns`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let rosters = Rosters()
        // Scheduled on the main actor before the spawn starts, so it runs at each of the spawn's
        // own suspension points and at no other moment.
        let reader = Task { @MainActor in
            while !Task.isCancelled {
                rosters.seen.append(fixture.hub.sessions.map(\.id))
                await Task.yield()
            }
        }

        let claim = try await fixture.hub.spawnSession(seed: SessionSeed(ticket: 899))
        reader.cancel()
        _ = await reader.result

        #expect(
            rosters.seen.contains([claim.value]),
            "Nothing could read the provisional row until the spawn returned the claim.",
        )
    }
}
