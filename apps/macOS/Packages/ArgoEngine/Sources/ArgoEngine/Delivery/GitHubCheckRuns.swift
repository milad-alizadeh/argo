import Foundation

/// The check runs GitHub serves for one commit, parsed at the boundary and nowhere else.
///
/// Read at their top level and no deeper: GitHub nests steps inside a run, and `CONTEXT.md` L4
/// fixes Checks at one level.
struct GitHubCheckRuns: Decodable {
    let checkRuns: [Run]

    struct Run: Decodable {
        let name: String
        /// Where the run is — `queued`, `in_progress`, `completed`.
        let status: String
        /// How it went, and absent until it has finished.
        let conclusion: String?

        /// The host's own word, and the conclusion whenever there is one: a finished run's word is
        /// how it went, and an unfinished one's is where it is.
        var check: DeliveryCheck {
            DeliveryCheck(name: name, status: conclusion ?? status)
        }
    }
}
