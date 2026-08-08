import Foundation

/// One JSON-RPC 2.0 message off the companion socket.
///
/// Parsed through `JSONValue` rather than a `Codable` struct for the reason the transcript reader
/// gives: this is untrusted input, and a strict decode turns one malformed field into a dropped
/// connection instead of one error reply.
struct CompanionRequest {
    /// Absent for a notification, which is exactly what says no reply is owed.
    let id: JSONValue?
    let method: String
    let params: JSONValue

    init?(line: String) {
        guard let value = JSONValue.record(fromLine: line),
              let method = value.stringField("method")
        else { return nil }
        self.id = value["id"]
        self.method = method
        self.params = value["params"] ?? .object([:])
    }

    var isNotification: Bool {
        id == nil || id == .null
    }
}

/// The JSON-RPC envelope, as bytes on the wire.
///
/// Written by hand rather than encoded from a model because the payloads below are literal MCP
/// documents — a tool schema is JSON that happens to live in Swift, and a `Codable` mirror of it
/// would be a second place for it to drift.
enum CompanionResponse {
    static func result(id: JSONValue?, _ payload: [String: Any]) -> [String: Any] {
        envelope(id: id, key: "result", value: payload)
    }

    static func failure(id: JSONValue?, code: Int, message: String) -> [String: Any] {
        envelope(id: id, key: "error", value: ["code": code, "message": message])
    }

    /// A tool's answer. MCP wraps every one in content blocks, and `isError` is how a refusal
    /// travels without failing the call itself.
    static func toolContent(_ text: String, isError: Bool = false) -> [String: Any] {
        ["content": [["type": "text", "text": text]], "isError": isError]
    }

    static func line(_ message: [String: Any]) -> String? {
        guard JSONSerialization.isValidJSONObject(message),
              let data = try? JSONSerialization.data(withJSONObject: message),
              let text = String(data: data, encoding: .utf8)
        else { return nil }
        return text
    }

    private static func envelope(id: JSONValue?, key: String, value: Any) -> [String: Any] {
        var message: [String: Any] = ["jsonrpc": "2.0", key: value]
        message["id"] = jsonrpcID(id)
        return message
    }

    /// A JSON-RPC id is a string, a number or null, and it must come back exactly as it went out.
    private static func jsonrpcID(_ id: JSONValue?) -> Any {
        switch id {
        case let .string(value): value
        case let .number(value): value
        case .bool, .array, .object, .null, .none: NSNull()
        }
    }
}
