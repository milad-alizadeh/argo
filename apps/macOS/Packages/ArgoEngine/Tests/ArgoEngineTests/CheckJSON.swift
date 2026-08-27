import Foundation

/// The check runs GitHub serves for one commit, and the review rounds it serves for one pull
/// request — written as GitHub writes them, steps and all, so a test exercises the decoder rather
/// than a convenient subset of it.
enum CheckJSON {
    struct Run {
        var name: String
        var status = "completed"
        var conclusion: String?
    }

    struct Round {
        var author: String
        var state: String
    }

    static func runs(_ runs: [Run]) -> String {
        let entries = runs.map { run in
            """
            { "name": "\(run.name)", "status": "\(run.status)",
              "conclusion": \(run.conclusion.map { "\"\($0)\"" } ?? "null"),
              "steps": [{ "name": "Set up job", "status": "completed" }] }
            """
        }
        return """
        { "total_count": \(runs.count), "check_runs": [\(entries.joined(separator: ","))] }
        """
    }

    static func reviews(_ rounds: [Round]) -> String {
        let entries = rounds.map { round in
            """
            { "user": { "login": "\(round.author)" }, "state": "\(round.state)",
              "commit_id": "c0ffee" }
            """
        }
        return "[\(entries.joined(separator: ","))]"
    }
}
