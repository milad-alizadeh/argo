/// The session facts a record carries beside its content, emitted only when they CHANGE.
///
/// Every record repeats them, and a stream that re-announced the cwd two hundred times would bury
/// the events anyone is watching for. The cwd keeps its first reading and the branch its latest,
/// because a run can switch branch mid-session but never switches its root.
///
/// A cursor of its own rather than three fields on the reader: "have I said this already" is the
/// whole of its state, and it is the one part of the reader's memory that has nothing to do with
/// the calls it has open.
struct TranscriptContextCursor {
    private var lastCwd: String?
    private var lastModel: String?
    private var lastBranch: String?

    mutating func events(for message: MessageRecord) -> [TranscriptEvent] {
        var events: [TranscriptEvent] = []
        if let cwd = message.cwd, lastCwd == nil {
            lastCwd = cwd
            events.append(.cwd(cwd))
        }
        if let branch = message.gitBranch, branch != lastBranch {
            lastBranch = branch
            events.append(.branch(branch))
        }
        if let model = message.model, model != lastModel {
            lastModel = model
            events.append(.model(model))
        }
        return events
    }
}
