/// The session facts a record carries beside its content, emitted only when they CHANGE.
///
/// Every record repeats them, and a stream that re-announced the cwd two hundred times would bury
/// the events anyone is watching for. The cwd, the branch and the model keep their LATEST reading;
/// only the origin session id and the entrypoint keep their first, because those two are fixed at
/// the moment the file was opened.
///
/// A cursor of its own rather than three fields on the reader: "have I said this already" is the
/// whole of its state, and it is the one part of the reader's memory that has nothing to do with
/// the calls it has open.
struct TranscriptContextCursor {
    private var lastCwd: String?
    private var lastModel: String?
    private var lastBranch: String?
    private var lastOriginSessionID: String?
    private var lastEntrypoint: String?

    mutating func events(for message: MessageRecord) -> [TranscriptEvent] {
        var events: [TranscriptEvent] = []
        if let cwd = message.cwd, cwd != lastCwd {
            lastCwd = cwd
            events.append(.cwd(cwd))
        }
        if let originSessionID = message.originSessionID, lastOriginSessionID == nil {
            lastOriginSessionID = originSessionID
            events.append(.originSession(id: originSessionID))
        }
        if let entrypoint = message.entrypoint, lastEntrypoint == nil {
            lastEntrypoint = entrypoint
            events.append(.entry(cli: entrypoint))
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
