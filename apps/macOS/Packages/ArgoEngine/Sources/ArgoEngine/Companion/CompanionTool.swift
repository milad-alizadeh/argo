import Foundation

/// The four things a managed Session may tell Argo, as MCP tools — what a transcript cannot
/// carry. Anything it can already be observed doing stays observed, at the DERIVED tier.
enum CompanionTool: String, CaseIterable {
    case reportStatus = "report_status"
    case askUser = "ask_user"
    case reportOutcome = "report_outcome"
    /// The claim a transcript cannot carry either (#1335): the change is ready for a pull
    /// request. Free text rather than a vocabulary — a file count and a commit count are not a
    /// closed set of words.
    case reportReady = "report_ready"

    /// The status words the channel accepts. One table read both ways: the `enum` the tool's
    /// schema advertises AND the vocabulary the reply is read against, so the two cannot drift.
    /// `unknown` is absent deliberately — it is what a word OUTSIDE the vocabulary reads as, never
    /// something an agent can claim about itself.
    static let statuses: KeyValuePairs<String, SessionStatus> = [
        "running": .running,
        "permission": .permission,
        "asking": .asking,
        "idle": .idle,
        "stopped": .stopped,
        "ended": .ended,
    ]

    /// A word outside the vocabulary reads `unknown` rather than the nearest guess — the
    /// degrade-down rule applies to the channel exactly as it applies to a transcript.
    static func status(named word: String) -> SessionStatus {
        statuses.first { $0.key == word }?.value ?? .unknown
    }

    var descriptor: [String: Any] {
        ["name": rawValue, "description": summary, "inputSchema": schema]
    }

    /// The name the transcript carries for this call: `mcp__argo__<tool>`, the CLI's own
    /// qualifying convention over the server key `mcp.json` registers this under
    /// (`CompanionInvitation`, `"argo"`) — read by `TranscriptReader+Assistant` to tell a
    /// companion call apart from an ordinary MCP one.
    var qualifiedName: String {
        "\(mcpToolPrefix)argo\(mcpNameSeparator)\(rawValue)"
    }

    private var summary: String {
        switch self {
        case .reportStatus:
            "Tell Argo what you are doing, so its cockpit does not have to infer it."
        case .askUser:
            "Ask the person at the cockpit a question and surface it in their roster."
        case .reportOutcome:
            "Record what you produced: a code change, a ticket, or a written artifact."
        case .reportReady:
            "Tell Argo the change is ready for a pull request, with a short reason."
        }
    }

    private var schema: [String: Any] {
        switch self {
        case .reportStatus:
            Self.object(
                ["status": Self.string(Self.statusWords), "detail": Self.string()],
                required: ["status"],
            )
        case .askUser:
            Self.object(
                ["question": Self.string(), "options": ["type": "array", "items": Self.string()]],
                required: ["question"],
            )
        case .reportOutcome:
            Self.object(
                [
                    "target": Self.string(CompanionOutcome.Target.allCases.map(\.rawValue)),
                    "reference": Self.string(),
                    "summary": Self.string(),
                ],
                required: ["target", "reference", "summary"],
            )
        case .reportReady:
            Self.object(["reason": Self.string()], required: ["reason"])
        }
    }

    private static var statusWords: [String] {
        statuses.map(\.key)
    }

    private static func object(_ properties: [String: Any], required: [String]) -> [String: Any] {
        ["type": "object", "properties": properties, "required": required]
    }

    private static func string(_ options: [String]? = nil) -> [String: Any] {
        guard let options else { return ["type": "string"] }
        return ["type": "string", "enum": options]
    }
}
