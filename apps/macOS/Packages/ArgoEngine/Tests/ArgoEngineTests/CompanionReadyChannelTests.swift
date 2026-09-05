@testable import ArgoEngine
import Testing

/// The channel's fourth tool, split from `CompanionChannelTests` to keep that suite under the
/// house cap (#1335) — the fixtures and helpers are the same ones, shared rather than pasted.
@Suite("Companion channel — ready to ship")
@MainActor
struct CompanionReadyChannelTests {
    @Test
    func `a reported ready claim reaches the roster at the CONVENTION tier`() async throws {
        try await CompanionChannelTests.withChannel { fixture, client in
            try await CompanionChannelTests.report(
                client, "report_ready", ["reason": "3 files, 2 commits"],
            )
            await settle { fixture.hub.sessions.first?.convention?.readyToShip != nil }

            let ready = CompanionReady(reason: "3 files, 2 commits")
            #expect(fixture.hub.sessions.first?.convention?.readyToShip == ready)
        }
    }

    /// The one tool whose reading never drops the claim over a shape it did not expect — a blank
    /// reason still leaves the Session ready, only with nothing for the feed to quote.
    @Test
    func `a ready claim with no reason still stands`() async throws {
        try await CompanionChannelTests.withChannel { fixture, client in
            try await CompanionChannelTests.report(client, "report_ready", [:])
            await settle { fixture.hub.sessions.first?.convention?.readyToShip != nil }

            #expect(fixture.hub.sessions.first?.convention?
                .readyToShip == CompanionReady(reason: nil))
        }
    }
}
