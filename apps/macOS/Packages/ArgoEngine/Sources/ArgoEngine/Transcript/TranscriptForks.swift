/// Where a transcript FORKED, and which of the two branches the CLI abandoned (#1202).
///
/// A transcript is a tree: every message-bearing record names the record it answers. Two PROMPTS
/// on one parent are a Turn that was put twice — a Return the composer sent again, a prompt
/// re-sent. The CLI goes on with the LATER child and leaves the earlier branch in the file,
/// unanswered and complete.
///
/// So the earlier branch is what a reader has to take back, and it is the reading that has it: this
/// only says WHERE it starts. See `TranscriptEvent.superseded`.
///
/// PROMPTS only, and that is the guard rather than a narrowing: sibling records are the ORDINARY
/// shape of the tree. Over 474 record files, `attachment`/`tool-result` siblings appear 5,514 times
/// and `assistant`/`tool-result` 886, against 19 prompt pairs — so a rule written over every record
/// would take back most of every feed it read.
///
/// TWO SHAPES ARE DELIBERATELY NOT READ AS FORKS, because that corpus does not have them:
///
/// - Two prompts sharing a NULL parent, which would be a fork at the file's root: 0 files of 474.
///   A session's opening prompt answers the `SessionStart` attachment, so it has a parent like
///   every other one, and two null-parent prompts would more likely be a file holding two roots
///   than one Turn put twice.
/// - A prompt whose abandoned sibling is an ASSISTANT record, which is the shape a rewind to
///   mid-Turn would leave: 0 of 474. Only `latestChild` below is remembered, so such a fork emits
///   nothing rather than guessing at a branch nobody has seen the CLI write.
///
/// Both are cheap to add if a record ever shows one. Neither is added on the strength of the
/// argument alone: a rule that takes rows OUT of a feed has to be paid for in evidence.
struct TranscriptForks {
    /// The LATEST prompt read under each parent, which is the branch a further sibling supersedes.
    /// A Turn put a third time abandons the second, because the first went with the second already.
    ///
    /// One entry per prompt and not per record: a file's prompts are its Turns, which is orders
    /// fewer than its lines.
    private var latestChild: [String: String] = [:]

    /// What the record just read supersedes, if anything.
    ///
    /// A record with no parent names no branch to fork — a conversation's root answers nothing —
    /// and a parent seen once is the ordinary chain every transcript is made of.
    mutating func superseded(
        by message: MessageRecord,
        opening events: [TranscriptEvent],
    )
        -> [TranscriptEvent] {
        guard let uuid = message.uuid, let parent = message.parentUuid,
              events.contains(where: \.isPrompt)
        else { return [] }
        guard let abandoned = latestChild.updateValue(uuid, forKey: parent) else { return [] }
        return [.superseded(fromRecord: abandoned)]
    }
}

private extension TranscriptEvent {
    var isPrompt: Bool {
        if case .prompt = self {
            return true
        }
        return false
    }
}
