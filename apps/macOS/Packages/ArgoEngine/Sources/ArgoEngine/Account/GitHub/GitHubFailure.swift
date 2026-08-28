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

    /// GitHub's own words, its per-field complaints included — "Validation Failed" alone names
    /// nothing a reader could act on.
    var reason: String {
        let fields = (errors ?? []).compactMap(\.sentence)
        return fields.isEmpty ? message : "\(message): \(fields.joined(separator: ", "))"
    }
}
