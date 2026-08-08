import Foundation

// A call's result → what it PRINTED, read off the `tool_result` part that answered it. DIRECT: the
// bytes the agent got back, carried verbatim and never reworded.

/// What a call printed, where a row would read it.
///
/// Output is kept only for a command, which shows what it printed, and for a failure of any kind,
/// which shows what went wrong. A successful read's output is the whole file, and holding every one
/// a session read would be the engine's largest cost for a payload nothing renders.
func outputEvidence(of call: ResolvedCall) -> OutputEvidence? {
    guard call.kind == .execute || call.status == .failed else { return nil }
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
