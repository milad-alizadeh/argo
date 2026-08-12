import Foundation

/// A `SessionDriver` that keeps what it was asked to send instead of launching anything.
///
/// It ships in `Sources` rather than a test target because the surfaces that need it are in
/// another module, and `@testable import` does not reach across packages.
@MainActor
public final class InMemorySessionDriver: SessionDriver {
    /// What every send is answered with while it is set.
    public var refusal: SessionDriveError?
    /// What this fake DECLARES about attachments (#540). Settable because the absence of the `+`
    /// is a designed state with a render of its own, and a fake that could only say `true` would
    /// leave the one state the capability exists to produce unreachable from a test.
    public var canAttach = true
    /// What this fake DECLARES about commands (#685). Settable, like `canAttach`.
    public var canRunCommands = true
    /// Where `attach` says it put things, keyed by attachment id. A test that has to assert what
    /// the Turn NAMED sets these; left empty, a path is invented from the id, which is enough for
    /// the far commoner claim that the paths reached the Turn at all.
    public var attachmentPaths: [UUID: URL] = [:]
    /// Run in the middle of `setMode`, so a test can move the world the way a real walk's gaps let
    /// it move — the ring is walked a keystroke at a time now, not in one write (#653).
    public var duringSetMode: (() -> Void)?

    private var turns: [String: [String]] = [:]
    private var attachments: [String: [SessionAttachment]] = [:]
    /// The answers, each still naming the request it answered.
    private var decisions: [String: [(request: String, decision: PermissionDecision)]] = [:]
    private var revocations: [String: [String]] = [:]
    private var modes: [String: [SessionMode]] = [:]

    public init() {}

    /// Answered and not recorded, unlike every other act here. An interrupt names nothing and
    /// produces nothing to read back, and no surface yet has a claim to make about one — the port's
    /// own note says a method specified ahead of its callers is a guess, and a LEDGER kept ahead of
    /// them is the same guess with state behind it. The refusal is honoured, because the failed
    /// path is what a caller does have to be able to reach.
    public func interrupt(_: String) throws {
        if let refusal {
            throw refusal
        }
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

    /// Records the rung it was asked for, which is what a surface has to be able to assert: the
    /// keystrokes that walk there are the `claude` adapter's own claim and are asserted with it.
    public func setMode(_ mode: SessionMode, for sessionID: String) async throws {
        if let refusal {
            throw refusal
        }
        duringSetMode?()
        modes[sessionID, default: []].append(mode)
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

    /// What was attached to one Session, in the order it was given.
    public func attached(to sessionID: String) -> [SessionAttachment] {
        attachments[sessionID] ?? []
    }

    /// The standing allows taken back on one Session, in the order they were revoked.
    public func revoked(for sessionID: String) -> [String] {
        revocations[sessionID] ?? []
    }

    /// The rungs one Session was put on, in the order they were asked for.
    public func rungs(for sessionID: String) -> [SessionMode] {
        modes[sessionID] ?? []
    }
}
