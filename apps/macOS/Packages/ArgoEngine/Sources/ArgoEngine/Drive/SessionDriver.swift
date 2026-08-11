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

    /// Stop the Turn a Session is running (#541). Keyed by Session like `send`, and with nothing
    /// else to name: there is one Turn in flight at a time, so an interrupt has no second thing it
    /// could have meant.
    ///
    /// It does NOT refuse a Session that is running nothing. Whether a Turn is in flight is a
    /// DERIVED reading off the record, and the moment between that reading and the click is exactly
    /// where a Turn ends on its own — a refusal there would report Argo's own lag as something the
    /// user did wrong. The keystroke lands at an idle prompt and changes nothing, so the honest
    /// answer to "stop what was already stopped" is silence.
    func interrupt(_ sessionID: String) throws

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

    /// Whether this adapter takes attachments at all (#540) — the composer omits the `+` rather
    /// than disabling it, and a drop is refused with the reason.
    var canAttach: Bool { get }

    /// Put the user's attachments where this Session's agent can read them, and answer their
    /// absolute paths, in the order given — the order the Turn names them in. It does not send;
    /// `send` carries the Turn that names these paths, so message and files arrive as one Turn.
    func attach(_ attachments: [SessionAttachment], to sessionID: String) throws -> [URL]

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

    /// The one Turn a message with attachments becomes: the words, then each path on its own line.
    ///
    /// The paths are INJECTED and the files are not read — the agent's own `Read` pulls them in,
    /// which is what puts the bytes in the transcript at the point it actually looked (#540). On
    /// the port beside `isSendable` for the same reason that is: the composer's sendability and the
    /// text that finally goes must not be able to disagree about what an attachment adds.
    ///
    /// A message of nothing but attachments is a Turn — the paths are the whole of what was said —
    /// which is why the empty case answers the paths rather than a blank line above them.
    public static func text(_ message: String, attaching paths: [URL]) -> String {
        let words = message.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !paths.isEmpty else { return message }
        let named = paths.map(\.path).joined(separator: "\n")
        return words.isEmpty ? named : "\(words)\n\n\(named)"
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
    /// Something was dropped on a Session whose adapter takes no attachments (#540). A refusal
    /// with a reason rather than a drop that lands nowhere: the affordance is absent, so the only
    /// way to reach this is a gesture the platform allows over any window, and a gesture that
    /// appears to work and does nothing is the one outcome design decision 9 rules out.
    case cannotAttach
    /// An attachment could not be written down, so no path could be named. The message stays where
    /// it was typed and the chips stay where they were, for the reason a refused send does: what
    /// failed is Argo's own act, and nothing about the Turn has happened yet.
    case attachmentUnwritable

    /// What the seam says. Verbatim, and short enough to sit on one line above the field.
    public var detail: String {
        switch self {
        case .notDrivable: "Argo no longer holds this Session — nothing was sent"
        case .nothingToSend: "Nothing to send"
        case .nothingPending: "No Permission is waiting on this Session"
        case .noSuchGrant: "This Session holds no standing allow for that tool"
        case .cannotAttach:
            "This adapter takes no attachments — dropped files are refused rather than "
                + "silently dropped."
        case .attachmentUnwritable: "Argo could not write that attachment down — nothing was sent"
        }
    }
}
