import Foundation

/// The three things a managed Session may tell Argo, as MCP tools.
///
/// Deliberately narrow: the channel exists so the agent can say what a transcript cannot carry —
/// what it is doing, what it needs from you, and what it produced. Anything it can already be
/// observed doing stays observed, at the DERIVED tier where it belongs.
enum CompanionTool: String, CaseIterable {
    case reportStatus = "report_status"
    case askUser = "ask_user"
    case reportOutcome = "report_outcome"

    /// The status words the channel accepts, and what each one means in the domain.
    ///
    /// One table, read both ways: it is the `enum` the tool's schema advertises AND the vocabulary
    /// the reply is read against, so the two cannot drift into a word the agent is offered and
    /// Argo then cannot understand.
    ///
    /// `unknown` is absent from it deliberately — it is what a word OUTSIDE the vocabulary reads
    /// as, never something an agent can claim about itself.
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

    private var summary: String {
        switch self {
        case .reportStatus:
            "Tell Argo what you are doing, so its cockpit does not have to infer it."
        case .askUser:
            "Ask the person at the cockpit a question and surface it in their roster."
        case .reportOutcome:
            "Record what you produced: a code change, a ticket, or a written artifact."
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
