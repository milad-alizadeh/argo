@testable import ArgoEngine
import Foundation
import Testing

/// The half of the chain that outlives the process that made it: every claim here is about what a
/// SECOND Hub can still say.
@Suite("Handoff chain")
@MainActor
struct HandoffChainTests {
    /// A restart cannot re-adopt either PTY, so both Sessions come back read-only and the written
    /// link is the only way on.
    @Test
    func `a chain survives a restart, naming the Session the CLI chose`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        await hubObserveToEnd(fixture.hub, handedOffSessionObservation(of: fixture))
        let fresh = try await fixture.hub.spawn(SessionSeed(cwd: fixture.projectURL.path))
        fixture.hub.handedOff(sessionID: "full-session", to: fresh)
        // The fresh agent writes its first record, which is what NAMES the written link: until then
        // it is recorded against a claim, and a claim means nothing to the Argo below.
        await hubObserveToEnd(fixture.hub, spawnedSessionObservation(of: fixture))

        let restarted = fixture.restarted()
        await hubObserveToEnd(restarted, handedOffSessionObservation(of: fixture))
        await hubObserveToEnd(restarted, spawnedSessionObservation(of: fixture))

        #expect(handedOffTo(in: restarted, from: "full-session") == spawnedSessionID)
        // Nothing about the restart claims a PTY back, and the two rows say WHY differently: Argo
        // spawned the fresh one, so it is `orphaned` and resumable, and it only ever observed the
        // one that handed over (#10).
        let byID = Dictionary(uniqueKeysWithValues: restarted.sessions.map { ($0.id, $0) })
        #expect(byID["full-session"]?.provenance == .external)
        #expect(byID[spawnedSessionID]?.provenance == .orphaned)
    }

    /// A handoff whose fresh agent never wrote a record leaves an ABSENCE. The claim it was
    /// recorded against died with the process, and `claim-1` is not a Session anybody can be sent
    /// to.
    @Test
    func `a fresh Session that wrote no record leaves no link behind`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        await hubObserveToEnd(fixture.hub, handedOffSessionObservation(of: fixture))
        let fresh = try await fixture.hub.spawn(SessionSeed(cwd: fixture.projectURL.path))
        fixture.hub.handedOff(sessionID: "full-session", to: fresh)

        // This process can still follow it — the claim IS the row's id here.
        #expect(handedOffTo(in: fixture.hub, from: "full-session") == fresh)

        let restarted = fixture.restarted()
        await hubObserveToEnd(restarted, handedOffSessionObservation(of: fixture))

        #expect(handedOffTo(in: restarted, from: "full-session") == nil)
    }

    /// Two windows hand off at the same moment. The store folds each change into what is on disk
    /// NOW rather than writing the copy it loaded at launch, so neither link is lost.
    @Test
    func `a second window's link is not written over`() throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let other = HandoffChainStore(fileURL: fixture.chainFileURL)

        fixture.hub.handedOff(sessionID: "mine", to: "claim-1")
        other.update { chain in
            chain.record(from: "theirs", claim: "claim-9", atMs: 1000)
            return true
        }

        let onDisk = HandoffChainStore(fileURL: fixture.chainFileURL).load()
        #expect(onDisk.links.map(\.from).sorted() == ["mine", "theirs"])
    }

    /// A Hub with nowhere to write remembers nothing — and, more to the point, READS nothing: no
    /// test and no render harness may answer out of the machine's own chain file.
    @Test
    func `a Hub given no chain file remembers nothing`() {
        let store = HandoffChainStore(fileURL: nil)

        store.update { chain in
            chain.record(from: "full", claim: "claim-1", atMs: 1000)
            return true
        }

        #expect(store.load() == HandoffChain())
        #expect(SpawnServices.none.chainFileURL == nil)
    }

    /// Where a Session has handed off twice, the reading follows the NEWEST link.
    @Test
    func `the newest link is the one the reading follows`() {
        var chain = HandoffChain()
        chain.record(from: "full", claim: "claim-1", atMs: 1000)
        chain.record(from: "full", claim: "claim-2", atMs: 2000)
        // Named outside the `#expect`, which cannot call a mutating member on its own capture.
        let namedFirst = chain.name(claim: "claim-1", as: "first-successor")
        let namedSecond = chain.name(claim: "claim-2", as: "second-successor")

        #expect(namedFirst)
        #expect(namedSecond)
        #expect(chain.resolved == ["full": "second-successor"])
    }

    /// Naming is once per claim, and answers whether it did anything — this is asked on every
    /// observation batch, and a store written on each of them would rewrite the file all day.
    @Test
    func `naming an unknown or already-named claim changes nothing`() {
        var chain = HandoffChain()
        chain.record(from: "full", claim: "claim-1", atMs: 1000)

        let named = chain.name(claim: "claim-1", as: "fresh")
        let renamed = chain.name(claim: "claim-1", as: "somebody-else")
        let unknown = chain.name(claim: "claim-7", as: "unrelated")

        #expect(named)
        #expect(!renamed)
        #expect(!unknown)
        #expect(chain.resolved == ["full": "fresh"])
    }

    /// The chain file sits beside the briefs it is about, in Argo's own per-machine data.
    @Test
    func `the chain is remembered beside the briefs`() {
        #expect(HandoffChainStore.defaultFileURL.lastPathComponent == "chain.json")
        #expect(HandoffChainStore.defaultFileURL.deletingLastPathComponent() == Hub.handoffRoot)
    }

    private func handedOffTo(in hub: Hub, from sessionID: String) -> String? {
        hub.sessions.first { $0.id == sessionID }?.handedOffTo
    }
}
