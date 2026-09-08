import Foundation

/// GitHub's own error shape, which its API returns for every 4xx it hands back as a body rather
/// than as a thrown status.
///
/// One type for both readers: the titles read and the listing both have to tell a `Not Found` from
/// a reply they simply could not parse, and two copies of one wire shape drift apart.
struct GitHubFailure: Decodable {
    let message: String

    /// The per-field complaints behind a validation refusal, absent on the failures that carry
    /// none. A write is the only caller that needs them — "Validation Failed" names nothing a
    /// reader could act on, and which field it was is the entire answer.
    let errors: [FieldError]?

    struct FieldError: Decodable {
        let field: String?
        let code: String?
        /// GitHub's own prose where it wrote any, which outranks the code it also sent.
        let message: String?

        var sentence: String? {
            if let message {
                return message
            }
            guard let field else { return code }
            return code.map { "\(field) \($0)" } ?? field
        }
    }

    /// GitHub's own wording for a number behind which there is nothing this token can see. A
    /// private issue invisible to this token and one that does not exist are the same answer by
    /// design, and neither is worth a guess at which it was.
    static let notFound = "Not Found"

    var isNotFound: Bool {
        message == Self.notFound
    }

    /// GitHub's own wording, in the 422 it answers a commit-keyed path with, for a commit this
    /// repository does not have — a local tip nobody pushed. The SHA is appended to it, so this is
    /// a prefix rather than an equality.
    static let noCommitFound = "No commit found for SHA"

    /// Whether the host is saying the commit is not its own. A fact about the commit asked about
    /// and not about the read, which is why `GitHubDeliveries` may take it as an answer (ADR-0032).
    var isCommitAbsent: Bool {
        message.hasPrefix(Self.noCommitFound)
    }

    /// GitHub's own wording, in the per-field complaint behind the 422 it answers a forwarder
    /// create with while the repository is still holding the previous `cli` hook. The top-level
    /// message is only "Validation Failed", so the complaint is the half that names what happened.
    static let hookAlreadyHeld = "Hook already exists on this repository"

    /// Whether the refusal is the repository saying it still holds the hook. A state the caller can
    /// clear — delete that hook and create again — rather than a host it could not reach (#1697).
    var isHookAlreadyHeld: Bool {
        (errors ?? []).contains { $0.message == Self.hookAlreadyHeld }
    }

    /// GitHub's own words, its per-field complaints included — "Validation Failed" alone names
    /// nothing a reader could act on.
    var reason: String {
        let fields = (errors ?? []).compactMap(\.sentence)
        return fields.isEmpty ? message : "\(message): \(fields.joined(separator: ", "))"
    }
}
