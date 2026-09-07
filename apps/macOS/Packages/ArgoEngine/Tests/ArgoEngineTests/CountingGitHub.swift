@testable import ArgoEngine
import Foundation
import Testing

/// GitHub answered by URL and counted, so a claim about what a tick SPENDS is measured through the
/// shipped adapter rather than through a fake port (#1619).
///
/// It knows the four reads a Delivery derivation makes and nothing else: the open listing, one
/// branch's `head=` listing, a commit's check runs, and a pull request's reviews.
///
/// Beside `RecordedGitHub` rather than through it for two reasons: this counts per TICK, which a
/// growing list of every URL sent cannot answer, and it reads the branch back out of a `head=`
/// query rather than needing one pre-built reply key per branch — eighty of them, spelled in the
/// adapter's own percent-encoding.
actor CountingGitHub: HTTPTransport {
    /// What the host holds for each branch, keyed by branch. A branch with no entry is one the host
    /// holds nothing for — the row this ticket is about.
    private let byBranch: [String: PullRequestJSON]
    private let open: [PullRequestJSON]
    private var sent = 0

    init(open: [PullRequestJSON], byBranch: [String: PullRequestJSON]) {
        self.open = open
        self.byBranch = byBranch
    }

    /// How many requests have been sent since the last `spent()`, which is what one tick cost.
    func spent() -> Int {
        defer { sent = 0 }
        return sent
    }

    func send(_ request: HTTPRequest) -> Data {
        sent += 1
        return Data(body(of: request.url).utf8)
    }

    private func body(of url: String) -> String {
        if url.contains("state=open") {
            return PullRequestJSON.list(open)
        }
        if let branch = Self.branch(askedBy: url) {
            return PullRequestJSON.list(byBranch[branch].map { [$0] } ?? [])
        }
        if url.contains("/check-runs") {
            return #"{ "check_runs": [] }"#
        }
        guard url.contains("/reviews") else {
            // Counted but unrecognised, which would otherwise read as a wrong measurement with no
            // explanation attached to it.
            Issue.record("\(url) is not one of the four reads a derivation makes")
            return "[]"
        }
        return "[]"
    }

    /// The branch a `head=owner:branch` listing is asking about, decoded back out of the query the
    /// adapter encoded it into.
    private static func branch(askedBy url: String) -> String? {
        guard let head = url.range(of: "&head=") else { return nil }
        let value = url[head.upperBound...].prefix { $0 != "&" }
        guard let colon = value.firstIndex(of: ":") else { return nil }
        let branch = value[value.index(after: colon)...]
        return branch.removingPercentEncoding ?? String(branch)
    }
}
