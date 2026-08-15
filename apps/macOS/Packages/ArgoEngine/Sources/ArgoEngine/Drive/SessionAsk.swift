/// One `AskUserQuestion` an agent is blocked on, as a handle rather than a reading: the questions
/// it put, and the id the answer names them by.
///
/// DIRECT and managed-only, exactly like `PermissionRequest` — the hook that raised it and the
/// channel the answer goes back down are both Argo's own. The `Ask` the FEED draws is the same
/// vocabulary read out of the transcript after the fact, which carries no id and cannot be
/// answered.
public struct SessionAsk: Sendable, Equatable, Identifiable {
    public let id: String
    public let ask: Ask

    public init(id: String, ask: Ask) {
        self.id = id
        self.ask = ask
    }

    /// One hook payload read into the domain, and nothing for a line that is not one of these.
    ///
    /// Gated on the tool's NAME, the way `AskReading` is: a tool free to send any object at all
    /// would otherwise have its arguments read as a question the moment they happened to fit. A
    /// call whose input carried no readable question is refused too — an ask with no words is not
    /// one anybody can answer, and it must fall through to the gate's ordinary reading.
    init?(line: String, id: String) {
        guard let payload = JSONValue.record(fromLine: line),
              payload.stringField("tool_name") == ToolCall.askUserQuestion,
              // Qualified: `ask` inside an initialiser is this type's own property.
              let ask = ArgoEngine.ask(from: payload["tool_input"] ?? .object([:]))
        else { return nil }
        self.id = id
        self.ask = ask
    }
}
