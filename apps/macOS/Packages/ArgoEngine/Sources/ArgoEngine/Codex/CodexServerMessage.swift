import Foundation

/// One line `codex app-server` wrote, read into the four things it can be.
///
/// Told apart by which fields are present rather than by what the method is called, because that is
/// what JSON-RPC itself says: an `id` with a `method` is a request the client must answer, an `id`
/// without one is an answer to something the client asked, and no `id` at all is a notification
/// nobody answers.
///
/// A line that is neither reads as nothing rather than as an error. The server's stdout also
/// carries whatever a plugin or a startup banner puts there, and a stream Argo cannot parse must
/// not take the Session down with it.
enum CodexServerMessage: Equatable {
    /// The server answering something Argo asked, by the id Argo gave it.
    case answer(id: Int, result: JSONValue)
    /// The server refusing it, ditto. What went wrong is on the line; nothing here acts on the
    /// detail, so it is not carried.
    case failure(id: Int)
    /// The server asking ARGO something — the approvals, above all (ADR-0024).
    case request(id: Int, method: String, params: JSONValue)
    case notification(method: String, params: JSONValue)

    init?(line: String) {
        guard let record = JSONValue.record(fromLine: line) else { return nil }
        let params = record["params"] ?? .null
        switch (record.stringField("method"), record["id"]?.int) {
        case let (method?, id?):
            self = .request(id: id, method: method, params: params)
        case let (method?, nil):
            self = .notification(method: method, params: params)
        case let (nil, id?):
            self = record["error"] == nil
                ? .answer(id: id, result: record["result"] ?? .null)
                : .failure(id: id)
        case (nil, nil):
            return nil
        }
    }
}
