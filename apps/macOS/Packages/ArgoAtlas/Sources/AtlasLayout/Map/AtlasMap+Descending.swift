/// A folder is a place, and going into one gives a Map OF that folder (#1156).
///
/// Re-rooting here, ahead of the tiler, is what makes that true rather than merely intended:
/// everything downstream — the tiling, the bands cut against the repository's own distribution,
/// the index beside the map and every number said about it — reads a Map that holds the folder and
/// nothing else. A picture cropped to a folder after the fact would still be banded against files
/// the reader can no longer see, which is the same defect `excludingTestFiles()` exists to avoid.
public extension AtlasMap {
    /// The Map re-rooted at one of its Plates, or nothing where no Plate stands at that path.
    ///
    /// Nothing is remeasured: `measuredAt` and `commit` are facts about the walk that produced the
    /// Map, and a descent walks nothing. Only what is said ACROSS Plots is cut, to the Plots that
    /// came down with it.
    func descending(to path: String) -> AtlasMap? {
        guard let plate = root.plate(at: path) else { return nil }
        return AtlasMap(
            measuredAt: measuredAt,
            commit: commit,
            root: plate,
            relations: relations.keeping(Set(plate.plots.map(\.path))),
        )
    }

    /// The folders from the Map's root down to where the reader is, root first and the folder they
    /// are in last (#1156).
    ///
    /// The root alone for a reader who has descended into nothing, and the root alone for a path
    /// no Plate stands at — degrade-down, and the same answer `descending(to:)` gives: a trail is
    /// where you ARE, and a reader whose folder went out from under them (a filter hid it) is at
    /// the top rather than somewhere the Map cannot name.
    func trail(to path: String?) -> [AtlasStep] {
        let top = AtlasStep(path: root.path, name: root.name)
        guard let path, path != root.path, let chain = root.chain(to: path) else { return [top] }
        return [top] + chain.map { AtlasStep(path: $0.path, name: $0.name) }
    }
}

extension AtlasPlate {
    /// The Plate at a path, at or under this one, or nothing — a path naming a Plot is nothing,
    /// because a file is not a place to stand.
    func plate(at path: String) -> AtlasPlate? {
        guard path != self.path else { return self }
        return chain(to: path)?.last
    }

    /// Every Plate between this one and the one at a path, the outermost first and the named one
    /// last, or nothing where no Plate stands there.
    ///
    /// The path prefix is what the walk descends by rather than a search of the whole tree: a Map
    /// holds a Plate's children under its own path, so one comparison per level is the whole of
    /// the work however deep the repository is. Matched on the SEPARATOR — a plate called
    /// `root/app` must not read as a prefix of one called `root/apps`.
    func chain(to path: String) -> [AtlasPlate]? {
        for case let .plate(child) in children {
            if child.path == path {
                return [child]
            }
            guard path.hasPrefix(child.path + "/") else { continue }
            guard let rest = child.chain(to: path) else { return nil }
            return [child] + rest
        }
        return nil
    }
}
