import Foundation

/// The readings assembled from facts `HubSession` keeps to itself. Here rather than beside those
/// facts because a public one must sit in a `Hub/HubSession*.swift` file to stay inside ADR-0027's
/// edge-5 gate, which reads the projection's subjects off that glob.
public extension HubSession {
    /// `nil` where neither source could say — the roster sorts such a Session last rather than
    /// giving it a guessed time, and liveness reads it as uncorroborated rather than recent.
    var lastSeenAtMs: Int? {
        moments.lastActivityAtMs ?? moments.recordedAtMs
    }

    /// The most recent moment the records report. Nothing reads it today — the roster and liveness
    /// both fold `lastSeenAtMs` above, and the cockpit lists this one `not-projected:` — so it is
    /// public only to keep that marker line naming a fact.
    var lastActivityAtMs: Int? {
        moments.lastActivityAtMs
    }

    /// The oldest moment the records report. Only ever taken from a moment read BEFORE a bounded
    /// read's seam: a start behind an unopened stretch is not the start. A value already taken
    /// stands after the seam, so this is not withheld on an excerpt.
    var startedAtMs: Int? {
        moments.startedAtMs
    }
}

extension HubSession {
    /// What `--resume` is given to continue this Session (#10): the CLI's own id for the chain's
    /// latest link, which `claude` writes the transcript file under. Resuming the ROOT instead
    /// would fork the chain at the point its first continuation left it.
    ///
    /// Absent for a Session with no record on disk — a spawn whose CLI has written nothing has no
    /// chain to continue.
    var resumeID: String? {
        chainTipURL?.deletingPathExtension().lastPathComponent
    }

    /// The id the CLI wrote this chain's ROOT file under: the name a spawn hands it on argv, and
    /// the exact key ownership binds on (#742). The root and not the tip — what Argo named is the
    /// file the agent opened with, and a chain that grows must not stop answering for it.
    var transcriptUUID: String? {
        sourceURL?.deletingPathExtension().lastPathComponent
    }
}
