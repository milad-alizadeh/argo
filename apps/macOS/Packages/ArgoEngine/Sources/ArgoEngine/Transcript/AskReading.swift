// `AskUserQuestion`'s input → the question it put. The tool's NAME is what says a call is one of
// these (`ToolCall.askUserQuestion`), never the shape of its input: a tool free to send any object
// at all would otherwise have its arguments read as a question the moment they happened to fit.
//
// One reading, two sources: the transcript's record of a call that has already happened, and the
// hook payload of one that has not (`SessionAsk`). Both carry the same `tool_input`, so a second
// reading of it would be a second answer to what was asked.

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
    return Ask.Question(
        text: text,
        options: options(from: raw),
        // Absent reads as false: degrade-down resolves an unstated `multiSelect` to the narrower
        // act, and offering many where one was meant answers a question nobody asked.
        allowsMultiple: raw["multiSelect"]?.bool ?? false,
    )
}

/// The options as offered. An option is its LABEL — the words on the control somebody presses —
/// and a host that writes them as bare strings is read the same way as one that writes objects.
private func options(from raw: JSONValue) -> [Ask.Option] {
    raw["options"]?.array.compactMap(option(from:)) ?? []
}

private func option(from raw: JSONValue) -> Ask.Option? {
    guard let label = raw.string ?? raw.stringField("label") else { return nil }
    return Ask.Option(label: label, detail: raw.stringField("description"))
}
