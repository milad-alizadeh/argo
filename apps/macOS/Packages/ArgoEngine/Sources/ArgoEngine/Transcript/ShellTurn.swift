import Foundation

/// A `!` command — the shell line typed at the CLI's own prompt, which the CLI runs itself rather
/// than handing to the agent.
///
/// It is a local command that answers LATE, and that is the whole difference. `/model` is heard and
/// printed in one record; a shell line writes its `<bash-input>` record when it is asked and its
/// `<bash-stdout>` when the command exits, which for an interactive `gh auth refresh` is the CLI's
/// 120s timeout away (#1595). Between the two the Session is working, and the Turn the asking
/// record opens is what says so.
enum ShellTurn {
    /// What a line has to begin with to be one, at the composer and at the CLI's own prompt alike.
    static let mark = "!"

    /// The name the call goes under, spelled like `local command`'s: what the reader sees is the
    /// command itself, and this says which of the two ran it.
    static let toolName = "shell command"

    private static let input = "bash-input"

    /// Both streams, joined stdout-first — a command that printed on one and failed on the other
    /// said both, and a reader taking only stdout would show the silence rather than the reason.
    private static let outputs = ["bash-stdout", "bash-stderr"]

    /// Whether a line typed at the composer is a shell command rather than words for the agent.
    /// Matched at the HEAD, so a prompt that merely CONTAINS the mark is a prompt.
    static func isTyped(_ text: String) -> Bool {
        text.hasPrefix(mark)
    }

    /// The command a record ASKED for, spelled as the line it was typed as — or `nil` where the
    /// record asked for none.
    ///
    /// Rebuilt rather than taken raw, because the tag is all the record keeps and reading it
    /// verbatim would put `<bash-input>` in the feed. The mark and one space is how the CLI's own
    /// prompt shows it back.
    static func asked(in content: [ContentBlock]) -> String? {
        guard let text = RecordText.first(of: content),
              let command = RecordText.tagged(input, in: text)
        else { return nil }
        return "\(mark) \(command)"
    }

    /// What a record PRINTED, or `nil` where it is not a shell command's answer.
    ///
    /// An empty string is an answer: a command that printed nothing still printed, and this record
    /// is the CLI saying the command is over. A reader that took the silence for "not one of mine"
    /// would leave the Turn open for good.
    static func printed(in content: [ContentBlock]) -> String? {
        guard let text = RecordText.first(of: content) else { return nil }
        let streams = outputs.compactMap { RecordText.tagged($0, in: text) }
        guard !streams.isEmpty else { return nil }
        return streams.filter { !$0.isEmpty }.joined(separator: "\n")
    }

    /// The answer read as the Tool Call it is, and the Turn it closes — see `CommandOutput`.
    static func events(printed: String, in message: MessageRecord) -> [TranscriptEvent] {
        CommandOutput.events(
            // The ASKING record's id, which is the one the reader's own eye joins the pair by: the
            // record answering a shell command names the record that asked it as its parent.
            id: message.parentUuid ?? message.uuid ?? toolName,
            name: toolName,
            printed: printed,
            atMs: message.timestampMs,
        )
    }
}
