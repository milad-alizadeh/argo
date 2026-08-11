import Foundation

/// What Argo can do TO a Session, as against everything else in the engine, which observes one.
///
/// Not class-bound: the real adapter (`ClaudeSessionDriver`) is a struct.
@MainActor
public protocol SessionDriver {
    /// Put one Turn to a Session, as though the user had typed it at that CLI's own prompt.
    ///
    /// Keyed by the id the roster carries — a claim's own id before its CLI has written a record,
    /// and the CLI's id afterwards. Synchronous and throwing: a keystroke either reaches a
    /// descriptor or it does not, and there is nothing to wait for in between.
    func send(_ text: String, to sessionID: String) throws

    /// Answer ONE pending Permission, named (#542, under #535 / ADR-0024). Keyed by Session like
    /// `send`, and by the request's own id besides, because a Session can have more than one call
    /// waiting: answering "whatever is pending" would spend the user's Allow on a prompt that
    /// replaced the one they read. A request that is no longer waiting raises `nothingPending`
    /// rather than falling through to its neighbour.
    ///
    /// The pending Permission itself travels the observation side — Hub to presentation.
    func decide(
        _ decision: PermissionDecision,
        answering requestID: String,
        for sessionID: String,
    ) throws

    /// Take back one standing allow (#572) — the way OUT of `allowAlways`.
    ///
    /// Named by tool because that is what the grant is keyed by, and a grant that was already gone
    /// raises `noSuchGrant` rather than passing silently.
    func revokeStandingAllow(_ toolName: String, for sessionID: String) throws
}

/// Whether there is a Turn in the text at all — the one rule `nothingToSend` is raised by, shared
/// so the control that disables send and the driver that refuses cannot disagree.
public enum SessionTurn {
    public static func isSendable(_ text: String) -> Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

/// Why a Turn did not reach a Session, in words fit to repeat to the user (`ComposerSeam`).
public enum SessionDriveError: Error, Equatable {
    /// No PTY this Argo owns answers to that Session: an external one, or a managed one whose
    /// process has gone.
    case notDrivable
    /// The field held nothing but whitespace.
    case nothingToSend
    /// A decision arrived after the Permission it answered was gone — expired on the hook's own
    /// clock, or cancelled with its turn.
    case nothingPending
    /// A revocation arrived for a standing allow this Session does not hold — revoked twice, or
    /// gone with the Session it was granted on.
    case noSuchGrant

    /// What the seam says. Verbatim, and short enough to sit on one line above the field.
    public var detail: String {
        switch self {
        case .notDrivable: "Argo no longer holds this Session — nothing was sent"
        case .nothingToSend: "Nothing to send"
        case .nothingPending: "No Permission is waiting on this Session"
        case .noSuchGrant: "This Session holds no standing allow for that tool"
        }
    }
}
