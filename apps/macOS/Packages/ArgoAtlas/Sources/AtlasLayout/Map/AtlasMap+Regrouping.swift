/// The map re-tiled by inferred subject instead of by folder (#1158).
///
/// The folder tree files code by LAYER, so a subject is spread over five plates and the map cannot
/// show it as one thing. Re-rooting here, ahead of the tiler, is what makes the cure real rather
/// than a recolouring: everything downstream — the squarify, the plate names, the trail, the index
/// beside the map — reads a Map whose folders ARE the Domains, and none of it needs to know that
/// the partition it was handed was guessed.
///
/// Same Plots, same Measures, one Plate each. That is the whole of the reshuffle, and it is why a
/// file's footprint moves without changing: the tiler weighs a Plot by the same Measure on either
/// side of the switch, and nothing here touches a number.
public extension AtlasMap {
    /// What the region holding the files the inference placed in no Domain is called.
    ///
    /// A region rather than a scattering: a file that belongs to nothing is a finding, and hiding
    /// it — or worse, forcing it into the nearest Domain — is the map claiming a partition the
    /// inference declined to make. Lower case, unlike every Domain name, because it is not one.
    static let unassignedRegion = "unassigned"

    /// The path segment every region stands under, and no folder of a repository is.
    ///
    /// A namespace rather than hanging the regions straight off the root, because "has this Map
    /// been re-rooted on its Domains" has to be answerable from the Map alone — and a Domain is
    /// named for the token most concentrated in its files, which very often IS a top-level folder
    /// name. Without this, a repository whose first folders happened to be called what its first
    /// Domains are called would read as a domain map while tiled by path, and the rail would list
    /// folders as inferred subjects.
    ///
    /// The design spells it the same way (`cockpit-atlas.html`, `state.folder.startsWith`).
    static let regionNamespace = "@domain"

    /// Whether there is a partition to re-tile on at all — the one question the control that asks
    /// for the domain map has to answer before it offers the choice.
    ///
    /// Derived rather than held beside `regrouped()`, so a control that is offered and a Map that
    /// can be re-rooted cannot come apart: this is exactly the guard `regrouped()` returns nothing
    /// on.
    var canRegroup: Bool {
        inference?.domains.isEmpty == false
    }

    /// The Map re-rooted on its Domains, or nothing where there is no partition to re-root on.
    ///
    /// Nothing where the Map carries no inference at all, and nothing where the inference placed
    /// every file in no Domain: both are a repository this cannot re-tile, and the control that
    /// asks for it has to be able to tell the reader so rather than draw one grey region.
    ///
    /// The regions come in the inference's own order, largest first, which is the order their
    /// colours are ranked in — so the region a reader picks out of the legend is the region they
    /// see on the map.
    func regrouped() -> AtlasMap? {
        guard canRegroup, let inference else { return nil }
        let plots = Dictionary(plots.map { ($0.path, $0) }, uniquingKeysWith: { first, _ in first })
        let paths = regionPaths
        var regions = inference.domains.enumerated().map { rank, domain in
            AtlasNode.plate(AtlasPlate(
                path: paths[rank],
                children: domain.paths.compactMap { plots[$0].map(AtlasNode.plot) },
            ))
        }
        let loose = unassigned
        if !loose.isEmpty {
            regions.append(.plate(AtlasPlate(
                path: paths[inference.domains.count],
                children: loose.map(AtlasNode.plot),
            )))
        }
        return AtlasMap(
            measuredAt: measuredAt,
            commit: commit,
            root: AtlasPlate(path: root.path, children: regions),
            relations: relations,
        )
    }

    /// The regions of a Map that HAS been re-rooted on its Domains, Domain first and largest
    /// first — and nothing at all for a Map still tiled by folder.
    ///
    /// The test is the paths: a re-rooted Map's Plates stand exactly where `regrouped()` puts
    /// them, under `regionNamespace`, which no folder of a repository is. Derived rather than
    /// flagged, because a flag saying "this Map is grouped by domain" is a second claim that can
    /// be wrong — and the caller that got it wrong would be a rail listing folders as if they were
    /// subjects.
    ///
    /// The unassigned region is deliberately NOT among them: it is on the map, where the reader
    /// can see how much of the repository it is, but it is not a Domain and nothing that reasons
    /// about Domains should have to remember to skip it.
    var regions: [AtlasPlate] {
        guard let inference, canRegroup else { return [] }
        let paths = regionPaths
        let standing = root.children.prefix(inference.domains.count).compactMap { child in
            if case let .plate(plate) = child {
                plate
            } else {
                nil
            }
        }
        guard standing.count == inference.domains.count,
              standing.map(\.path) == Array(paths.prefix(standing.count))
        else { return [] }
        return standing
    }

    /// Where each region's Plate stands: one path per Domain in the inference's own order, and one
    /// more past them for the files that belong to nothing.
    ///
    /// One list read by both the regroup and the reading of it, so "where a region stands" is
    /// decided once. A repeat of the arithmetic in either place is how a rail comes to name a
    /// region the map drew somewhere else.
    private var regionPaths: [String] {
        var names = AtlasRegionNames(under: "\(root.path)/\(AtlasMap.regionNamespace)")
        let domains = (inference?.domains ?? []).map { names.path(for: $0.name, at: $0.rank) }
        return domains + [names.path(for: AtlasMap.unassignedRegion, at: nil)]
    }
}

/// Where each region's Plate stands, so no two of them stand at one path.
///
/// A region is a folder of the regrouped Map and a folder is its path, which the inference gives
/// no guarantee about: a Domain is named for the word most CONCENTRATED in it, and two Domains can
/// concentrate the same word. Two Plates at one path is a region the trail cannot tell from its
/// twin and a descent that lands on whichever came first, so the repeat is spelled out — visibly,
/// in the name the reader sees, because two regions the inference called one thing is a fact about
/// the guess rather than something to paper over.
private struct AtlasRegionNames {
    private let root: String
    private var taken: Set<String> = []

    init(under root: String) {
        self.root = root
    }

    /// The path for a region called `name`, under the Map's own root.
    ///
    /// The separator is stripped rather than escaped: a Domain word carrying one would otherwise
    /// nest a region inside a region nothing placed there, and the words come from filenames,
    /// where a separator is not part of one.
    /// The repeat is spelled with the Domain's own RANK rather than with a running count, so the
    /// suffix means something a reader can check against the rail and does not move when an
    /// unrelated pair of twins earlier in the list changes.
    ///
    /// One instability is left and is stated rather than hidden: a narrowing that empties the
    /// FIRST of two Domains sharing a word leaves the survivor unsuffixed, so a reader standing in
    /// it while they hide the test files is put back at the top of the map. Closing that needs a
    /// name the Map carries apart from its path, which `AtlasPlate` has no room for.
    mutating func path(for name: String, at rank: Int?) -> String {
        let flat = name.split(separator: "/").joined(separator: " ")
        var here = flat
        if taken.contains(here), let rank {
            here = "\(flat) (\(rank))"
        }
        taken.insert(here)
        return "\(root)/\(here)"
    }
}
