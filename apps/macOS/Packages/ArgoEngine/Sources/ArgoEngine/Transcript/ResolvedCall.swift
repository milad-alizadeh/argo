/// One call as the record left it once its result landed: what was asked, how it ended, and the two
/// places a result can sit.
///
/// Every reading takes this whole thing rather than the one field it happens to parse, because each
/// of them also owns the PRECONDITIONS under which its field means anything — and those are stated
/// in the kind and the status, not in the payload. A caller left to satisfy them itself would be
/// re-deriving the policy the reading exists to hold.
struct ResolvedCall {
    /// What the call SAYS it did. Which reading answers it is decided from this and never from the
    /// shape of the payload: a record can carry a patch beside any call at all.
    let kind: ToolCallKind
    /// The host's own tool name. Read by the one reading whose precondition this vocabulary has no
    /// kind for — a structured question, whose answer is worth keeping and whose kind is `other`.
    let name: String
    let status: ToolCallStatus
    /// The one field the call named — a path for the kinds that name one, and a pattern, a command
    /// line or a subagent's description for the kinds that do not.
    let target: String?
    /// The `tool_result` part's content — the API-shaped blocks the agent was actually sent.
    let content: JSONValue
    /// The host's own result object, which sits beside `message` at the RECORD level rather than on
    /// the part. `nil` where the record carried none.
    let toolUseResult: JSONValue?
}
