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

    /// The regions of a Map re-rooted on its Domains, as the reader's question leaves them
    /// (#1158) — the list beside a domain map.
    ///
    /// Read off the re-rooted Map's own Plates rather than off the inference, so the list and the
    /// picture are one walk of one value: a region is a row here exactly where it is a plate
    /// there, holding the files it really holds. Empty for a Map that was not re-rooted, which is
    /// the honest answer — there are no regions to list.
    ///
    /// The unassigned region is NOT a row. It is on the map, where the reader can point at it and
    /// see how much of the repository it is, but it is not a subject and a list of subjects that
    /// named it would be claiming the inference made a nineteenth guess.
    ///
    /// A region answers a question by its NAME rather than by its path, unlike a file: the path is
    /// the repository's own root with the name hung off it, so matching on it would let the
    /// repository's own name answer every term.
    ///
    /// A region is matched to its Domain by POSITION, never by name: `regrouped()` lays the
    /// regions down in the inference's own order, and two Domains named for one word are two
    /// regions the map deliberately tells apart. Matching on the name would fold the second into
    /// the first and colour it wrong.
    func domainIndex(matching query: String) -> [AtlasDomainEntry] {
        guard let inference else { return [] }
        let search = AtlasSearch(query)
        return zip(regions, inference.domains).compactMap { region, domain in
            guard search.matches(region.name) else { return nil }
            return AtlasDomainEntry(
                path: region.path,
                // The Domain's own rank, so the swatch on this row is the colour that region is
                // really painted in however the Map was narrowed to get here (#1158).
                rank: domain.rank,
                confidence: domain.confidence,
                count: region.plots.count,
            )
        }
    }
}
