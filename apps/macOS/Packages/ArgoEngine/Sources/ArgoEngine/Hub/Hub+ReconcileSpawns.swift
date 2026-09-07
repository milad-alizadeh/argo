import Foundation

@MainActor
extension Hub {
    /// Retire the row a spawn published, now that the record it turned out to be has appeared.
    /// Safe on every batch: a Session binds to at most one claim, so a re-observation of a bound
    /// one reports nothing and the row cannot be retired twice. The observed Session is never
    /// re-keyed to the claim's id — that would break every link made against the id the CLI chose.
    ///
    /// A claim reports a SECOND time where the CLI moved its transcript (#942). Retiring is
    /// idempotent, so this loop takes that answer as it takes the first; the written handoff link
    /// below keeps naming the path it was made against, which is the id that Session was known by
    /// when the handoff happened.
    func reconcileSpawns() {
        for session in watch.sessions {
            guard let claim = ownership.bind(
                sessionID: session.id,
                uuid: session.transcriptUUID,
            ) else { continue }
            spawns.removeValue(forKey: claim)
            // The one moment a written handoff link can stop naming a claim and name a Session
            // instead — binding happens once per claim and this is the call that knows it did
            // (#513).
            handoff.name(claim: claim, as: session.id)
        }
    }
}
