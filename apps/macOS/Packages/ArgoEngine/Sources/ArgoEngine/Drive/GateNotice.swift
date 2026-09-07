import Foundation

/// What the gate says BEFORE it has a decision: this claim's gate has taken the request, put it on
/// its pile and published it, so a surface can show it and a person can answer it (#1553).
///
/// Not a decision and never read as one. The hook takes it as permission to go on waiting, and its
/// absence as the answer: a request that never drew this line never became a prompt anybody could
/// see, so the hook denies rather than waiting out a clock nobody is watching.
///
/// Its own line rather than a field on the reply, because it is sent down a connection the reply
/// has not been written to yet — one exchange still, with one line of preamble.
enum GateNotice {
    /// The word the hook matches on, spelled once and substituted into the script, so the two ends
    /// of this handshake cannot drift apart.
    ///
    /// A bare token and deliberately not JSON, where every other line on this socket is. Two
    /// reasons, and both are about the shell: the hook compares it inside a quoted `[ ]`, which a
    /// line carrying its own quotes would break — and a decision the CLI acts on must parse as
    /// JSON, so a notice that leaked out of this hook by mistake is read as a hook with no opinion
    /// rather than as a word it could mistake for one.
    static let held = "argo-gate-held"
}
