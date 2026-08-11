import Foundation

/// The MCP server one managed Session talks to, as a pure function from request to reply.
///
/// Pure on purpose: the socket below it is I/O a test cannot make claims about, while THIS is where
/// a reported fact becomes a CONVENTION-tier fact.
struct CompanionEndpoint {
    /// The version of MCP this server answers with. Stated rather than echoed: answering whatever
    /// the client asked for would claim support for a revision this endpoint has never seen.
    static let protocolVersion = "2025-06-18"

    let deliver: (CompanionFact) -> Void

    /// The reply owed, or nothing — a notification is owed no reply, and answering one is a
    /// protocol error rather than a courtesy.
    func respond(to request: CompanionRequest) -> [String: Any]? {
        guard !request.isNotification else { return nil }
        return switch request.method {
        case "initialize": CompanionResponse.result(id: request.id, Self.handshake)
        case "ping": CompanionResponse.result(id: request.id, [:])
        case "tools/list": CompanionResponse.result(id: request.id, Self.catalog)
        case "tools/call": call(request)
        default: CompanionResponse.failure(
                id: request.id,
                code: -32601,
                message: "Unknown method \(request.method)",
            )
        }
    }

    /// Computed rather than stored: these are `[String: Any]` literals, which no `let` at file
    /// scope may be under strict concurrency.
    private static var handshake: [String: Any] {
        [
            "protocolVersion": protocolVersion,
            "capabilities": ["tools": [String: Any]()],
            "serverInfo": ["name": "argo-companion", "version": "1"],
        ]
    }

    private static var catalog: [String: Any] {
        ["tools": CompanionTool.allCases.map(\.descriptor)]
    }

    private func call(_ request: CompanionRequest) -> [String: Any] {
        guard let name = request.params.stringField("name"),
              let tool = CompanionTool(rawValue: name)
        else {
            return CompanionResponse.result(
                id: request.id,
                CompanionResponse.toolContent("No such tool", isError: true),
            )
        }
        let arguments = request.params["arguments"] ?? .object([:])
        guard let fact = CompanionArguments.fact(for: tool, from: arguments, callID: request.id)
        else {
            return CompanionResponse.result(
                id: request.id,
                CompanionResponse.toolContent("Missing required argument", isError: true),
            )
        }
        deliver(fact)
        return CompanionResponse.result(id: request.id, CompanionResponse.toolContent("Recorded"))
    }
}
