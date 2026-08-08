// `AskUserQuestion`'s input → the question it put. The tool's NAME is what says a call is one of
// these (`ToolCall.askUserQuestion`), never the shape of its input: a tool free to send any object
// at all would otherwise have its arguments read as a question the moment they happened to fit.

/// The question a call asked, or `nil` where its input carried none that could be read.
///
/// A question with no words is dropped rather than shown blank, and a call whose questions are all
/// dropped asks nothing: the honest reading of an input this shape does not fit is that Argo could
/// not read it, and an empty question with two buttons under it would be a choice offered on
/// somebody else's behalf.
func ask(from input: JSONValue) -> Ask? {
    let questions = input["questions"]?.array.compactMap(question(from:)) ?? []
    return questions.isEmpty ? nil : Ask(questions: questions)
}

private func question(from raw: JSONValue) -> Ask.Question? {
    guard let text = raw.stringField("question") else { return nil }
    return Ask.Question(text: text, options: options(from: raw))
}

/// The options as offered. An option is its LABEL — the words on the control somebody presses —
/// and a host that writes them as bare strings is read the same way as one that writes objects.
private func options(from raw: JSONValue) -> [String] {
    raw["options"]?.array.compactMap { $0.string ?? $0.stringField("label") } ?? []
}
