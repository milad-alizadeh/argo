import Foundation

/// A `SessionDriver` that keeps what it was asked to send instead of launching anything.
///
/// It ships in `Sources` rather than a test target because the surfaces that need it are in
/// another module, and `@testable import` does not reach across packages.
@MainActor
public final class InMemorySessionDriver: SessionDriver {
    /// What every send is answered with while it is set.
    public var refusal: SessionDriveError?

    private var turns: [String: [String]] = [:]
    /// The answers, each still naming the request it answered.
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

    /// The Turns put to one Session, in the order they were sent — the text as the user typed it,
    /// not the keystrokes it would have become (the wire encoding is `ClaudeTurn`'s own suite).
    public func sent(to sessionID: String) -> [String] {
        turns[sessionID] ?? []
    }

    /// The answers put to one Session's Permissions, in the order they were decided.
    public func decided(for sessionID: String) -> [PermissionDecision] {
        (decisions[sessionID] ?? []).map(\.decision)
    }

    /// Which request each of those answers named.
    public func decidedRequests(for sessionID: String) -> [String] {
        (decisions[sessionID] ?? []).map(\.request)
    }

    /// The standing allows taken back on one Session, in the order they were revoked.
    public func revoked(for sessionID: String) -> [String] {
        revocations[sessionID] ?? []
    }
}
