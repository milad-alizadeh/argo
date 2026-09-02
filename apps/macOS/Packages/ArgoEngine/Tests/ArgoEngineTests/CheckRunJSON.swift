/// The check runs GitHub serves for one commit, written as GitHub writes them — steps and all, so
/// a listing test exercises the decoder rather than a convenient subset of it.
struct CheckRunJSON {
    var name: String
    var status = "completed"
    var conclusion: String?

    var json: String {
        """
        { "name": "\(name)", "status": "\(status)",
          "conclusion": \(conclusion.map { "\"\($0)\"" } ?? "null"),
          "steps": [{ "name": "Set up job", "status": "completed" }] }
        """
    }

    static func page(_ runs: [CheckRunJSON]) -> String {
        """
        { "total_count": \(runs.count),
          "check_runs": [\(runs.map(\.json).joined(separator: ","))] }
        """
    }
}
