import Foundation

/// One per-action prompt an agent raised (CONTEXT.md, "Permission"): a gated tool call blocked on
/// the user's answer. DIRECT and managed-only — Argo owns the hook that raised it and the channel
/// the answer goes back down.
public struct PermissionRequest: Sendable, Equatable, Identifiable {
    /// What the gated call would act ON, verbatim and in full: a decision made on a truncated
    /// command is a guess, which is the thing the prompt exists to prevent.
    public enum Target: Sendable, Equatable {
        case command(String)
        /// A path and what would be written there, one hunk per edit. All-adds for a file the
        /// call would create.
        case edit(path: String, hunks: [[DiffLine]])
        /// A gated tool whose input has no rendering of its own yet — the input JSON, verbatim,
        /// rather than a shape guessed from its name.
        case raw(String)
    }

    public let id: String
    /// The CLI's own name for the tool, never renamed.
    public let toolName: String
    public let target: Target
    public let raisedAtMs: Int
    /// When the hook's own clock runs out and the call is denied unanswered — the patience window
    /// the prompt draws, because without it walking away looks free.
    public let deniesAtMs: Int

    public init(id: String, toolName: String, target: Target, raisedAtMs: Int, deniesAtMs: Int) {
        self.id = id
        self.toolName = toolName
        self.target = target
        self.raisedAtMs = raisedAtMs
        self.deniesAtMs = deniesAtMs
    }

    /// One hook payload read into the domain, or nothing for a line that names no tool: a prompt
    /// that cannot say what is asking is not a prompt anyone can answer.
    init?(line: String, id: String, raisedAtMs: Int, deniesAtMs: Int) {
        guard let payload = JSONValue.record(fromLine: line),
              let toolName = payload.stringField("tool_name")
        else { return nil }
        self.id = id
        self.toolName = toolName
        self.target = Target(toolName: toolName, input: payload["tool_input"] ?? .object([:]))
        self.raisedAtMs = raisedAtMs
        self.deniesAtMs = deniesAtMs
    }
}

extension PermissionRequest.Target {
    /// Read from the input's own fields, not the tool's name alone: only a shape this vocabulary
    /// knows renders as one, and everything else stays verbatim JSON.
    init(toolName: String, input: JSONValue) {
        let target: Self? = switch toolName {
        case "Bash": input.stringField("command").map(Self.command)
        case "Edit": Self.editTarget(input) { [Self.hunk(of: $0)] }
        case "Write": Self.editTarget(input) { [Self.lines($0.stringField("content"), side: .add)] }
        case "MultiEdit": Self.editTarget(input) { ($0["edits"]?.array ?? []).map(Self.hunk(of:)) }
        default: nil
        }
        self = target ?? .raw(Self.verbatim(input))
    }

    private static func editTarget(_ input: JSONValue, hunks: (JSONValue) -> [[DiffLine]]) -> Self? {
        input.stringField("file_path").map { .edit(path: $0, hunks: hunks(input)) }
    }

    private static func hunk(of edit: JSONValue) -> [DiffLine] {
        lines(edit.stringField("old_string"), side: .del)
            + lines(edit.stringField("new_string"), side: .add)
    }

    private static func lines(_ text: String?, side: DiffLineSide) -> [DiffLine] {
        guard let text, !text.isEmpty else { return [] }
        return text.split(separator: "\n", omittingEmptySubsequences: false)
            .map { DiffLine(side: side, text: String($0)) }
    }

    private static func verbatim(_ input: JSONValue) -> String {
        input.compactJSON ?? ""
    }
}

/// The user's answer to a pending Permission — the composer's other intent, and the only three
/// words the hook's reply vocabulary has room for. `ask` is deliberately unrepresentable: it would
/// fall through to the hidden TUI dialog, which has no reader.
public enum PermissionDecision: Sendable, Equatable {
    case allow
    /// Allow, and stop asking about this tool for the rest of this Session — the standing
    /// baseline, so a tool the user has blessed pays no further round trip.
    case allowAlways
    case deny
}
