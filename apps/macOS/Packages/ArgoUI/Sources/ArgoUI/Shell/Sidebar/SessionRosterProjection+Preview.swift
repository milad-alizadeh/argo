extension SessionRosterProjection {
    /// The one roster every preview and the `sessionRows` specimen draw. A `Row` cannot be
    /// hand-built, so a rendering is only ever looked at the way the app produces it — and the
    /// preview presentation mixes access on purpose, because a uniform roster suppresses the lock.
    static let previewRows = rows(from: CockpitPresentation.preview.sessions)
}
