/// What the transcript said, read off the stream the Session holds it in — and the stamp that says
/// WHICH reading of it this is.
///
/// Out here rather than beside the storage because the storage is private: `TranscriptStream` owns
/// every write, which is the only reason the stamp below can be trusted (ADR-0028 Rule 1).
public extension HubSession {
    /// Everything the transcript said, in the order it said it.
    var events: [TranscriptEvent] {
        transcript.events
    }

    /// Each Subagent's own reading, keyed by the CLI's id for it (#711).
    ///
    /// Beside `events` rather than in it, and that is the whole point: a child's records are the
    /// child's, and folding them into the Session's stream would put a delegate's rows in the
    /// parent's feed. Empty is the ordinary case — most Sessions delegate nothing, and Codex writes
    /// no such record at all.
    var subagentEvents: [String: [TranscriptEvent]] {
        transcript.subagentEvents
    }

    /// Which version of the two streams above this is, as one small value. Moves whenever either
    /// of them is written to, and is the ONLY thing the cockpit compares them by — see
    /// `CockpitPresentation.Session.Transcript.Streams`.
    var transcriptStamp: TranscriptStamp {
        transcript.stamp
    }
}
