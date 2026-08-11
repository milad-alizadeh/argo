import Foundation
import Observation

/// Which Session handed its work to which, under one answer (#634).
///
/// Two halves, because a handoff is written in two moments. The links THIS process made are held in
/// memory and name a CLAIM, which belongs to this process (ADR-0013). The ones any Argo made are
/// read from the chain file and name a Session id. `edge` is where the two meet.
///
/// Observed, because a handoff completing has to reach the reading it is drawn at the foot of, and
/// a link that gets named at rebind changes what that reading says.
@MainActor
@Observable
final class HandoffLedger {
    /// The handoffs this process made: the Session that handed over → the claim the fresh row was
    /// published under.
    private var live: [String: SessionOwnership.ClaimID] = [:]
    private var chain: HandoffChain
    @ObservationIgnored private let store: HandoffChainStore

    /// The chain is read at construction rather than lazily: the roster is published before
    /// anything is swept, and a chain loaded a moment later would blank the link on the first
    /// reading of a Session that has one.
    init(store: HandoffChainStore) {
        self.store = store
        self.chain = store.load()
    }

    /// Who this Session handed its work to, as the row is reachable RIGHT NOW — a claim while the
    /// fresh agent's CLI has written no record, its own id once it has.
    ///
    /// The live half wins where both have something to say: it is the same handoff, held under the
    /// claim that is still the row's id until the rebind happens.
    func edge(of sessionID: String) -> String? {
        live[sessionID]?.value ?? chain.resolved[sessionID]
    }

    /// The edge, held in memory and written down. In memory because what the fresh row is CALLED
    /// right now is a claim; on disk because the handoff is what a Session PRODUCED, which
    /// `CONTEXT.md` keeps as an Outcome.
    func record(from sessionID: String, claim: SessionOwnership.ClaimID, atMs: Int) {
        live[sessionID] = claim
        chain = store.update { chain in
            chain.record(from: sessionID, claim: claim.value, atMs: atMs)
            return true
        }
    }

    /// The fresh agent has written a record and its claim now has the id the CLI picked. That is
    /// the moment the written link stops being about a claim, so it is the moment it is named.
    ///
    /// Called on every observation batch and writes nothing when there is nothing to name.
    func name(claim: SessionOwnership.ClaimID, as sessionID: String) {
        guard chain.links.contains(where: { $0.claim == claim.value && $0.to == nil })
        else { return }
        chain = store.update { chain in chain.name(claim: claim.value, as: sessionID) }
    }
}
