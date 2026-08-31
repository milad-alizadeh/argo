import Foundation

/// Everything the roster fold reads, as one value two reads can be compared by.
///
/// Five counters and two small values rather than a hash of the roster: a stamp is only honest if
/// it moves whenever an INPUT does, and every counter here is bumped by the one write that owns
/// its half of the state. The two values are compared outright because they are small and because
/// their owners are the Hub itself — a `Hub` cannot bump a counter about its own stored property
/// without writing to its own observation registrar from inside that property's own observer.
struct HubRosterStamp: Equatable {
    let join: Int
    let readings: Int
    let claims: Int
    let ownership: Int
    let handoff: Int
    let spawns: [SessionOwnership.ClaimID: AgentSpawn]
    let project: HubProject
}

/// The folded, decorated, sorted roster, held for as long as every input behind it stands still
/// (ADR-0028 Rule 1).
///
/// The fold is N `observed(_:)` calls — a whole `HubSession` and four lookups outside its
/// transcript, each — and then a sort. It was being paid on every READ: once per scene pass, once
/// per drive poll, once per Session inside the liveness poll's own callback, and a whole roster
/// deep for `session(id:)` to answer about ONE row.
///
/// Correctness is the stamp's and never this type's: it refolds when the stamp moved and reuses
/// when it did not, so a stamp that can stand still while an input moves is a rendered lie rather
/// than a slow read. See `Hub.rosterStamp` for what is in it and why that is all of it.
@MainActor
final class HubRosterMemo {
    private var stamp: HubRosterStamp?
    private var folded: [HubSession] = []
    /// The same rows by id, built with the fold rather than beside it — so a caller reading one row
    /// and a caller reading the list can never disagree about it.
    private var byID: [String: HubSession] = [:]

    #if DEBUG
        /// How many folds this memo did NOT save, counted rather than timed (ADR-0028 Rule 8).
        /// Per instance, because a static one would be shared by every suite running beside this.
        private(set) var folds = 0
    #endif

    func sessions(at stamp: HubRosterStamp, folding fold: () -> [HubSession]) -> [HubSession] {
        refold(at: stamp, folding: fold)
        return folded
    }

    func session(
        id: String,
        at stamp: HubRosterStamp,
        folding fold: () -> [HubSession],
    )
        -> HubSession? {
        refold(at: stamp, folding: fold)
        return byID[id]
    }

    private func refold(at stamp: HubRosterStamp, folding fold: () -> [HubSession]) {
        guard self.stamp != stamp else { return }
        let sessions = fold()
        #if DEBUG
            folds += 1
        #endif
        folded = sessions
        // First wins, which is the row the list draws: the fold publishes at most one row per id,
        // and a duplicate could only come of a spawn standing beside the record it turned out to
        // be — which is the pair reconciliation is about to retire.
        byID = Dictionary(sessions.map { ($0.id, $0) }) { first, _ in first }
        self.stamp = stamp
    }
}
