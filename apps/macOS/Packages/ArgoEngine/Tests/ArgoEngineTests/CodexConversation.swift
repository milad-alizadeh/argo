@testable import ArgoEngine
import Foundation

/// A stand-in `codex app-server`: what the client wrote, read back as JSON-RPC, and the answers a
/// real server would send.
///
/// It answers the shapes the spike recorded against codex-cli 0.147.0
/// (`docs/research/2026-08-12-codex-app-server-approvals.md`) and nothing else. A fake of the CLI,
/// which is the one thing here Argo does not own and cannot afford to launch per assertion — what
/// the real server does is asserted by `CodexLiveTests`.
///
/// It is a value over two closures rather than a class, so the same conversation reads a thread
/// driven directly and one the Hub spawned behind a fake process.
@MainActor
struct CodexConversation {
    let written: @MainActor () -> [String]
    let deliver: @MainActor (String) -> Void

    /// One request the client made.
    struct Asked {
        let id: Int
        let method: String
        let params: JSONValue
    }

    /// The requests the client has made, in order.
    var requests: [Asked] {
        lines.compactMap { line in
            guard let id = line["id"]?.int, let method = line.stringField("method") else {
                return nil
            }
            return Asked(id: id, method: method, params: line["params"] ?? .null)
        }
    }

    /// The answers the client has sent back to the server's own requests.
    var answers: [(id: Int, result: JSONValue)] {
        lines.compactMap { line in
            guard let id = line["id"]?.int, line["method"] == nil else { return nil }
            return (id: id, result: line["result"] ?? line["error"] ?? .null)
        }
    }

    /// The `turn/start` parameters, in the order the Turns went.
    var turns: [JSONValue] {
        requests.filter { $0.method == "turn/start" }.map(\.params)
    }

    var lines: [JSONValue] {
        // Joined first: a caller may have written one line as several chunks, and the framing is
        // the newline rather than the call.
        written().joined().split(separator: "\n").compactMap {
            JSONValue.record(fromLine: String($0))
        }
    }

    func request(_ method: String) -> Asked? {
        requests.last { $0.method == method }
    }

    /// Walk the handshake to a live thread, answering whatever the client asked for.
    func open(threadID: String = "thread-1") {
        guard let hello = request("initialize") else { return }
        answer(hello.id, result: .object(["userAgent": .string("argo/0.147.0")]))
        guard let start = request("thread/start") else { return }
        answer(start.id, result: .object(["thread": .object(["id": .string(threadID)])]))
    }

    /// The server saying a Turn is running, which is what an interrupt names.
    func started(turn: String) {
        notify("turn/started", params: .object(["turn": .object(["id": .string(turn)])]))
    }

    func completedTurn() {
        notify("turn/completed", params: .object(["turn": .object(["id": .string("done")])]))
    }

    /// The server asking Argo something — an approval, above all.
    func ask(_ id: Int, method: String) {
        emit(.object([
            "jsonrpc": .string("2.0"),
            "id": .number(Double(id)),
            "method": .string(method),
            "params": .object([:]),
        ]))
    }

    /// The server refusing something the client asked for.
    func refuse(_ id: Int) {
        emit(.object([
            "jsonrpc": .string("2.0"),
            "id": .number(Double(id)),
            "error": .object([
                "code": .number(-32600),
                "message": .string("refused"),
            ]),
        ]))
    }

    func answer(_ id: Int, result: JSONValue) {
        emit(.object([
            "jsonrpc": .string("2.0"),
            "id": .number(Double(id)),
            "result": result,
        ]))
    }

    func notify(_ method: String, params: JSONValue) {
        emit(.object([
            "jsonrpc": .string("2.0"),
            "method": .string(method),
            "params": params,
        ]))
    }

    /// Down the wire as the real server writes it: one line, newline-terminated.
    private func emit(_ message: JSONValue) {
        guard let line = message.compactJSON else { return }
        deliver(line + "\n")
    }
}
