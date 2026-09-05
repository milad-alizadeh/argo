/// Hiding test files is not a visibility toggle on the drawn map — it changes what the
/// repository IS for the purposes of the reading, so the ranges bands are cut against have to
/// change with it (#1161). Filtering here, ahead of the tiler, is what makes that true: every
/// caller downstream reads a Map that never carried the excluded Plots, rather than a picture
/// with some of its rectangles hidden after the fact.
public extension AtlasMap {
    /// The Map with every test Plot removed, and every Plate left with no children by removing
    /// them dropped too — a folder that held nothing but tests is not a folder in the product.
    /// The root survives empty rather than vanishing: a Map with none of its own is still a
    /// Map, and every caller downstream already draws that as an empty floor (`AtlasPlan.empty`
    /// is a different, unmeasured case).
    func excludingTestFiles() -> AtlasMap {
        let children = root.children.compactMap { $0.excludingTestFiles() }
        let root = AtlasPlate(path: root.path, children: children)
        let kept = Set(root.plots.map(\.path))
        return AtlasMap(
            measuredAt: measuredAt,
            commit: commit,
            root: root,
            relations: AtlasRelations(
                couplings: couplings.filter { kept.contains($0.first) && kept.contains($0.second) },
                inference: inference?.keeping(kept),
            ),
        )
    }
}

private extension AtlasInference {
    /// The same inference over fewer files. The Domains are NOT re-inferred — that needs the
    /// history and the whole file list, which is the generator's reading and not this one — so a
    /// Domain here is what it was, minus the files that left, and a Domain the filter emptied is
    /// gone. The two numbers stand as taken: they describe the partition the generator settled on,
    /// and restating them against a subset would be inventing a second inference.
    func keeping(_ paths: Set<String>) -> AtlasInference {
        AtlasInference(
            domains: domains.compactMap { domain in
                let members = domain.members.filter { paths.contains($0.path) }
                guard !members.isEmpty else { return nil }
                return AtlasDomain(name: domain.name, tokens: domain.tokens, members: members)
            },
            resolution: resolution,
            settled: settled,
            agreement: agreement,
        )
    }
}

private extension AtlasNode {
    /// One node, filtered — or nothing, where a test Plot was the whole of it.
    func excludingTestFiles() -> AtlasNode? {
        switch self {
        case let .plot(plot):
            AtlasPath.isTest(plot.path) ? nil : .plot(plot)
        case let .plate(plate):
            plate.excludingTestFiles().map(AtlasNode.plate)
        }
    }
}

private extension AtlasPlate {
    /// A Plate with every test Plot removed under it — or nothing, where doing so left it
    /// standing on nothing.
    func excludingTestFiles() -> AtlasPlate? {
        let children = children.compactMap { $0.excludingTestFiles() }
        guard !children.isEmpty else { return nil }
        return AtlasPlate(path: path, children: children)
    }
}
