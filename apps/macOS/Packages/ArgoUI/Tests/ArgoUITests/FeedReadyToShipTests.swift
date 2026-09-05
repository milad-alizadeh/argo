import ArgoEngine
@testable import ArgoUI
import Testing

/// What the feed says about a companion report that the change is ready for a pull request
/// (#1335) — the reason travels verbatim, and the row is drawn in place of the generic MCP
/// call the transcript would otherwise show for the same call.
@Suite("Feed ready to ship")
struct FeedReadyToShipTests {
    @Test
    func `the row quotes the reason verbatim`() {
        let claim = CompanionReady(reason: "3 files, 2 commits")

        #expect(FeedMark.readyToShip(claim).words == "ready to ship — 3 files, 2 commits")
    }

    @Test
    func `a claim with no reason still draws a row, with nothing to quote`() {
        let claim = CompanionReady(reason: nil)

        #expect(FeedMark.readyToShip(claim).words == "ready to ship")
    }

    @Test
    func `a screen reader is told the whole sentence`() {
        let claim = CompanionReady(reason: "3 files, 2 commits")

        #expect(
            FeedMark.readyToShip(claim).spoken
                == "The Session reported it is ready to ship — 3 files, 2 commits",
        )
    }

    /// The call draws as the claim's own row, never as the bare `argo · report_ready` the generic
    /// MCP reading would otherwise give it.
    @Test
    func `the call reaches the feed as the claim, not as a generic MCP row`() {
        let claim = CompanionReady(reason: "3 files, 2 commits")
        let call = ToolCall(
            id: "call-1",
            name: "mcp__argo__report_ready",
            kind: .mcp,
            target: nil,
            atMs: 1000,
            readyClaim: claim,
        )
        let rows = FeedProjection.rows(from: [
            .prompt(text: "Ship it", images: [], atMs: 1000),
            .toolCall(call),
            .turnEnded(.endTurn),
        ])

        #expect(rows.contains { $0.content == .mark(.readyToShip(claim)) })
        #expect(!rows.contains {
            if case .call = $0.content {
                true
            } else {
                false
            }
        })
    }
}
