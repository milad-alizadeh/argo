import Foundation

// Which user records are the CLI talking to ITSELF, and how the ones that ARE a prompt read.
//
// A transcript's user records are not all prompts. Claude Code writes several per exchange — the
// local-command caveat, a skill's expanded body, the `[Image: original 2400x2200…]` preamble in
// front of a pasted screenshot, a finished background agent's report — and every one of them opens
// a Turn if taken at face value.
//
// Nothing here rewords a prompt: the reading stays verbatim, taken from the fields the CLI put the
// words in rather than from the markup it wrapped them in.

/// A background agent's report, filed as a user record because that is where the CLI puts it.
///
/// Never a prompt. Where it names the call that DELEGATED the work it is that call's outcome
/// arriving late (#825) — and where it names none there is nothing to join it to, which is a
/// report standing on its own rather than a record to hand back to the prompt path (#945).
struct TaskNotification {
    /// The delegating call this report answers, where the record names one — and `nil` where it
    /// does not. A resumed agent's later report and a monitor's mid-run event both arrive without
    /// one, and there is then nothing to JOIN the report to (#945).
    let callID: String?
    /// The task the CLI filed this under — the same `agentId` a delegating call's launch result
    /// reported, where one delegated the work. A monitor's own task names no Subagent transcript.
    let subagentID: String?
    /// The host's own one-line account of what the agent did, which is the only thing an
    /// unjoinable report can be addressed by.
    let summary: String?
    let status: ToolCallStatus
    /// What the agent said, or `nil` where it said nothing — its report where it finished, and the
    /// event it announced where it is still working.
    let text: String?
}

/// The head of the envelope the CLI wraps a finished agent's report in.
private let notificationPreamble = "<task-notification>"

/// The report a user record carries, or `nil` where it carries none.
///
/// Recognition only: a record beginning with the envelope IS a notification whatever else it
/// carries, and what a missing `tool-use-id` costs is the reader's to decide (#945).
///
/// Matched at the head, the discipline `skillDirectory` uses: a prompt that merely QUOTES the word
/// is a prompt, and reading it as machinery would swallow what the user asked.
func taskNotification(_ content: [ContentBlock]) -> TaskNotification? {
    guard let text = RecordText.first(of: content),
          text.hasPrefix(notificationPreamble) else { return nil }
    // `result` is where a finished agent puts its report and `event` where a monitor puts its
    // mid-run one. Both are the agent's own words; only the tag around them differs.
    let report = RecordText.tagged("result", in: text) ?? RecordText.tagged("event", in: text)
    return TaskNotification(
        callID: nonEmpty(RecordText.tagged("tool-use-id", in: text)),
        subagentID: nonEmpty(RecordText.tagged("task-id", in: text)),
        summary: nonEmpty(RecordText.tagged("summary", in: text)),
        status: reportedStatus(RecordText.tagged("status", in: text)),
        text: nonEmpty(report),
    )
}

/// What a notification's status says about the agent that filed it.
///
/// Anything other than `completed` is the agent stopping short of a report, which is a call that
/// failed rather than one that answered. An ABSENT status is a notification announcing an EVENT
/// rather than an ending: no rung here says that, and of the two that exist the quiet one is the
/// honest degrade — a failure the record never stated would be the louder lie.
private func reportedStatus(_ reported: String?) -> ToolCallStatus {
    guard let reported else { return .completed }
    return reported == "completed" ? .completed : .failed
}

/// A tag with nothing in it states nothing, so it answers as nothing.
private func nonEmpty(_ text: String?) -> String? {
    text?.isEmpty == true ? nil : text
}

/// A local command's own stdout, stored as a user record because that is where the CLI puts it.
///
/// Read rather than discarded because it is the command's ANSWER: `/effort` opens a turn whose only
/// content is this line, so a reader that drops it sees the question and never the reply.
func localCommandOutput(_ content: [ContentBlock]) -> String? {
    guard let text = RecordText.first(of: content) else { return nil }
    return RecordText.tagged("local-command-stdout", in: text)
}

/// A slash command as the user typed it — `/implement 318 open storybook while you do it`. The CLI
/// stores the invocation as three sibling tags in one record; the raw text would title the exchange
/// `<command-message>implement</command-message>`, markup the user never saw.
func commandPrompt(_ text: String) -> String? {
    guard let name = RecordText.tagged("command-name", in: text) else { return nil }
    let args = RecordText.tagged("command-args", in: text) ?? ""
    return args.isEmpty ? name : "\(name) \(args)"
}

/// A slash command's name and its arguments, kept APART. `commandPrompt` above joins them because
/// the feed draws what was typed; a reader that ACTS on one particular command needs to know which
/// command it was and what it was handed.
func commandInvocation(_ content: [ContentBlock]) -> (name: String, args: String)? {
    guard let text = RecordText.first(of: content), let name = RecordText.tagged(
        "command-name",
        in: text,
    )
    else { return nil }
    return (name, RecordText.tagged("command-args", in: text) ?? "")
}

/// The line the CLI writes in front of a skill's body when it hands one over (#688).
private let skillPreamble = "Base directory for this skill: "

/// The skill directory a META record names, where it names one — the one place the record says a
/// Session was handed a skill. `nil` for every other kind of plumbing filed the same way: the
/// caveat, the pasted-image preamble. Matched at the head, so a prompt QUOTING the sentence is a
/// prompt.
func skillDirectory(_ content: [ContentBlock]) -> String? {
    guard let text = RecordText.first(of: content),
          text.hasPrefix(skillPreamble) else { return nil }
    let named = text.dropFirst(skillPreamble.count).prefix { !$0.isNewline }
    let directory = named.trimmingCharacters(in: .whitespaces)
    return directory.isEmpty ? nil : directory
}

/// What a user record asks for, or `nil` where it asks for nothing. A slash command reads as the
/// command, a shell command as the line it was typed as, either one's output as nothing, and
/// anything else as itself — unclamped and untrimmed, the way a verbatim prompt must be.
func userPrompt(_ content: [ContentBlock]) -> String? {
    guard let text = RecordText.first(of: content) else { return nil }
    guard localCommandOutput(content) == nil, ShellTurn.printed(in: content) == nil
    else { return nil }
    return ShellTurn.asked(in: content) ?? commandPrompt(text) ?? text
}

/// The CLI's own placeholder for a picture it moved into a block of its own — `[Image #3]`, written
/// into the prompt's text where the paste landed. The number counts pastes across the SESSION and
/// indexes nothing in the record, so a token can only ever be matched to a block by position.
private let imageToken = "\\[Image #[0-9]+\\]"

/// The prompt with its placeholders taken out, one per picture the record actually carried.
///
/// Bounded by the count so a placeholder with no block behind it still shows: it is the only trace
/// left of a picture the reader cannot see.
func shorn(_ text: String, ofImages count: Int) -> String {
    guard count > 0 else { return text }
    var shorn = text
    for _ in 0 ..< count {
        guard let token = shorn.range(of: imageToken, options: .regularExpression) else { break }
        shorn.removeSubrange(withItsSpace(token, in: shorn))
    }
    return shorn
}

/// The token plus the ONE space the CLI wrote beside it — the following one, or the preceding one
/// where the token ends the line. Taking neither leaves a gap the user did not type.
private func withItsSpace(_ token: Range<String.Index>, in text: String) -> Range<String.Index> {
    if token.upperBound < text.endIndex, text[token.upperBound] == " " {
        return token.lowerBound ..< text.index(after: token.upperBound)
    }
    if token.lowerBound > text.startIndex, text[text.index(before: token.lowerBound)] == " " {
        return text.index(before: token.lowerBound) ..< token.upperBound
    }
    return token
}

/// What a user record asks for once its pictures are read off it, or `nil` where it asks for
/// nothing. A record carrying pictures and no words of its own is still a prompt: the whole of what
/// was asked is the picture.
private func promptText(_ content: [ContentBlock], carrying images: Int) -> String? {
    guard let prompt = userPrompt(content) else { return images > 0 ? "" : nil }
    return shorn(prompt, ofImages: images)
}

/// A prompt, or the output of a command the CLI ran itself — see `CommandOutput`, which is what
/// both kinds of that record read as.
func promptEvents(_ message: MessageRecord, in location: MediaLocation?)
    -> [TranscriptEvent] {
    // Each command the CLI ran ITSELF, before the prompt path below draws its markup. The shell
    // one first: its answer is the same exchange one record later (#1595).
    if let printed = ShellTurn.printed(in: message.content) {
        return ShellTurn.events(printed: printed, in: message)
    }
    if let printed = localCommandOutput(message.content) {
        return CommandOutput.events(
            id: message.uuid ?? "local-command",
            name: "local command",
            printed: printed,
            atMs: message.timestampMs,
        )
    }
    let images = embeddedMedia(message.content, in: location)
    guard let text = promptText(message.content, carrying: images.count) else { return [] }
    // The one user entry nobody asked for. Read here rather than by whoever draws it, because it
    // is a BOUNDARY as well as a mark: a Turn is over, and every surface reading this stream needs
    // that fact, not only the one that paints a rule across the feed (#1189).
    guard !ClaudeInterrupt.isMark(text) else {
        return [.interrupted(atMs: message.timestampMs)]
    }
    return [.prompt(text: text, images: images, atMs: message.timestampMs)]
}
