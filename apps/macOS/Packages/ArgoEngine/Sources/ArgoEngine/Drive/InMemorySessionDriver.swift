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
    /// What this fake DECLARES about attachments (#540). Settable because the absence of the `+`
    /// is a designed state with a render of its own, and a fake that could only say `true` would
    /// leave the one state the capability exists to produce unreachable from a test.
    public var canAttach = true
    /// Where `attach` says it put things, keyed by attachment id. A test that has to assert what
    /// the Turn NAMED sets these; left empty, a path is invented from the id, which is enough for
    /// the far commoner claim that the paths reached the Turn at all.
    public var attachmentPaths: [UUID: URL] = [:]

    private var turns: [String: [String]] = [:]
    private var attachments: [String: [SessionAttachment]] = [:]
    /// The answers, each still naming the request it answered — the pairing is the thing a caller
    /// most needs to assert, since the bug it guards against is an answer meeting the wrong one.
    private var decisions: [String: [(request: String, decision: PermissionDecision)]] = [:]
    private var revocations: [String: [String]] = [:]
    private var interrupts: [String: Int] = [:]

    public init() {}

    public func interrupt(_ sessionID: String) throws {
        if let refusal {
            throw refusal
        }
        interrupts[sessionID, default: 0] += 1
    }

    public func send(_ text: String, to sessionID: String) throws {
        if let refusal {
            throw refusal
        }
        guard SessionTurn.isSendable(text) else { throw SessionDriveError.nothingToSend }
        turns[sessionID, default: []].append(text)
    }

    /// Records what it was given and answers an address for each, without writing anything. A fake
    /// of the PORT: where bytes actually land is `AttachmentStore`'s claim and is asserted there.
    public func attach(_ attachments: [SessionAttachment], to sessionID: String) throws -> [URL] {
        guard canAttach else { throw SessionDriveError.cannotAttach }
        if let refusal {
            throw refusal
        }
        self.attachments[sessionID, default: []].append(contentsOf: attachments)
        return attachments.map { attachmentPaths[$0.id] ?? URL(filePath: "/tmp/\($0.name)") }
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

    /// What was attached to one Session, in the order it was given.
    public func attached(to sessionID: String) -> [SessionAttachment] {
        attachments[sessionID] ?? []
    }

    /// The standing allows taken back on one Session, in the order they were revoked.
    public func revoked(for sessionID: String) -> [String] {
        revocations[sessionID] ?? []
    }

    /// How many times one Session was stopped. A COUNT and not a list, because an interrupt names
    /// nothing: what a caller has a claim about is that the stop reached the port, and how often.
    public func interrupted(_ sessionID: String) -> Int {
        interrupts[sessionID] ?? 0
    }
}
