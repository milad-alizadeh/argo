import Foundation

/// One per-action prompt an agent raised (CONTEXT.md, "Permission"): a gated tool call blocked on
/// the user's answer. DIRECT and managed-only — Argo owns the hook that raised it and the channel
/// the answer goes back down.
public struct PermissionRequest: Sendable, Equatable, Identifiable {
    /// What the gated call would act ON, verbatim and in full — a decision made on a truncated
    /// command is a guess.
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

    public init(id: String, toolName: String, target: Target) {
        self.id = id
        self.toolName = toolName
        self.target = target
    }

    /// One hook payload read into the domain BEFORE it has an id. The gate has to know what tool is
    /// asking to decide whether the call becomes a prompt at all, and only a prompt gets an id —
    /// which is the table's to mint.
    struct Draft {
        let toolName: String
        private let input: JSONValue

        /// Nothing for a line that names no tool: a prompt that cannot say what is asking is not a
        /// prompt anyone can answer.
        init?(line: String) {
            guard let payload = JSONValue.record(fromLine: line),
                  let toolName = payload.stringField("tool_name")
            else { return nil }
            self.toolName = toolName
            self.input = payload["tool_input"] ?? .object([:])
        }

        func minted(as id: String) -> PermissionRequest {
            PermissionRequest(
                id: id,
                toolName: toolName,
                target: Target(toolName: toolName, input: input),
            )
        }
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

    private static func editTarget(
        _ input: JSONValue,
        hunks: (JSONValue) -> [[DiffLine]],
    )
        -> Self? {
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

/// The user's answer to a pending Permission — the composer's other intent. `ask` is deliberately
/// unrepresentable: it would fall through to the hidden TUI dialog, which has no reader.
///
/// Three answers here and still two words on the wire. `allowAlways` is an allow like any other as
/// far as the hook is concerned; what makes it standing happens on Argo's side of the socket, as a
/// `StandingAllow` the Session publishes and the user can take back (#572).
public enum PermissionDecision: Sendable, Equatable {
    case allow
    /// Allow this call, and stop asking about this tool in this Session — exactly that scope, which
    /// is what the control that raises it says. It ends when the grant is revoked or the Session
    /// does, and it survives no restart: the gate that would honour it is per-claim.
    case allowAlways
    case deny
}
