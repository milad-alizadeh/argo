import Foundation

/// How long the gate waits for a person, and how long the hook is told to wait for the gate.
///
/// Two numbers rather than one, and the order between them is the point: **Argo's runs out first**,
/// so the hook is always told a decision instead of being killed holding a question. That is what
/// makes an expiry a fact Argo owns (DIRECT) rather than a peer close it would have to guess at —
/// and guessing is what degrade-down forbids, since the two causes of a peer close mean opposite
/// things to a reader.
public struct PermissionPatience: Sendable, Equatable {
    /// What ARGO waits — long enough that the timeout is never the thing that decides, and no clock
    /// is drawn because there is none worth reading (decision 6).
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
