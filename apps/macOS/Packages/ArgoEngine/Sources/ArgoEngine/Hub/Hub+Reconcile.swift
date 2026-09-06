/// Where a spawned row stands down: the record it turned out to be has appeared on the roster, so
/// the row Argo published for the agent it started is retired in favour of it (#361).
///
/// Its own file rather than beside the spawn that published the row, because the cap on a file is
/// met by putting a half of a type where it belongs.
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
        // Asked the cheap way first, because this runs after every batch and the roster below is
        // folded on READ (`HubJoin`): a fold per batch here is exactly the cost #1556 took off the
        // opening fill. A registry that has issued no claim can bind nothing, and a cockpit that
        // has spawned nothing is the whole of the window that fill happens in.
        guard ownership.hasIssuedAClaim else { return }
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
