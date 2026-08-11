import Foundation

/// A Permission that ended without anybody answering it, and that Argo itself ended (#573).
///
/// DIRECT and managed-only, like the `PermissionRequest` it ends: Argo held the clock that ran
/// out, so this is Argo reporting its own act rather than inferring one. That is the whole
/// reason the record exists — the call was refused and NOBODY refused it, so a feed that said
/// `denied` alone would credit a decision no person made, and one that said nothing at all would
/// leave a tool call with no account of what became of it.
///
/// A prompt that goes because the user cancelled the turn it belonged to produces none of these. It
/// is not this: a prompt vanishing with the turn it was raised in is the expected answer, and the
/// hook simply going is indistinguishable from it. Only Argo's own clock firing is.
public struct PermissionExpiry: Sendable, Equatable, Identifiable {
    /// The Permission's own id, kept: a Session can expire more than one call, and the record of
    /// what happened has to be as addressable as the prompt it replaces.
    public let id: String
    /// The CLI's own name for the tool that was asking, verbatim.
    public let toolName: String

    public init(id: String, toolName: String) {
        self.id = id
        self.toolName = toolName
    }

    init(_ request: PermissionRequest) {
        self.init(id: request.id, toolName: request.toolName)
    }
}

/// How long the gate waits for a person, and how long the hook is told to wait for the gate.
///
/// Two numbers rather than one, and the order between them is the point: **Argo's runs out first**,
/// so the hook is always told a decision instead of being killed holding a question. That is what
/// makes an expiry a fact Argo owns (DIRECT) rather than a peer close it would have to guess at —
/// and a guess is exactly what the degrade-down rule forbids here, because the two causes of a peer
/// close mean opposite things to a reader.
///
/// Its own value rather than a loose `Int`, so the gate's clock is a seam a test reaches in a
/// millisecond rather than a rule nothing ever exercises (`HandoffWait`'s reasoning, same shape).
public struct PermissionPatience: Sendable, Equatable {
    /// What ARGO waits. A prompt waits for the person, not for a clock: nobody is watching the
    /// cockpit the whole time an agent runs, and a window that answers by expiry answers on its
    /// own. Long enough that the timeout is never the thing that decides, and no clock is drawn
    /// because there is none worth reading (decision 6).
    public let seconds: Int

    public init(seconds: Int) {
        self.seconds = seconds
    }

    public static let `default` = PermissionPatience(seconds: 86400)

    /// The one place a test says "now" to a day-long wait.
    public static let immediate = PermissionPatience(seconds: 0)

    /// What the HOOK's own `timeout` is set to — the default patience with a margin on top, so the
    /// gate's answer always beats the hook's clock. Static, and taken off the default rather than
    /// off an instance: the number is substituted into `hooks.json` at spawn time, where the only
    /// patience that can be in force is the live one.
    public static let hookTimeoutSeconds = `default`.seconds + 60
}
