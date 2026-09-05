import Foundation

/// A wait ARGO HELD that has ended, and the way it ended (#1323).
///
/// The cockpit draws a wait on a plinth while it runs and drops it into the reading as one settled
/// row when it ends, so the ending is a fact in its own right rather than the absence of the wait:
/// a surface handed only "not waiting any more" has nothing to write down. It carries what the wait
/// took because that is the whole of what the settled row says beyond its verb.
///
/// DIRECT throughout, and by construction: every wait here is one Argo started and held itself, so
/// nothing observed from outside can produce one.
public struct SessionWaitSettled: Sendable, Equatable {
    /// Which wait this was.
    public enum Wait: Sendable, Equatable {
        /// Argo started a CLI and waited for the first byte off its PTY (#587).
        case starting
        /// A Turn in flight, ended without an answer (#1323). Never settles to a row on its own —
        /// the agent's answer IS the record of it — so this Wait only ever reaches here failed.
        case thinking
        /// Argo continued an orphaned Session's chain in a fresh process and waited for the first
        /// byte off its PTY (#10, ADR-0026, #1328) — the same wait as `starting`, named for what
        /// Argo was doing.
        case resuming
        /// `/handoff` run in this Session, and the wait for the brief it writes (#513, #1327).
        /// Never settles to a row on its own — the existing `handedOff` link row is the record of
        /// a landed one — so this Wait only ever reaches here failed.
        case handingOff
    }

    public let wait: Wait
    /// How long the wait ran, in milliseconds. Never negative: both moments are Argo's own clock,
    /// read in the order they happened.
    public let tookMs: Int
    /// Why it failed, in Argo's own words, and `nil` where it did not. A failed wait is drawn in
    /// failure ink with this appended, exactly as a failed call is.
    public let failure: String?

    /// The same span in whole seconds, which is the unit every surface draws it in — floored, so a
    /// wait that ran 900ms reads `0s` rather than claiming a second it did not take.
    public var tookSeconds: Int {
        max(tookMs, 0) / 1000
    }

    public init(wait: Wait, tookMs: Int, failure: String? = nil) {
        self.wait = wait
        self.tookMs = tookMs
        self.failure = failure
    }
}

extension SessionWaitSettled {
    /// How the wait for a spawn's first byte ended, or `nil` while it is still running.
    ///
    /// Bytes first: a child that spoke and then died started, and the death that follows is a
    /// separate piece of news the roster already carries. Only a PTY that closed with nothing ever
    /// out of it is a start that FAILED.
    ///
    /// `spawn.startup.resuming` decides which `Wait` case this becomes — the wait itself is timed
    /// and settled identically either way.
    static func startup(of spawn: AgentSpawn) -> SessionWaitSettled? {
        let wait: Wait = spawn.startup.resuming ? .resuming : .starting
        if let heard = spawn.startup.firstOutputAtMs {
            return SessionWaitSettled(wait: wait, tookMs: heard - spawn.spawnedAtMs)
        }
        guard let exit = spawn.startup.exit else { return nil }
        return SessionWaitSettled(
            wait: wait,
            tookMs: exit.atMs - spawn.spawnedAtMs,
            failure: reason(of: exit),
        )
    }

    /// What the reader is told about an exit that came before a single byte. The code where the
    /// child reported one, and the absence stated rather than spelled `0`: absent is not zero, and
    /// a PTY that went without a word is the commonest way this wait fails.
    private static func reason(of exit: AgentSpawn.Exit) -> String {
        guard let code = exit.code else { return "the process ended without reporting a code" }
        return "the process exited with code \(code)"
    }
}
