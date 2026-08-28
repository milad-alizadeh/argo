import Foundation

/// One write as GitHub takes it — the path, the verb, and whether its reply is worth adopting.
struct GitHubWriteRequest: Sendable {
    let path: String
    let method: HTTPMethod
    let body: Data?

    /// Whether GitHub's own reply to this write IS the ticket that was written to. `POST
    /// /issues/{parent}/sub_issues` answers with the PARENT, and `/labels` with a label list —
    /// adopting either as the subject would replace one ticket's facts with another's.
    let answersWithSubject: Bool

    static func patch(_ path: String, _ fields: [String: Any]) throws -> GitHubWriteRequest {
        try GitHubWriteRequest(
            path: path, method: .patch, body: json(fields), answersWithSubject: true,
        )
    }

    /// The one `POST` whose reply IS the ticket: filing a new one.
    static func filing(_ path: String, _ fields: [String: Any]) throws -> GitHubWriteRequest {
        try GitHubWriteRequest(
            path: path, method: .post, body: json(fields), answersWithSubject: true,
        )
    }

    static func post(_ path: String, _ fields: [String: Any]) throws -> GitHubWriteRequest {
        try GitHubWriteRequest(
            path: path, method: .post, body: json(fields), answersWithSubject: false,
        )
    }

    static func delete(
        _ path: String, _ fields: [String: Any] = [:],
    ) throws
        -> GitHubWriteRequest {
        try GitHubWriteRequest(
            path: path,
            method: .delete,
            body: fields.isEmpty ? nil : json(fields),
            answersWithSubject: false,
        )
    }

    /// The reply to adopt, and `nil` where the reply is about some other ticket and the subject has
    /// to be read back instead.
    func adoptable(_ reply: Data) -> Data? {
        answersWithSubject ? reply : nil
    }

    /// Thrown rather than dropped: a bodiless `PATCH` is a 200 no-op at GitHub, which the adapter
    /// would then adopt and report as a write that landed.
    private static func json(_ fields: [String: Any]) throws -> Data {
        try JSONSerialization.data(withJSONObject: fields)
    }
}
