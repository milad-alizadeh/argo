/// As much of one observed Session as a world poll has to know: the folder its agent is working in,
/// and when it was last seen.
///
/// `lastSeenAtMs` is the same fact the roster judges liveness by (`Hub.observed(_:)`), not the raw
/// `lastActivityAtMs` behind it — the two differ for a Session whose records timestamp nothing, and
/// a poll folding one while the roster folds the other would publish at the wrong moment.
struct SessionActivity: Hashable, Sendable {
    let cwd: String?
    let lastSeenAtMs: Int?
}
