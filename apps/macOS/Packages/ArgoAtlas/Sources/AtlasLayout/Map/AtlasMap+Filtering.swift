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
            couplings: couplings.filter { kept.contains($0.first) && kept.contains($0.second) },
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
