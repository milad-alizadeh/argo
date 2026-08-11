import Foundation

/// A `SessionDriver` that keeps what it was asked to send instead of launching anything.
///
/// It ships in `Sources` rather than a test target because the surfaces that need it are in
/// another module: a cockpit test asserting that Return sends what was typed must not need a
/// `claude` on the machine running it, and `@testable import` does not reach across packages.
///
/// This is a fake of a PORT, not of anything Argo owns the other side of — the real adapter's
/// job is bytes on a descriptor, and there is no version of that a unit test should be doing.
@MainActor
public final class InMemorySessionDriver: SessionDriver {
    /// What every send is answered with while it is set. The failure path is a designed state — a
    /// failed send keeps the text where it was typed and says why — so it needs a way to happen.
    public var refusal: SessionDriveError?

    private var turns: [String: [String]] = [:]
    /// The answers, each still naming the request it answered — the pairing is the thing a caller
    /// most needs to assert, since the bug it guards against is an answer meeting the wrong one.
    private var decisions: [String: [(request: String, decision: PermissionDecision)]] = [:]
    private var revocations: [String: [String]] = [:]

    public init() {}

    public func send(_ text: String, to sessionID: String) throws {
        if let refusal {
            throw refusal
        }
        guard SessionTurn.isSendable(text) else { throw SessionDriveError.nothingToSend }
        turns[sessionID, default: []].append(text)
    }

    public func decide(
        _ decision: PermissionDecision,
        answering requestID: String,
        for sessionID: String,
    ) throws {
        if let refusal {
            throw refusal
        }
        decisions[sessionID, default: []].append((request: requestID, decision: decision))
    }

    public func revokeStandingAllow(_ toolName: String, for sessionID: String) throws {
        if let refusal {
            throw refusal
        }
        revocations[sessionID, default: []].append(toolName)
    }

    /// The Turns put to one Session, in the order they were sent.
    ///
    /// The text as the user typed it, not the keystrokes it would have become: what a cockpit test
    /// has a claim about is the message, and the wire encoding is `ClaudeTurn`'s own suite.
    public func sent(to sessionID: String) -> [String] {
        turns[sessionID] ?? []
    }

    /// The answers put to one Session's Permissions, in the order they were decided.
    public func decided(for sessionID: String) -> [PermissionDecision] {
        (decisions[sessionID] ?? []).map(\.decision)
    }

    /// Which request each of those answers named — what a caller asserts when the claim is that the
    /// answer reached the Permission the user was reading.
    public func decidedRequests(for sessionID: String) -> [String] {
        (decisions[sessionID] ?? []).map(\.request)
    }

    /// The standing allows taken back on one Session, in the order they were revoked.
    public func revoked(for sessionID: String) -> [String] {
        revocations[sessionID] ?? []
    }
}
