/// How the process behind a Session was STARTED (`CONTEXT.md` L2 · Entry) — DERIVED, off the CLI's
/// own `entrypoint` field in a file Argo does not own.
///
/// Two values and no `unknown`, deliberately, because the absent rendering IS one of the two: a
/// Session nothing has been read for is one nobody can prove is unattended, and that is
/// `interactive`. See `init(entrypoint:)`.
public enum SessionEntry: Sendable, Equatable, CaseIterable {
    /// A person at a terminal, which is what a Session is until a record says otherwise.
    case interactive
    /// A program started it and nobody is at it — `claude -p` and everything the SDK runs.
    case headless
}

public extension SessionEntry {
    /// The one word `claude` writes for a run nobody is at. Matched rather than interpreted: the
    /// list is exact, and everything off it falls to the case below.
    private static let headlessWord = "sdk-cli"

    /// Argo's reading of the host's own word. Degrade-down (`CONTEXT.md` Honesty tier): an absent
    /// word, an unread file and a word this list does not carry all read `interactive`.
    ///
    /// The two errors are not symmetric, which is why the rule leans this way. Reading a headless
    /// run as interactive costs one Roster row; reading an interactive one as headless folds a
    /// Session somebody is steering out of sight.
    init(entrypoint: String?) {
        self = entrypoint == Self.headlessWord ? .headless : .interactive
    }
}
