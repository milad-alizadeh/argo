import Foundation

/// How long the gate waits for a person, and how long the hook is told to wait for the gate.
///
/// Two numbers rather than one, and the order between them is the point: **Argo's runs out first**,
/// so the hook is always told a decision instead of being killed holding a question. That is what
/// makes an expiry a fact Argo owns (DIRECT) rather than a peer close it would have to guess at —
/// and guessing is what degrade-down forbids, since the two causes of a peer close mean opposite
/// things to a reader.
public struct PermissionPatience: Sendable {
    /// What ARGO waits — long enough that the timeout is never the thing that decides, and no clock
    /// is drawn because there is none worth reading (decision 6).
    public let seconds: Int

    /// How that wait is SPENT, where `seconds` is the number Argo publishes. `init(seconds:)` ties
    /// the two together and the internal init below is the only place they can part (#826).
    ///
    /// It must return to cancellation, because every way a request ends but its clock cancels that
    /// clock — a substitute that cannot be cancelled leaves a `Task` against a torn-down gate.
    let elapse: @Sendable () async -> Void

    /// How long the HOOK waits to be told the gate is holding its request (#1553), before it gives
    /// up and denies on its own account.
    ///
    /// A different kind of number from `seconds` above, and that is the point: `seconds` is how
    /// long a PERSON may take, which is a day, and this is how long the round trip to a live gate
    /// may take, which is a moment. The wait a person owns only ever begins once the gate has said
    /// it is holding the question — so a request lost before it became a prompt anybody can see is
    /// refused in seconds instead of held for a day nobody was watching.
    public let acknowledgementSeconds: Int

    /// What that round trip is allowed to be, in one place: both inits default to it, and a number
    /// pasted into the second would quietly stop answering for the first.
    public static let defaultAcknowledgementSeconds = 10

    public init(
        seconds: Int,
        acknowledgementSeconds: Int = defaultAcknowledgementSeconds,
    ) {
        self.init(
            seconds: seconds,
            acknowledgementSeconds: acknowledgementSeconds,
            elapse: { try? await Task.sleep(for: .seconds(seconds)) },
        )
    }

    init(
        seconds: Int,
        acknowledgementSeconds: Int = defaultAcknowledgementSeconds,
        elapse: @escaping @Sendable () async -> Void,
    ) {
        self.seconds = seconds
        self.acknowledgementSeconds = acknowledgementSeconds
        self.elapse = elapse
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
