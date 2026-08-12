import Foundation

/// An approval `codex app-server` asked Argo for, read into the Permission the cockpit raises
/// (#549, ADR-0024). Verified against `CodexClient.verifiedAgainst`.
///
/// Exactly the two approvals whose answer is `{"decision": …}`. The server's third,
/// `item/permissions/requestApproval`, is a sandbox-widening ask whose response carries a
/// permission profile instead — so it stays refused as unsupported rather than answered in a shape
/// guessed at, which is the rule every unhandled server request here follows.
enum CodexAsk: String {
    case commandExecution = "item/commandExecution/requestApproval"
    case fileChange = "item/fileChange/requestApproval"

    /// The server's own word for what is asking, taken off its method verbatim and never renamed —
    /// `PermissionRequest.toolName` holds the CLI's name for the tool, whichever CLI it is.
    var toolName: String {
        switch self {
        case .commandExecution: "commandExecution"
        case .fileChange: "fileChange"
        }
    }

    /// Two of the server's four words. `acceptForSession` makes the SERVER stop asking with no way
    /// back, and `cancel` interrupts the Turn as well as refusing the call — so neither is sent.
    static func word(_ decision: PermissionDecision) -> String {
        switch decision {
        case .allow, .allowAlways: "accept"
        case .deny: "decline"
        }
    }

    /// What Argo's own clock answers with. The server keeps none, so an approval nobody answers
    /// holds the Turn open for ever (openai/codex#11816).
    static let expired = word(.deny)

    /// The item a patch's diff is joined on. An exec ask names one too, and does not need it: its
    /// command is on the request itself.
    static func itemID(_ params: JSONValue) -> String? {
        params.stringField("itemId")
    }

    /// The Permission this ask becomes. `changes` is the patch joined on `itemId` — empty for an
    /// exec ask, and for a patch whose notifications have not arrived.
    func permission(
        id: String,
        params: JSONValue,
        changes: [CodexFileChange],
    )
        -> PermissionRequest {
        PermissionRequest(id: id, toolName: toolName, target: target(params, changes))
    }

    /// What the gated call would act ON. A shape this vocabulary cannot read stays verbatim JSON,
    /// for the reason `claude`'s does: a target guessed at is worse than one shown raw.
    private func target(
        _ params: JSONValue,
        _ changes: [CodexFileChange],
    )
        -> PermissionRequest.Target {
        let read: PermissionRequest.Target? = switch self {
        case .commandExecution: params.stringField("command")
            .map(PermissionRequest.Target.command)
        case .fileChange: CodexPatch.target(changes)
        }
        return read ?? .raw(params.compactJSON ?? "")
    }
}

/// One approval as it reaches the gate: which of the two it is, the JSON-RPC id its answer must
/// name, and the patch already joined on its item.
///
/// A value rather than three arguments, because the id and the params are only ever passed together
/// — an answer sent under the wrong id is one the server matches to another call.
struct CodexApprovalAsk {
    let ask: CodexAsk
    let rpcID: Int
    let params: JSONValue

    /// Nothing where the line is not one of the two approvals, which is what tells the thread to
    /// refuse it as unsupported.
    init?(id: Int, method: String, params: JSONValue) {
        guard let ask = CodexAsk(rawValue: method) else { return nil }
        self.ask = ask
        self.rpcID = id
        self.params = params
    }
}
