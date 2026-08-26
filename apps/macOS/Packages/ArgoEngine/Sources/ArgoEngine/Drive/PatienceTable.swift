import Foundation

/// What a `PatienceTable` has to know about one blocked request to lift it back out again.
protocol Patient {
    /// The id an answer names. By id and never by position: a Session can have several requests
    /// waiting at once, and one replaced between the reading and the click would send the answer to
    /// the request underneath.
    var patienceID: String { get }

    /// The socket peer whose connection is holding this request open, or `nil` where the wait is
    /// not a peer's — the Codex server blocks on an RPC id, not on a connection this gate watches.
    var patiencePeer: Int? { get }
}

/// The key of a table whose scope is its owner: one pile, nothing to file it under. `PatienceTable`
/// is keyed because the `claude` gate serves every claim over one channel; a Codex thread has only
/// itself.
enum SolePile: Hashable {
    case sole
}

/// A keyed pile of blocked requests under Argo's own clock, and the ONE place that clock is armed
/// (#750). A request ends in exactly one of four ways: answered, refused by the clock, its peer
/// gone, or its scope withdrawn. Each gate composes its own policy above this.
///
/// Argo's clock is the shorter one wherever there are two, so a request nobody answers is refused
/// BY ARGO (DIRECT) rather than read off a peer close whose cause it would have to guess at.
@MainActor
final class PatienceTable<Key: Hashable, Item: Patient> {
    /// The pile under one key changed. Assigned after `init`, since every handler needs the gate.
    var changed: @MainActor (Key, [Item]) -> Void = { _, _ in }

    /// Argo's clock ran out on this one, and it is already off the pile. What a refusal SAYS is the
    /// gate's to send: only the gate knows the transport.
    var expired: @MainActor (Key, Item) -> Void = { _, _ in }

    private struct Entry {
        let item: Item
        /// Argo's own clock for this one request, cancelled by every other way it can end.
        let clock: Task<Void, Never>
    }

    private let patience: PermissionPatience
    private let prefix: String
    private var piles: [Key: [Entry]] = [:]
    private var issued = 0

    init(patience: PermissionPatience, prefix: String) {
        self.patience = patience
        self.prefix = prefix
    }

    func pending(for key: Key) -> [Item] {
        piles[key, default: []].map(\.item)
    }

    /// Mint the next id, build the request around it, and put it on the pile with its clock armed.
    /// `nil` from `build` is a line this gate could not read as its own kind of request.
    @discardableResult
    func raise(for key: Key, _ build: (String) -> Item?) -> Item? {
        issued += 1
        guard let item = build("\(prefix)-\(issued)") else { return nil }
        piles[key, default: []].append(Entry(item: item, clock: arm(item.patienceID, for: key)))
        changed(key, pending(for: key))
        return item
    }

    /// The named request, still waiting — what a gate's standing-allow policy reads before it
    /// grants, since the grant covers this call along with every sibling on the same tool.
    func waiting(_ id: String, for key: Key) -> Item? {
        pending(for: key).first { $0.patienceID == id }
    }

    /// Answer the named request. `false` where it is no longer waiting — an answer that raced its
    /// own end, which the caller reports rather than swallows.
    func answer(_ id: String, for key: Key, _ reply: (Item) -> Void) -> Bool {
        guard let taken = take(matching: { $0.patienceID == id }, for: key).first else {
            return false
        }
        reply(taken)
        changed(key, pending(for: key))
        return true
    }

    /// Answer every request matching, on one word and in one publish. `false` where nothing
    /// matched, so a caller with a reading of its own knows the publish did not happen.
    func answerAll(matching: (Item) -> Bool, for key: Key, with reply: (Item) -> Void) -> Bool {
        let taken = take(matching: matching, for: key)
        guard !taken.isEmpty else { return false }
        for one in taken {
            reply(one)
        }
        changed(key, pending(for: key))
        return true
    }

    /// The peer went while Argo was still willing to wait, which means the turn it belonged to was
    /// cancelled: everything it held goes, and goes in SILENCE. Nothing was refused, and there is
    /// nothing left to read a refusal.
    func peerGone(_ peer: Int, for key: Key) {
        guard !take(matching: { $0.patiencePeer == peer }, for: key).isEmpty else { return }
        changed(key, pending(for: key))
    }

    /// The scope is over, so nothing under it can be waiting. In silence, as a gone peer's requests
    /// are — and the clocks go first, because a day-long `Task` sleeping against a torn-down gate
    /// is a leak rather than a bug.
    func withdraw(_ key: Key) {
        let held = piles.removeValue(forKey: key) ?? []
        for one in held {
            one.clock.cancel()
        }
        // A scope that held nothing is not news, and `ClaimLedger.withdraw` says the same of a
        // claim
        // with nothing filed: publishing over it would file a record for a teardown that cleared
        // nothing.
        guard !held.isEmpty else { return }
        changed(key, [])
    }

    /// Lift every matching request off the pile, stopping each clock. Every way a request ends that
    /// is not its clock running out stops that clock first — an answered call whose timer still
    /// fired would report an expiry over a decision somebody made.
    private func take(matching: (Item) -> Bool, for key: Key) -> [Item] {
        let pile = piles[key, default: []]
        let taken = pile.filter { matching($0.item) }
        piles[key] = pile.filter { !matching($0.item) }
        for one in taken {
            one.clock.cancel()
        }
        return taken.map(\.item)
    }

    private func arm(_ id: String, for key: Key) -> Task<Void, Never> {
        Task { [weak self, patience] in
            try? await Task.sleep(for: .seconds(patience.seconds))
            guard !Task.isCancelled else { return }
            self?.expire(id, for: key)
        }
    }

    /// Handed over before the publish, so the gate's own reading of the refusal lands in the same
    /// breath as the pile that no longer holds it.
    private func expire(_ id: String, for key: Key) {
        guard let gone = take(matching: { $0.patienceID == id }, for: key).first else { return }
        expired(key, gone)
        changed(key, pending(for: key))
    }
}
