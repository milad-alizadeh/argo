extension SessionRosterProjection {
    /// The one roster every preview and the `sessionRows` specimen draw. A `Row` cannot be
    /// hand-built, so a rendering is only ever looked at the way the app produces it — and the
    /// preview presentation mixes access on purpose, because a ghosted row is only judgeable
    /// beside a row that is not.
    static let previewRows = rows(
        from: CockpitPresentation.preview.sessions,
        mainCheckout: CockpitPresentation.preview.activeProject?.location,
    )
}
