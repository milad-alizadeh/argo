import Foundation

/// What Argo says to `codex app-server`: JSON-RPC 2.0, one object per line, newline-delimited
/// (ADR-0024). That framing is the whole transport — there is no header and no length prefix.
///
/// The shapes are the ones exercised against codex-cli 0.147.0 and recorded in
/// `docs/research/2026-08-12-codex-app-server-approvals.md`. The server generates them itself with
/// `codex app-server generate-json-schema`, which is where any of this can be re-derived.
///
/// Every builder answers an optional line, and nothing here force-unwraps an encode: a `nil` is
/// carried to the one place that writes, so a message that could not be built is a send that
/// refuses rather than a blank line put on the wire.
enum CodexRPC {
    /// A request the server must answer, carrying the id its answer will name.
    static func request(id: Int, method: String, params: [String: JSONValue]) -> String? {
        line([
            "jsonrpc": .string("2.0"),
            "id": .number(Double(id)),
            "method": .string(method),
            "params": .object(params),
        ])
    }

    /// A message the server answers nothing to — `initialized`, and the rest of the one-way half.
    static func notification(_ method: String, params: [String: JSONValue] = [:]) -> String? {
        line([
            "jsonrpc": .string("2.0"),
            "method": .string(method),
            "params": .object(params),
        ])
    }

    /// Argo ANSWERING a server→client request, by the id that request carried. This is the whole
    /// of how an approval is decided on this surface: a plain JSON-RPC response.
    static func result(id: Int, _ result: [String: JSONValue]) -> String? {
        line([
            "jsonrpc": .string("2.0"),
            "id": .number(Double(id)),
            "result": .object(result),
        ])
    }

    /// Argo REFUSING a server→client request it has no answer for. Sent rather than ignored: a
    /// request left unanswered holds the turn open indefinitely, because the server keeps no clock
    /// of its own (openai/codex#11816).
    static func unsupported(id: Int, method: String) -> String? {
        line([
            "jsonrpc": .string("2.0"),
            "id": .number(Double(id)),
            "error": .object([
                "code": .number(-32601),
                "message": .string("\(method) is not answered by this client"),
            ]),
        ])
    }

    private static func line(_ fields: [String: JSONValue]) -> String? {
        JSONValue.object(fields).compactJSON.map { $0 + "\n" }
    }
}
