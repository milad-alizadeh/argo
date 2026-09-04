@testable import ArgoEngine
import Foundation
import Testing

/// What a Session has SPENT, folded out of the same records the context reading is taken from.
///
/// The context is the LATEST reading and the spend is every reading SUMMED — a fold that mixed
/// them would report a Session as either forty times over its window or as having cost one turn.
@Suite("Session spend")
struct SessionSpendTests {
    private static let projectURL = URL(fileURLWithPath: "/tmp/argo-spend")

    private func usage(_ input: Int, cacheRead: Int = 0) -> Usage {
        Usage(
            inputTokens: input,
            outputTokens: 0,
            cacheReadTokens: cacheRead,
            cacheCreationTokens: 0,
        )
    }

    @Test
    @MainActor
    func `the spend is every reported spend summed, where the context is only the last`() async
        throws {
        let hub = testHub(projectURL: Self.projectURL)
        let observed = hubTestObservation(id: "session", events: [
            .usage(usage(1000, cacheRead: 30000)),
            .usage(usage(2000, cacheRead: 50000)),
        ])

        await hubObserveToEnd(hub, observed)

        let session = try #require(hub.sessions.first)
        #expect(session.spentTokens == 3000)
        #expect(session.cachedTokens == 80000)
        #expect(session.contextTokens == 52000)
    }

    /// A Session whose records priced nothing has not spent nothing — the header leaves the fact
    /// off the line altogether.
    @Test
    @MainActor
    func `a Session nothing priced carries no spend at all`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let observed = hubTestObservation(id: "silent", events: [
            .prompt(text: "Read the contract", images: [], atMs: 1000),
            .turnEnded(.endTurn),
        ])

        await hubObserveToEnd(hub, observed)

        let session = try #require(hub.sessions.first)
        #expect(session.spentTokens == nil)
        #expect(session.cachedTokens == nil)
        #expect(session.subagentTokens == nil)
    }

    /// `CONTEXT.md` L3: a subagent's turns run in a sidechain the parent transcript does not
    /// attribute, so the delegating call's result is the only place its spend is ever reported —
    /// and it rolls into the Session's total as well, since the Session paid for it.
    @Test
    @MainActor
    func `a subagent's spend is read off the delegating call's result`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let observed = hubTestObservation(id: "delegating", events: [
            .usage(usage(1000)),
            .toolCallOutcome(ToolCallOutcome(
                id: "call-1",
                resolution: ToolCallOutcome.Resolution(
                    status: .completed,
                    result: nil,
                    endedAtMs: 2000,
                ),
                delegated: ToolCallOutcome.Delegated(usage: usage(40000, cacheRead: 900_000)),
            )),
        ])

        await hubObserveToEnd(hub, observed)

        let session = try #require(hub.sessions.first)
        // The FRESH half, like `spentTokens` beside it on the same header line. A Subagent's
        // reported usage rolls up its own requests, so the billed sum would carry the whole
        // conversation once per Turn and read an order of magnitude above the line's other
        // figure (#1177) — 940k where the Session itself spent 41k.
        #expect(session.subagentTokens == 40000)
        #expect(session.spentTokens == 41000)
        #expect(session.cachedTokens == 900_000)
    }

    /// An ordinary call reports no usage of its own, which must leave the subagent line ABSENT
    /// rather than at zero — `0 in background agents` on the header would claim none ran.
    @Test
    @MainActor
    func `a call that reported no spend leaves the subagent line absent, never zero`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let observed = hubTestObservation(id: "plain", events: [
            .usage(usage(1000)),
            .toolCallOutcome(ToolCallOutcome(
                id: "call-1",
                resolution: ToolCallOutcome.Resolution(
                    status: .completed,
                    result: nil,
                    endedAtMs: 2000,
                ),
                // Spelled out rather than defaulted: the absent spend is what this claims.
                delegated: ToolCallOutcome.Delegated(usage: nil),
            )),
        ])

        await hubObserveToEnd(hub, observed)

        let session = try #require(hub.sessions.first)
        #expect(session.subagentTokens == nil)
        #expect(session.spentTokens == 1000)
    }

    /// A resume chain is one Session and one bill. The context reading is REPLACED across the
    /// stitch and the spend is ADDED, which is the whole difference between the two folds.
    @Test
    @MainActor
    func `a resumed chain adds what both halves spent`() async throws {
        let hub = testHub(projectURL: Self.projectURL)
        let root = hubTestObservation(id: "root", events: [
            .recordIdentity(uuid: "root-leaf"),
            .usage(usage(1000)),
        ])
        let child = hubTestObservation(id: "child", events: [
            .headLeaf(uuid: "root-leaf"),
            .usage(usage(2000)),
        ])

        await hubObserveToEnd(hub, child)
        await hubObserveToEnd(hub, root)

        #expect(try #require(hub.sessions.first).spentTokens == 3000)
    }
}
