@testable import ArgoEngine
import Testing

/// The two cases the socket-level suite cannot reach (#493). Every other state is asserted through
/// `HubSession.companionChannel` in `CompanionChannelLivenessTests`, which is the surface a
/// consumer reads.
@Suite("Companion liveness")
@MainActor
struct CompanionLivenessTests {
    /// A CLI may hold more than one client on the channel. Only the LAST one going is a drop —
    /// otherwise a relay that reconnects would read as a channel that had been lost.
    @Test
    func `a channel still holding a client has not dropped`() {
        var log = CompanionDialLog()
        _ = log.opened(Self.claim)
        _ = log.peers(2, of: Self.claim)

        #expect(log.peers(1, of: Self.claim) == .live)
        #expect(log.peers(0, of: Self.claim) == .dropped)
    }

    /// One claim's channel says nothing about another's: a second spawn does not inherit the
    /// first one's client.
    @Test
    func `one claim's dial is not another's`() {
        var log = CompanionDialLog()
        let other = SessionOwnership.ClaimID(value: "other")
        _ = log.peers(1, of: Self.claim)

        #expect(log.peers(0, of: other) == .neverDialled)
        #expect(log.peers(0, of: Self.claim) == .dropped)
    }

    private static let claim = SessionOwnership.ClaimID(value: "claim")
}
