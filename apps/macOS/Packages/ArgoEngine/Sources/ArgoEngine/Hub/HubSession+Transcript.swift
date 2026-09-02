/// What the transcript said, read off the stream the Session holds it in — and the stamp that says
/// WHICH reading of it this is. A Subagent's own reading is not among them: it is published beside
/// the roster (`SubagentReadings`, #858).
///
/// Out here rather than beside the storage because the storage is private: `TranscriptStream` owns
/// every write, which is the only reason the stamp below can be trusted (ADR-0028 Rule 1).
public extension HubSession {
    /// Everything the transcript said, in the order it said it.
    var events: [TranscriptEvent] {
        transcript.events
    }

    /// Which version of the stream above this is, as one small value. Moves whenever it is written
    /// to, and is the ONLY thing the cockpit compares it by — see
    /// `CockpitPresentation.Session.Transcript.Stream`.
    var transcriptStamp: TranscriptStamp {
        transcript.stamp
    }
}

/// One reading that is a CONVENTION rather than a value: a detached checkout makes the CLI write
/// the literal `HEAD`, which is not a ref anybody can check out. Read as the fact enters the Hub,
/// so no surface has to know it. Internal rather than `public`, so ADR-0027 has nothing to project.
extension HubSession {
    static func branchName(_ observed: String) -> String? {
        observed == "HEAD" ? nil : observed
    }
}
