@testable import ArgoEngine
import Foundation

/// A code host that answers from a script, for the suites about deriving rather than about GitHub.
/// Each read takes the next answer and the last one repeats, so a test says "this read fails, every
/// later one succeeds" without counting ticks.
actor ScriptedCodeHost: CodeHostPort {
    private var script: [Result<[Delivery], ProviderFetchError>]

    init(_ script: [Result<[Delivery], ProviderFetchError>]) {
        self.script = script
    }

    func deliveries(in _: String, grant _: AccountGrant) async throws -> [Delivery] {
        guard let answer = script.count > 1 ? script.removeFirst() : script.first else { return [] }
        return try answer.get()
    }
}

extension PortReadTarget {
    /// A code host Binding resolved onto one GitHub identity, which is every input a derivation
    /// needs.
    static func codeHost(projectID: String = "P1") -> PortReadTarget {
        let account = AccountRecord(
            provider: .github, providerAccountID: "1", displayName: "octocat",
        )
        return PortReadTarget(
            binding: ResolvedBinding(
                binding: ProjectBinding(
                    port: .codeHost, accountID: account.id, scope: "acme/api",
                ),
                account: account,
                grant: .listing,
            ),
            projectID: projectID,
        )
    }
}

extension DeliveryPullRequest {
    /// An open pull request with nothing observed on it, which is every input a derivation needs
    /// that is not the branch itself.
    static func stub(number: Int, body: String? = nil) -> DeliveryPullRequest {
        DeliveryPullRequest(
            number: number,
            title: "A change",
            state: "open",
            facts: Facts(isDraft: false, isMerged: false, baseBranch: "main", headSHA: "c0ffee"),
            body: body,
            url: nil,
        )
    }
}

extension WorkspaceProjection {
    /// A Workspace on one branch. `nil` is the folder git would not name a branch in, which is a
    /// detached HEAD and a Session with no Delivery.
    static func on(_ branch: String?) -> WorkspaceProjection {
        WorkspaceProjection(kind: .worktree, branch: branch, dirty: 0, unpushed: 0)
    }
}
