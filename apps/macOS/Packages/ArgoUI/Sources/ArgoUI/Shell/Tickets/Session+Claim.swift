/// Whether a Session is live enough to HOLD a Ticket (#1118) — a stricter question than `isLive`,
/// which asks only whether there is still something to go and look at.
///
/// Two grounds, one per provenance. `managed` IS a running process — Argo owns the PTY, and a
/// managed Session whose process is gone is `orphaned` (`CONTEXT.md` L2), so no age is consulted.
/// Everything else has only the record, so the claim rests on the transcript having MOVED inside
/// `DelegationCeiling`.
///
/// The ceiling's own nil rule is INVERTED here, and deliberately: for a delegation the quiet answer
/// is to keep the running claim, and for a ticket it is to drop it. A record with no moment on it
/// is not evidence that anything moved (`CONTEXT.md` degrade-down).
extension CockpitPresentation.Session {
    func holdsClaim(at nowMs: Int) -> Bool {
        guard isLive else { return false }
        switch access {
        case .managed: return true
        case .external, .orphaned:
            return lastSeenAtMs != nil
                && !DelegationCeiling.passed(sinceMs: lastSeenAtMs, nowMs: nowMs)
        }
    }
}
