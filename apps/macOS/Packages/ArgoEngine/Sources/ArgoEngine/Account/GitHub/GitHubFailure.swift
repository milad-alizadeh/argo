import Foundation

/// GitHub's own error shape, which its API returns for every 4xx it hands back as a body rather
/// than as a thrown status.
///
/// One type for both readers: the titles read and the listing both have to tell a `Not Found` from
/// a reply they simply could not parse, and two copies of one wire shape drift apart.
struct GitHubFailure: Decodable {
    let message: String

    /// GitHub's own wording for a number behind which there is nothing this token can see. A
    /// private issue invisible to this token and one that does not exist are the same answer by
    /// design, and neither is worth a guess at which it was.
    static let notFound = "Not Found"

    var isNotFound: Bool {
        message == Self.notFound
    }
}
