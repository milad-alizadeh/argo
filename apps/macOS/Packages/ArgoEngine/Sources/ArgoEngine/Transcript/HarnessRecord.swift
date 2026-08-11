import Foundation

// Which user records are the CLI talking to ITSELF, and how the ones that ARE a prompt read.
//
// A transcript's user records are not all prompts. Claude Code writes several per exchange — the
// local-command caveat, a skill's expanded body, the `[Image: original 2400x2200…]` preamble in
// front of a pasted screenshot — and every one of them opens a Turn if taken at face value.
//
// Nothing here rewords a prompt: the reading stays verbatim, taken from the fields the CLI put the
// words in rather than from the markup it wrapped them in.

/// The first textual part of a record's content with anything in it. Blank parts are stepped over
/// rather than answered with.
private func firstText(_ content: [ContentBlock]) -> String? {
    for block in content {
        guard case let .text(text) = block,
              !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else { continue }
        return text
    }
    return nil
}

/// The contents of one `<name>…</name>` tag.
private func tag(_ text: String, _ name: String) -> String? {
    // `[\s\S]` rather than `.`, which stops at a newline: a command's body routinely spans lines.
    guard let match = text.range(
        of: "<\(name)>[\\s\\S]*?</\(name)>",
        options: [.regularExpression],
    ) else { return nil }
    let inner = text[match].dropFirst(name.count + 2).dropLast(name.count + 3)
    return inner.trimmingCharacters(in: .whitespacesAndNewlines)
}

/// A local command's own stdout, stored as a user record because that is where the CLI puts it.
///
/// Read rather than discarded because it is the command's ANSWER: `/effort` opens a turn whose only
/// content is this line, so a reader that drops it sees the question and never the reply.
func localCommandOutput(_ content: [ContentBlock]) -> String? {
    guard let text = firstText(content) else { return nil }
    return tag(text, "local-command-stdout")
}

/// A slash command as the user typed it — `/implement 318 open storybook while you do it`. The CLI
/// stores the invocation as three sibling tags in one record; the raw text would title the exchange
/// `<command-message>implement</command-message>`, markup the user never saw.
func commandPrompt(_ text: String) -> String? {
    guard let name = tag(text, "command-name") else { return nil }
    let args = tag(text, "command-args") ?? ""
    return args.isEmpty ? name : "\(name) \(args)"
}

/// What a user record asks for, or `nil` where it asks for nothing. A slash command reads as the
/// command, a local command's stdout reads as nothing, and anything else reads as itself —
/// unclamped and untrimmed, the way a verbatim prompt must be.
func userPrompt(_ content: [ContentBlock]) -> String? {
    guard let text = firstText(content) else { return nil }
    guard localCommandOutput(content) == nil else { return nil }
    return commandPrompt(text) ?? text
}
