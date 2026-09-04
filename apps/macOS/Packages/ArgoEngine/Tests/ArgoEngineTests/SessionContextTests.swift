@testable import ArgoEngine
import Foundation
import Testing

/// How full a Session's context is, folded out of the spends its records report. What a Session
/// HOLDS is not what it has SPENT: every request re-sends the whole conversation, so the running
/// total is tokens billed and the latest reading is tokens in the window.
@Suite("Session context")
struct SessionContextTests {
    private static let projectURL = URL(fileURLWithPath: "/tmp/argo-context")

    private func usage(input: Int, output: Int, cacheRead: Int, cacheCreation: Int) -> Usage {
        Usage(
            inputTokens: input,
            outputTokens: output,
            cacheReadTokens: cacheRead,
            cacheCreationTokens: cacheCreation,
        )
    }

    @Test
    @MainActor
    func `the context is the latest reading, not the sum of every one before it`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let observed = hubTestObservation(id: "session", events: [
            .usage(usage(input: 4000, output: 200, cacheRead: 60000, cacheCreation: 1000)),
            .usage(usage(input: 5000, output: 300, cacheRead: 90000, cacheCreation: 2000)),
        ])

        await hubObserveToEnd(hub, observed)

        // 5000 + 300 + 90000 + 2000 — all four terms of the second reading and none of the first.
        #expect(try #require(hub.sessions.first).context == .held(97300))
    }

    /// A cached token is a cheaper token, not a smaller one: the model still reads it, and on an
    /// agent run the cache is nearly the whole window.
    @Test
    @MainActor
    func `a cached read counts against the window like any other token`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let observed = hubTestObservation(id: "cached", events: [
            .usage(usage(input: 10, output: 10, cacheRead: 200_000, cacheCreation: 50000)),
        ])

        await hubObserveToEnd(hub, observed)

        #expect(try #require(hub.sessions.first).context == .held(250_020))
    }

    /// A zero here would render as an empty window — the opposite claim from an unread one.
    @Test
    @MainActor
    func `a record that priced nothing leaves the context unread, never zero`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let observed = hubTestObservation(id: "silent", events: [
            .prompt(text: "Read the contract", images: [], atMs: 1000),
            .turnEnded(.endTurn),
        ])

        await hubObserveToEnd(hub, observed)

        #expect(try #require(hub.sessions.first).context == .unread)
    }

    /// A record priced at nothing is the CLI writing a record of its OWN — a `<synthetic>` message,
    /// not a request — and no real request is made against an empty window. It says nothing about
    /// the context, so the reading does not move (#1249). Drawing `unknown` off it would put the
    /// reported placeholder back on a Session that has only just started.
    @Test
    @MainActor
    func `a record priced at nothing leaves the context exactly where it was`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let observed = hubTestObservation(id: "synthetic", events: [
            .usage(usage(input: 0, output: 0, cacheRead: 0, cacheCreation: 0)),
        ])

        await hubObserveToEnd(hub, observed)

        #expect(try #require(hub.sessions.first).context == .unread)
    }

    /// The same record after a real reading: a note the CLI wrote to itself did not empty the
    /// conversation it was written into.
    @Test
    @MainActor
    func `a record priced at nothing leaves a reading already taken standing`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let observed = hubTestObservation(id: "after", events: [
            .usage(usage(input: 4000, output: 200, cacheRead: 60000, cacheCreation: 1000)),
            .usage(usage(input: 0, output: 0, cacheRead: 0, cacheCreation: 0)),
        ])

        await hubObserveToEnd(hub, observed)

        #expect(try #require(hub.sessions.first).context == .held(65200))
    }

    /// The two absences, told apart (#1249) — the pair the header words differently. Nothing
    /// reported yet is a Session with NOTHING to say about its window and draws no instrument at
    /// all; a spend Argo READ and could not take one token off is `unknown`.
    @Test
    @MainActor
    func `a spend Argo cannot read is unreadable, where none reported is unread`() async {
        let hub = testHub(projectURL: Self.projectURL)
        let silent = hubTestObservation(id: "silent", events: [
            .prompt(text: "Read the contract", images: [], atMs: 1000),
        ])
        let unusable = hubTestObservation(id: "unusable", events: [.usage(.unreadable)])

        await hubObserveToEnd(hub, silent)
        await hubObserveToEnd(hub, unusable)

        let byID = Dictionary(uniqueKeysWithValues: hub.sessions.map { ($0.id, $0.context) })
        #expect(byID["silent"] == .unread)
        #expect(byID["unusable"] == .unreadable)
    }

    /// A window Argo once read is the last thing the Session truthfully said about itself.
    @Test
    @MainActor
    func `a spend Argo cannot read does not unsay a reading already taken`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let observed = hubTestObservation(id: "degraded", events: [
            .usage(usage(input: 1000, output: 100, cacheRead: 30000, cacheCreation: 0)),
            .usage(.unreadable),
        ])

        await hubObserveToEnd(hub, observed)

        #expect(try #require(hub.sessions.first).context == .held(31100))
    }

    /// A resumed file with no spend in it yet must not blank what the root already read.
    @Test
    @MainActor
    func `a resumed chain keeps the newest reading it has`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let root = hubTestObservation(id: "root", events: [
            .recordIdentity(uuid: "root-leaf"),
            .usage(usage(input: 1000, output: 100, cacheRead: 30000, cacheCreation: 0)),
        ])
        let child = hubTestObservation(id: "child", events: [
            .headLeaf(uuid: "root-leaf"),
            .prompt(text: "Carry on", images: [], atMs: 2000),
        ])

        await hubObserveToEnd(hub, child)
        await hubObserveToEnd(hub, root)

        #expect(try #require(hub.sessions.first).context == .held(31100))
    }
}
