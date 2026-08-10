@testable import ArgoEngine
import Foundation
import Testing

/// How full a Session's context is, folded out of the spends its records report.
///
/// The distinction every assertion here turns on: what a Session HOLDS is not what it has SPENT.
/// Every request re-sends the whole conversation, so the running total is tokens billed and the
/// latest reading is tokens in the window — and confusing the two reports a Session forty turns in
/// as tens of times past a window it is nowhere near.
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
        #expect(try #require(hub.sessions.first).contextTokens == 97300)
    }

    /// A cached token is a cheaper token, not a smaller one: the model still reads it. Asserted on
    /// its own because dropping the cache is the plausible mistake, and on an agent run the cache
    /// is nearly the whole window.
    @Test
    @MainActor
    func `a cached read counts against the window like any other token`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let observed = hubTestObservation(id: "cached", events: [
            .usage(usage(input: 10, output: 10, cacheRead: 200_000, cacheCreation: 50000)),
        ])

        await hubObserveToEnd(hub, observed)

        #expect(try #require(hub.sessions.first).contextTokens == 250_020)
    }

    /// The honest gap. A Session whose records priced nothing has no context reading, and a zero
    /// here would be rendered as an empty window — the opposite claim from an unread one.
    @Test
    @MainActor
    func `a record that priced nothing leaves the context unread, never zero`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let observed = hubTestObservation(id: "silent", events: [
            .prompt(text: "Read the contract", atMs: 1000),
            .turnEnded(.endTurn),
        ])

        await hubObserveToEnd(hub, observed)

        #expect(try #require(hub.sessions.first).contextTokens == nil)
    }

    /// A resume chain is one Session, and the reading it carries is the one from its later half —
    /// but only where that half reported one at all. A resumed file with no spend in it yet must
    /// not blank what the root already read.
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
            .prompt(text: "Carry on", atMs: 2000),
        ])

        await hubObserveToEnd(hub, child)
        await hubObserveToEnd(hub, root)

        #expect(try #require(hub.sessions.first).contextTokens == 31100)
    }
}
