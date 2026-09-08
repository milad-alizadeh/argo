@testable import ArgoEngine
import Foundation
import Testing

/// What becomes of an id the roster has already published, when a later sweep finds the Session it
/// continues (#1481).
///
/// `HubJoinPublishable` holds a resume file back until its origin is read, but only ONCE: a
/// transcript that has stood on the roster stands through every later sweep (#1134). So a widened
/// window admits an origin whose continuation is already published, and the fold absorbs it. That
/// is the right reading — one Session, one row — but it retires an id the window may be pointing
/// at, and the row has to say so or every surface holding that id reads the Session as ended.
@Suite("Retired Session ids")
@MainActor
struct HubSessionRetiredIDsTests {
    private static let projectURL = URL(fileURLWithPath: "/tmp/argo-roster-identity")

    /// The reported shape: the reader is on a resume file that stood alone, and the sweep that
    /// finds its origin takes the row's id out from under them.
    @Test
    func `a row absorbing a published Session carries the id it was published under`() async {
        let hub = testHub(projectURL: Self.projectURL)
        let child = hubTestObservation(id: "child", events: [.headLeaf(uuid: "root-leaf")])
        await hubObserveToEnd(hub, child)
        #expect(hub.sessions.map(\.id) == ["child"])

        let root = hubTestObservation(id: "root", events: [.recordIdentity(uuid: "root-leaf")])
        await hubObserveToEnd(hub, root)

        #expect(hub.sessions.map(\.id) == ["root"])
        #expect(hub.sessions.map(\.absorbedIDs) == [["child"]])
    }

    /// The other link a chain is built on: a worktree relocation shares no record with its origin
    /// and names the origin session outright (#735, #770). Same absorption, same retired id.
    @Test
    func `a row absorbing a relocated Session carries the id it was published under`() async {
        let hub = testHub(projectURL: Self.projectURL)
        let moved = hubTestObservation(id: "moved", events: [.originSession(id: "origin")])
        await hubObserveToEnd(hub, moved)
        #expect(hub.sessions.map(\.id) == ["moved"])

        let origin = hubTestObservation(id: "origin", events: [.cwd("/tmp/origin")])
        await hubObserveToEnd(hub, origin)

        #expect(hub.sessions.map(\.id) == ["origin"])
        #expect(hub.sessions.map(\.absorbedIDs) == [["moved"]])
    }

    /// The other relocation shape moves one transcript file between record directories. Its UUID
    /// stays fixed while its path, which is the roster key, changes underneath the selected row.
    @Test
    func `a moved transcript carries the path its row was published under`() async {
        let hub = testHub(projectURL: Self.projectURL)
        let originalURL = recordURL("-tmp-argo-roster-identity", "same-session")
        let movedURL = recordURL("-tmp-argo-roster-identity-worktree", "same-session")
        await hubObserveToEnd(
            hub,
            hubTestObservation(at: originalURL, events: [
                .prompt(text: "Start", images: [], atMs: 1000),
            ]),
        )
        #expect(hub.sessions.map(\.id) == [originalURL.path])

        await hubObserveToEnd(
            hub,
            hubTestObservation(at: movedURL, events: [
                .prompt(text: "Continue", images: [], atMs: 2000),
            ]),
        )

        #expect(hub.sessions.map(\.id) == [movedURL.path])
        #expect(hub.sessions.map(\.absorbedIDs) == [[originalURL.path]])
    }

    /// A chain of three, folded root-first: the middle link's own id has to survive the second
    /// merge, or a reader who was on the earliest resume is the one left pointing at nothing.
    @Test
    func `a chain of three carries every id it retired`() async {
        let hub = testHub(projectURL: Self.projectURL)
        let last = hubTestObservation(id: "last", events: [.headLeaf(uuid: "middle-leaf")])
        let middle = hubTestObservation(
            id: "middle",
            events: [.recordIdentity(uuid: "middle-leaf"), .headLeaf(uuid: "root-leaf")],
        )
        await hubObserveToEnd(hub, last)
        await hubObserveToEnd(hub, middle)

        let root = hubTestObservation(id: "root", events: [.recordIdentity(uuid: "root-leaf")])
        await hubObserveToEnd(hub, root)

        #expect(hub.sessions.map(\.id) == ["root"])
        #expect(hub.sessions.map(\.absorbedIDs) == [["middle", "last"]])
    }

    /// The other id a row retires: a spawn stands under its CLAIM until the CLI writes a record,
    /// and then under the id the CLI picked (#361). One agent, one row, two ids — and a window
    /// pointed at the provisional one has to follow it (#1176).
    @Test
    func `a row re-keyed to its CLI's own id carries the claim it stood under`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession()

        await hubObserveToEnd(fixture.hub, fixture.observedSpawn())

        #expect(fixture.hub.sessions.map(\.absorbedIDs) == [[claim.value]])
    }

    /// The control. A roster with no chain in it retires nothing, so nothing downstream may read a
    /// Session as having been absorbed when it simply ended.
    @Test
    func `a Session standing on its own absorbs nothing`() async {
        let hub = testHub(projectURL: Self.projectURL)
        await hubObserveToEnd(
            hub,
            hubTestObservation(id: "alone", events: [.title("Alone", .summarised)]),
        )

        #expect(hub.sessions.map(\.absorbedIDs) == [[]])
    }
}
