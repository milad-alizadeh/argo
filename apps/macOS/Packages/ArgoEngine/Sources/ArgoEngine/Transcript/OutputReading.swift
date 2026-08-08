import Foundation

// A call's result → what it PRINTED, read off the `tool_result` part that answered it. DIRECT: the
// bytes the agent got back, carried verbatim and never reworded.

/// What a call printed, where a row would read it.
///
/// Kept for a command, which shows what it printed; for a READ, whose payload is the file as the
/// agent saw it; for a QUESTION, whose payload is the answer somebody gave it; and for a failure of
/// any kind, which shows what went wrong. A read's content is the engine's largest payload by far
/// and is held anyway, because the alternative is a panel that re-reads the path and shows what the
/// file says NOW — a different file, at a lower tier, on the one surface whose whole claim is that
/// it shows what the agent was actually looking at.
///
/// The question is here by NAME rather than by kind, because this vocabulary has no kind for one:
/// `AskUserQuestion` reads as `other`, and its answer is the only record of which way a choice
/// went. Dropped, a surface can say a question was asked and never how it was settled.
func outputEvidence(of call: ResolvedCall) -> OutputEvidence? {
    guard call.kind == .execute || call.kind == .read || call.status == .failed
        || call.name == ToolCall.askUserQuestion
    else { return nil }
    return printedOutput(of: call.content)
}

/// A `tool_result`'s content → the output it carried, or `nil` where it carried none.
///
/// A result is a plain string most of the time and an array of content parts when it held more than
/// prose, so both are read. Whitespace alone is `nil` rather than an empty output: a row with
/// nothing to show must say so, and an expandable that opens onto a blank block is a row that lied
/// about having something behind it.
func printedOutput(of content: JSONValue) -> OutputEvidence? {
    let raw = content.string ?? textParts(of: content)
    guard !raw.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
    return OutputEvidence(tier: .direct, text: raw)
}

/// The prose of a result's parts. A part of any other kind belongs to the kind that owns it — an
/// image is media, which a row reads as pixels rather than as a base64 blob printed to the screen.
private func textParts(of content: JSONValue) -> String {
    content.array
        .compactMap { $0.stringField("type") == "text" ? $0.stringField("text") : nil }
        .joined(separator: "\n")
}
