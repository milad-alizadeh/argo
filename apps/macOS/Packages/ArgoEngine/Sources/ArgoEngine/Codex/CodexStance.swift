import Foundation

/// How far a Codex Session may go without asking, in the server's own two spellings: a string on
/// `thread/start`, an object on `turn/start`. The asymmetry is the server's; it is spelled here so
/// no caller has to know it.
enum CodexSandbox: String {
    case readOnly = "read-only"
    case workspaceWrite = "workspace-write"
    case fullAccess = "danger-full-access"

    var policy: JSONValue {
        switch self {
        case .readOnly: .object(["type": .string("readOnly")])
        case .workspaceWrite: .object(["type": .string("workspaceWrite")])
        case .fullAccess: .object(["type": .string("dangerFullAccess")])
        }
    }
}

/// When a Codex Session stops to ask — the server's `AskForApproval`, in the three plain values of
/// it Argo uses. The granular form exists and is not one of Argo's rungs.
enum CodexApproval: String {
    case untrusted
    case onRequest = "on-request"
    case never
}

/// One rung of the ladder as `codex app-server` spells it (ADR-0025's `codex` column).
///
/// Two values rather than one, because Codex decides a boundary with both: the approval policy says
/// when it asks, the sandbox says how far it may go without asking. Read Only and Plan share a
/// boundary here exactly as they do on the ladder — they differ by intent, which is Argo's word and
/// not the CLI's.
///
/// `auto` is the one rung that asks nothing, so it is the one that turns approvals off rather than
/// widening the sandbox under them.
struct CodexStance: Equatable {
    let approval: CodexApproval
    let sandbox: CodexSandbox

    static func of(_ mode: SessionMode) -> CodexStance {
        switch mode {
        case .readOnly, .plan: CodexStance(approval: .onRequest, sandbox: .readOnly)
        case .code: CodexStance(approval: .onRequest, sandbox: .workspaceWrite)
        case .auto: CodexStance(approval: .never, sandbox: .fullAccess)
        }
    }

    /// Both halves in the server's own spellings, joined. The JOIN is Argo's and the words are not:
    /// this surface states a boundary with two values and there is no single one to quote, so a
    /// reading that named either alone would be half a stance reported as the whole of it.
    var value: String {
        "\(approval.rawValue) · \(sandbox.rawValue)"
    }
}

/// Codex's own words for the ladder (#749). Its `value` is what `thread/start` and every
/// `turn/start` are sent — so a Codex Session's stance is stated in Codex's vocabulary rather than
/// in the one `claude` reports, which was the false DIRECT this port exists to end.
extension CodexStance: AgentStanceVocabulary {
    static func value(for mode: SessionMode) -> String {
        of(mode).value
    }

    /// Nothing observes a Codex stance: there is no transcript on this surface to state one
    /// (ADR-0024), so the rung Argo set is the only fact there is and this is reached only if that
    /// ever changes. An unrecognised word claims no rung rather than guessing at one.
    static func reading(of observed: String) -> SessionModeReading {
        guard let mode = SessionMode.allCases.first(where: { value(for: $0) == observed }) else {
            return .unknown(cli: observed)
        }
        return .exactly(mode, cli: observed)
    }
}
