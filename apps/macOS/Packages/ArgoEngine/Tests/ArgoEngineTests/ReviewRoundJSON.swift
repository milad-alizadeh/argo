/// One submitted review round as GitHub serves it.
struct ReviewRoundJSON {
    var author: String
    var state: String

    var json: String {
        """
        { "user": { "login": "\(author)" }, "state": "\(state)", "commit_id": "c0ffee" }
        """
    }

    static func list(_ rounds: [ReviewRoundJSON]) -> String {
        "[\(rounds.map(\.json).joined(separator: ","))]"
    }
}
