/// Where a transcript FORKED, and which of the two branches the CLI abandoned (#1202).
///
/// A transcript is a tree: every message-bearing record names the record it answers. An ordinary
/// conversation is a chain of single children, so a parent with TWO of them is a Turn that was put
/// twice — a Return the composer sent again, a prompt edited and re-sent, a rewind. The CLI goes on
/// with the LATER child and leaves the earlier branch in the file, unanswered and complete.
///
/// So the earlier branch is what a reader has to take back, and it is the reading that has it: this
/// only says WHERE it starts. See `TranscriptEvent.superseded`.
///
/// PROMPTS only, and that is the guard rather than a narrowing. Sibling records are ordinary
/// elsewhere in a transcript — a fan-out puts several delegated agents under one call — and a rule
/// written over every record would read those as a Session arguing with itself.
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
