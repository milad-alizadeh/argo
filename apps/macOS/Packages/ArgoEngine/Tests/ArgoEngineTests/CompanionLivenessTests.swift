@testable import ArgoEngine
import Foundation
import Testing

/// The companion channel's four states (#493), read off the socket's own news and nothing else.
@Suite("Companion liveness")
@MainActor
struct CompanionLivenessTests {
    @Test
    func `a channel nothing has dialled reads never dialled`() {
        var log = CompanionDialLog()

        #expect(log.opened(Self.claim) == .neverDialled)
    }

    @Test
    func `a client on the channel reads live`() {
        var log = CompanionDialLog()
        _ = log.opened(Self.claim)

        #expect(log.peers(1, of: Self.claim) == .live)
    }

    /// The whole of the `dropped` rule: a HANG-UP, not a silence. The reading changes when the
    /// last client goes, which is a thing the socket told Argo.
    @Test
    func `a channel whose last client hung up reads dropped`() {
        var log = CompanionDialLog()
        _ = log.opened(Self.claim)
        _ = log.peers(1, of: Self.claim)

        #expect(log.peers(0, of: Self.claim) == .dropped)
    }

    /// A CLI may hold more than one client on the channel. Only the LAST one going is a drop —
    /// otherwise a reconnecting relay would read as a channel that had been lost.
    @Test
    func `a channel still holding a client reads live when another goes`() {
        var log = CompanionDialLog()
        _ = log.opened(Self.claim)
        _ = log.peers(2, of: Self.claim)

        #expect(log.peers(1, of: Self.claim) == .live)
    }

    @Test
    func `a channel that dialled and was withdrawn reads dropped`() {
        var log = CompanionDialLog()
        _ = log.opened(Self.claim)
        _ = log.peers(1, of: Self.claim)

        #expect(log.closed(Self.claim) == .dropped)
    }

    /// Nothing was lost with a channel nothing ever reached, so the withdrawal states the reading
    /// it already had. `dropped` here would name a loss that never happened.
    @Test
    func `a channel withdrawn before anything dialled it keeps never dialled`() {
        var log = CompanionDialLog()
        _ = log.opened(Self.claim)

        #expect(log.closed(Self.claim) == .neverDialled)
    }

    /// One claim's channel says nothing about another's: the log is keyed, so a second spawn does
    /// not inherit the first one's client.
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
