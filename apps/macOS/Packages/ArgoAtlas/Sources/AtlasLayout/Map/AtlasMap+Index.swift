public extension AtlasMap {
    /// The index of this Map, as the reader's question leaves it (#1155).
    ///
    /// One walk over the Plots: the question decides which stand, and the band channel decides
    /// what each one is worth. Both here rather than in the view, so the list and the map are read
    /// off one Map by one rule and cannot come to disagree about what is in the repository.
    ///
    /// The Map's own order rather than a sorted or scored one: the rule has no ranking in it, so
    /// there is nothing to rank by, and the order a reader sees twice for one question is the
    /// order the measurement was written in.
    func index(matching query: String, by channels: AtlasChannels) -> [AtlasIndexEntry] {
        let search = AtlasSearch(query)
        return plots.filter { search.matches($0.path) }.map { plot in
            AtlasIndexEntry(
                path: plot.path,
                name: AtlasPath.name(of: plot.path),
                folder: AtlasPath.folder(of: plot.path),
                value: plot.measures[channels.band],
            )
        }
    }
}
