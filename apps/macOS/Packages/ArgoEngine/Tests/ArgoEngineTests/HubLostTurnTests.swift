@testable import ArgoEngine
import Testing

/// A Turn the CLI never heard, reaching the roster (#682).
///
/// The whole point of the fact is that it survives the re-key: a fresh Session is published under
/// its claim and renamed to the CLI's own id the moment a record lands, and news filed under the id
/// the row had at send time would be lost exactly when it mattered.
@Suite("Hub lost turn")
@MainActor
struct HubLostTurnTests {
    @Test
    func `a Session nobody lost a Turn at says nothing`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        #expect(fixture.hub.session(id: claim.value)?.lostTurn == nil)
    }

    /// What the watch files when it gives up, read back where the composer reads it.
    @Test
    func `a Turn the CLI never heard reaches the roster verbatim`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        fixture.hub.rememberLostTurn("what is @README.md about?", for: claim.value)

        #expect(fixture.hub.session(id: claim.value)?.lostTurn == "what is @README.md about?")
    }

    /// Taken back once the composer has the words: reported twice, a reader would put the same
    /// Turn back twice, and the second would land on the field the first one filled.
    @Test
    func `the news is spent once the composer has taken it in`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()
        fixture.hub.rememberLostTurn("Off you go.", for: claim.value)

        fixture.hub.clearLostTurn(for: claim.value)

        #expect(fixture.hub.session(id: claim.value)?.lostTurn == nil)
    }

    /// A Session Argo holds no claim on is one it cannot type at, so there was never a Turn of
    /// ours to lose — and a fact filed against no claim would have nowhere to live.
    @Test
    func `a Session Argo never spawned files nothing`() throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        fixture.hub.rememberLostTurn("Are you there", for: "a-session-somebody-else-started")

        #expect(fixture.hub.session(id: "a-session-somebody-else-started") == nil)
    }
}
