@testable import ArgoEngine
import Foundation

/// GitHub's issue endpoints, recorded. Each reply is keyed by the part of the path that names it,
/// so a test says which endpoint answered what rather than which request number did — a listing
/// makes a different number of requests depending on what the issues carry.
actor RecordedIssues: HTTPTransport {
    private let replies: [String: String]
    private let failure: Error?
    private var asked: [String] = []

    init(replies: [String: String], failure: Error? = nil) {
        self.replies = replies
        self.failure = failure
    }

    func send(_ request: HTTPRequest) throws -> Data {
        asked.append(request.url)
        if let failure {
            throw failure
        }
        let reply = replies.first { request.url.contains($0.key) }?.value
        return Data((reply ?? "[]").utf8)
    }

    func urls() -> [String] {
        asked
    }
}

/// A Work Item port that answers from a script, for the suites about polling rather than about
/// GitHub. Each `list` takes the next answer and the last one repeats, so a test says "this read
/// fails, every later one succeeds" without counting ticks.
actor ScriptedWorkItems: WorkItemPort {
    private var script: [Result<[WorkItem], WorkItemFetchError>]
    private var reads = 0

    init(_ script: [Result<[WorkItem], WorkItemFetchError>]) {
        self.script = script
    }

    func list(in _: String, grant _: AccountGrant) async throws -> [WorkItem] {
        reads += 1
        guard let answer = script.count > 1 ? script.removeFirst() : script.first else { return [] }
        return try answer.get()
    }

    func readCount() -> Int {
        reads
    }
}

/// How many times a poll said it had finished a read. Counted rather than flagged, so a test can
/// tell "raised once per read" from "raised at all".
actor Landings {
    private var count = 0

    nonisolated var raise: WorkItemPoll.Landing {
        { await self.record() }
    }

    func raised() -> Int {
        count
    }

    private func record() {
        count += 1
    }
}

/// A poll's wait, made observable. `reach` fires when the loop starts waiting, so a test can act
/// on a tick that has actually happened rather than on a sleep it hopes has elapsed.
actor PollWait {
    private var waiters: [CheckedContinuation<Void, Never>] = []
    private var reached = 0
    private var consumed = 0

    func reach() {
        reached += 1
        for waiter in waiters {
            waiter.resume()
        }
        waiters = []
    }

    /// Returns once a tick this caller has not yet seen has happened. Counted rather than
    /// signalled, so a tick that lands before the test starts waiting still ends the wait.
    func untilTick() async {
        if consumed == reached {
            await withCheckedContinuation { waiters.append($0) }
        }
        consumed += 1
    }
}

extension AccountGrant {
    /// The grant every Work Item read in these suites carries, so what a request presents is one
    /// fact in one place.
    static let listing = AccountGrant(accessToken: "ghu_listing", scopes: ["repo"])
}

extension ResolvedBinding {
    /// A Work Item Binding resolved onto one GitHub identity, which is every input a read needs.
    /// `regranted` is the same identity holding a NEW token, which is what authorizing an Account
    /// again produces: the Binding either side of it is identical.
    static func stub(
        accountID: String = "1", scope: String = "acme/api", regranted: String? = nil,
    )
        -> ResolvedBinding {
        let account = AccountRecord(
            provider: .github, providerAccountID: accountID, displayName: "octocat",
        )
        return ResolvedBinding(
            binding: ProjectBinding(port: .workItem, accountID: account.id, scope: scope),
            account: account,
            grant: regranted.map { AccountGrant(accessToken: $0, scopes: ["repo"]) } ?? .listing,
        )
    }
}
