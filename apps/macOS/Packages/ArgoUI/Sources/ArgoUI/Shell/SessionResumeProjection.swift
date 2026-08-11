/// Which selection costs a process (#10). Selection is free everywhere else.
enum SessionResumeProjection {
    /// The Session a selection should continue, and `nil` where the click spends nothing.
    ///
    /// `managed` is already reachable and `external` was never Argo's to take over, so `orphaned`
    /// is the only case left — a Session Argo spawned and can no longer steer.
    static func resumable(
        _ chosen: CockpitPresentation.Session.ID?,
        in presentation: CockpitPresentation,
    )
        -> CockpitPresentation.Session.ID? {
        guard let chosen, presentation.session(chosen)?.access == .orphaned else { return nil }
        return chosen
    }
}
