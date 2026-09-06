/// The session facts a record carries beside its content, emitted only when they CHANGE.
///
/// Every record repeats them, and a stream that re-announced the cwd two hundred times would bury
/// the events anyone is watching for. The cwd, the branch and the model keep their LATEST reading;
/// the entrypoint keeps its first, because it is fixed at the moment the file was opened. The
/// origin session id is stricter still — it is read off the FIRST record and never after, because
/// a chain is something a run is born into rather than something it can join (#1479).
///
/// A cursor of its own rather than three fields on the reader: "have I said this already" is the
/// whole of its state, and it is the one part of the reader's memory that has nothing to do with
/// the calls it has open.
struct TranscriptContextCursor {
    private var lastCwd: String?
    private var lastModel: String?
    private var lastEffort: String?
    private var lastBranch: String?
    private var lastEntrypoint: String?
    /// Whether the origin has had its ONE chance to be stated — see `events(for:)`.
    private var originSettled = false

    /// Forget everything said so far, so the NEXT record announces whatever it carries in full.
    ///
    /// What a superseded branch needs (#1202). These facts are emitted on CHANGE, so the one
    /// record that announced a new cwd or model can be the very record a fork takes back out of
    /// the reading — and the record superseding it carries the same value, which on-change reads
    /// as nothing to say. The fact would then be in no event anywhere, while the Session's folded
    /// scalars still held it: a stream and a header disagreeing permanently.
    ///
    /// Re-stating costs one repeated event per fact at a fork, which is 19 places in 474 files.
    ///
    /// The origin is the one fact a fork cannot re-open, because it is not a fact about a record:
    /// it is how the FILE was opened, and the record after a fork is not the file's first (#1479).
    mutating func restate() {
        var restated = TranscriptContextCursor()
        restated.originSettled = originSettled
        self = restated
    }

    /// The model a `/model` command NAMED (`CommandedModel`), through the same cursor the reported
    /// one goes through: the command writes the model's name and the Turn after it writes the
    /// provider's id, and a cursor that only knew the second would announce that one change twice.
    mutating func events(forModelNamed named: String?) -> [TranscriptEvent] {
        guard let named else { return [] }
        return announcing(model: named)
    }

    /// One model reading, said only where it is news. The one place `lastModel` moves.
    private mutating func announcing(model: String) -> [TranscriptEvent] {
        guard model != lastModel else { return [] }
        lastModel = model
        return [.model(model)]
    }

    mutating func events(for message: MessageRecord) -> [TranscriptEvent] {
        var events: [TranscriptEvent] = []
        if let cwd = message.cwd, cwd != lastCwd {
            lastCwd = cwd
            events.append(.cwd(cwd))
        }
        // Off the FIRST record only, and never again — whether that record carried one or not. A
        // run is born into its chain: `session_id` on a record written after the Session has
        // already spoken is a value the process picked up mid-run, which a `remote_session_change`
        // does to every fresh Session a cockpit window starts. Read as an origin, it chained each
        // new Session under an unrelated one, and the roster folded them into a single row (#1479).
        if !originSettled {
            originSettled = true
            if let originSessionID = message.originSessionID {
                events.append(.originSession(id: originSessionID))
            }
        }
        if let entrypoint = message.entrypoint, lastEntrypoint == nil {
            lastEntrypoint = entrypoint
            events.append(.entry(cli: entrypoint))
        }
        if let branch = message.gitBranch, branch != lastBranch {
            lastBranch = branch
            events.append(.branch(branch))
        }
        if let model = message.run.model {
            events += announcing(model: model)
        }
        if let effort = message.run.effort, effort != lastEffort {
            lastEffort = effort
            events.append(.effort(cli: effort))
        }
        return events
    }
}
