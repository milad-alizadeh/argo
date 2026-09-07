@testable import ArgoEngine

/// One socket's whole life, as a script writes it.
enum ScriptedSocket: Sendable {
    /// The host would not open one — a grant it will not make a hook on, a repository the user does
    /// not administer, a create it refused, a dial that failed.
    case refused
    /// A socket that opened, carried this many moves, and then dropped.
    case carrying(Int)
}

/// A code host watch that opens from a script, for the suites about the socket rather than about
/// GitHub. Each open takes the next entry and the last one repeats, so a test says "this dial is
/// refused, every later one carries" without counting reconnections.
actor ScriptedCodeHostWatch: CodeHostWatch {
    private var script: [ScriptedSocket]
    private var opens = 0
    private var asked: (scope: String, token: String)?
    private var opened: ScriptedDeliveryWatch?

    init(_ script: [ScriptedSocket]) {
        self.script = script
    }

    /// The socket the last dial opened, so a case can claim what became of it.
    func lastOpened() -> ScriptedDeliveryWatch? {
        opened
    }

    /// How many sockets were dialled, which is one per connection attempt — what a suite about
    /// reconnecting counts, rather than what any one of them carried.
    func openCount() -> Int {
        opens
    }

    /// The scope and the token the last dial presented, so a case can claim the watch was opened on
    /// the Binding's own grant rather than on something a default supplied.
    func lastAsked() -> (scope: String, token: String)? {
        asked
    }

    func open(_ scope: String, grant: AccountGrant) async throws -> any DeliveryWatch {
        opens += 1
        asked = (scope, grant.accessToken)
        let next = script.count > 1 ? script.removeFirst() : script.first
        guard case let .carrying(moves) = next else { throw ProviderFetchError.unreachable }
        let watch = ScriptedDeliveryWatch(moves: moves)
        opened = watch
        return watch
    }
}

/// One scripted socket: a fixed number of moves, and then the end of it.
actor ScriptedDeliveryWatch: DeliveryWatch {
    private var moves: Int
    private var closes = 0

    init(moves: Int) {
        self.moves = moves
    }

    /// Whether the socket was closed rather than merely abandoned — what says a run that ended left
    /// nothing open behind it.
    func closeCount() -> Int {
        closes
    }

    func nextMove() async throws {
        guard moves > 0 else { throw ProviderFetchError.unreachable }
        moves -= 1
    }

    func close() {
        closes += 1
    }
}

/// A fake sleeper that records every wait it was asked for and then returns at once, so a case can
/// claim the backoff schedule rather than race a real clock for it.
actor SocketWaits {
    private var asked: [Duration] = []
    private var waiters: [CheckedContinuation<Void, Never>] = []

    nonisolated var sleep: PortPollLoop.Sleeper {
        { duration in await self.record(duration) }
    }

    func waits() -> [Duration] {
        asked
    }

    func untilWaited(_ wanted: Int) async {
        while asked.count < wanted {
            await withCheckedContinuation { waiters.append($0) }
        }
    }

    private func record(_ duration: Duration) async {
        asked.append(duration)
        for waiter in waiters {
            waiter.resume()
        }
        waiters = []
        // Yielded because this sleeper does not actually wait: without it a run that only ever
        // dials and backs off would never let the case that is counting its waits proceed.
        await Task.yield()
    }
}

/// Every dial failure the socket reported, and a wait for the next one — what a case about #1643's
/// reading acts on, rather than a sleep it hopes has elapsed.
actor SocketFailures {
    private var reported: [(target: PortReadTarget, error: Error)] = []
    private var waiters: [CheckedContinuation<Void, Never>] = []

    nonisolated var reportDialFailure: DeliverySocket.ReportDialFailure {
        { target, error in await self.record(target, error) }
    }

    func count() -> Int {
        reported.count
    }

    func last() -> PortReadTarget? {
        reported.last?.target
    }

    func untilReported(_ wanted: Int) async {
        while reported.count < wanted {
            await withCheckedContinuation { waiters.append($0) }
        }
    }

    private func record(_ target: PortReadTarget, _ error: Error) {
        reported.append((target, error))
        for waiter in waiters {
            waiter.resume()
        }
        waiters = []
    }
}

/// How many derivations the socket asked for, and a wait for the next one — so a case acts on a
/// derivation that has happened rather than on a sleep it hopes has elapsed.
actor SocketDerivations {
    private var count = 0
    private var waiters: [CheckedContinuation<Void, Never>] = []

    nonisolated var derive: DeliverySocket.Derive {
        { _ in await self.record() }
    }

    func derived() -> Int {
        count
    }

    func untilDerived(_ wanted: Int) async {
        while count < wanted {
            await withCheckedContinuation { waiters.append($0) }
        }
    }

    private func record() {
        count += 1
        for waiter in waiters {
            waiter.resume()
        }
        waiters = []
    }
}
