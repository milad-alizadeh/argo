import Foundation

/// What Argo can do TO a Session, as against everything else in the engine, which observes one.
///
/// One method, deliberately. The port is introduced by the first surface that needs it and grows a
/// method at a time as the surfaces that need them land (#535) — a protocol specified ahead of its
/// callers is a set of guesses about what they will want, and every guess that turns out wrong is
/// paid for by an adapter implementing something nothing asks for.
///
/// Not class-bound: the real adapter is a value over two references the Hub already holds, and the
/// fake is a class because recording is what it is for.
@MainActor
public protocol SessionDriver {
    /// Put one Turn to a Session, as though the user had typed it at that CLI's own prompt.
    ///
    /// Keyed by the id the roster carries — a claim's own id before its CLI has written a record,
    /// and the CLI's id afterwards — because that is the only handle a surface has. Synchronous and
    /// throwing: a keystroke either reaches a descriptor or it does not, and there is nothing to
    /// wait for in between.
    func send(_ text: String, to sessionID: String) throws

    /// Answer the Session's oldest pending Permission (#542, under #535 / ADR-0024). Keyed and
    /// shaped like `send`, and for the same reasons; the pending Permission itself travels the
    /// observation side — Hub to presentation — because observation is not on this port.
    func decide(_ decision: PermissionDecision, for sessionID: String) throws
}

/// Whether there is a Turn in the text at all. On the port rather than in an adapter — it is the
/// one rule `nothingToSend` is raised by, and the control that disables send and the driver that
/// refuses must not be able to disagree about what an empty message is.
public enum SessionTurn {
    public static func isSendable(_ text: String) -> Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

/// Why a Turn did not reach a Session, in words fit to repeat to the user (`ComposerSeam`).
public enum SessionDriveError: Error, Equatable {
    /// No PTY this Argo owns answers to that Session: an external one, or a managed one whose
    /// process has gone. The composer is absent for both, so this is the race between drawing it
    /// and the PTY ending rather than a state a user can sit in.
    case notDrivable
    /// The field held nothing but whitespace. A refusal rather than a silent no-op, because the
    /// alternative is a bare Return at a live prompt — an empty Turn that reads as the user having
    /// asked for something.
    case nothingToSend
    /// A decision arrived after the Permission it answered was gone — expired on the hook's own
    /// clock, or cancelled with its turn. Said rather than swallowed, because the user pressed
    /// something and nothing happened.
    case nothingPending

    /// What the seam says. Verbatim, and short enough to sit on one line above the field.
    public var detail: String {
        switch self {
        case .notDrivable: "Argo no longer holds this Session — nothing was sent"
        case .nothingToSend: "Nothing to send"
        case .nothingPending: "No Permission is waiting on this Session"
        }
    }
}
