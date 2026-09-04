import Foundation

/// Reading and writing the Map file. The one place a path is derived from the nesting, and the
/// one place a Map file is judged well-formed — everything above this line works on a tree that
/// has already been checked.
public extension AtlasMap {
    /// Reads a Map file. Every way the bytes can be wrong is an `AtlasMapError`, never a trap:
    /// this is app data written by an earlier run, so it may be old, half-written or not a Map.
    ///
    /// Nesting deeper than Foundation's JSON parser accepts is refused BY that parser and arrives
    /// here as `.unreadable`, measured at 50,000 levels — which is why the walk below carries no
    /// depth cap of its own: it is never reached with a tree it could not stand.
    init(decoding data: Data) throws(AtlasMapError) {
        // The version is read on its own and FIRST. Read as part of the whole file it could only
        // ever be checked against a file that already parsed as this version's shape, so the one
        // case the field exists for — a newer Argo's file, whose node shape this reader does not
        // know — would arrive as "corrupt" instead of "from another version".
        let stated: AtlasVersionWire
        do {
            stated = try JSONDecoder().decode(AtlasVersionWire.self, from: data)
        } catch {
            throw .unreadable(String(describing: error))
        }
        guard stated.version == AtlasMap.version else {
            throw .unsupportedVersion(stated.version)
        }
        let wire: AtlasMapWire
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            wire = try decoder.decode(AtlasMapWire.self, from: data)
        } catch {
            throw .unreadable(String(describing: error))
        }
        // The root's own name is its path, so the walk below has a parent to hang the first
        // child off. `inside: ""` is what an error at the root reads as.
        let path = try AtlasMap.path(of: wire.root.name, inside: "")
        let children = try AtlasMap.nodes(wire.root.children, inside: path)
        let root = AtlasPlate(path: path, children: children)
        try self.init(
            measuredAt: wire.measuredAt,
            commit: wire.commit,
            root: root,
            couplings: AtlasMap.couplings(wire.couplings ?? [], joining: root.plots),
        )
    }

    /// Writes the Map file. Keys are sorted so two runs over one Map produce one set of bytes.
    func encoded() throws(AtlasMapError) -> Data {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys]
        do {
            return try encoder.encode(wire())
        } catch let error as AtlasMapError {
            throw error
        } catch {
            throw .unwritable(String(describing: error))
        }
    }
}

private extension AtlasMap {
    /// The Couplings a file states, read back against the Plots it counted them over. A position
    /// the Map has no Plot at is refused rather than dropped: it means the two halves of the file
    /// disagree about which repository was measured, and a coupling read off by one would draw a
    /// tie between two files that never changed together.
    static func couplings(
        _ wire: [AtlasCouplingWire],
        joining plots: [AtlasPlot],
    ) throws(AtlasMapError)
        -> [AtlasCoupling] {
        var built: [AtlasCoupling] = []
        for coupling in wire {
            try built.append(AtlasCoupling(
                first: path(at: coupling.first, among: plots),
                second: path(at: coupling.second, among: plots),
                strength: coupling.strength,
            ))
        }
        return built
    }

    /// The Plot one end of a Coupling names.
    static func path(at position: Int, among plots: [AtlasPlot]) throws(AtlasMapError) -> String {
        guard plots.indices.contains(position) else { throw .couplingAtNoPlot(position) }
        return plots[position].path
    }

    /// Where a node sits, given what it is called and where its Plate sits.
    static func path(of name: String, inside parent: String) throws(AtlasMapError) -> String {
        guard !name.isEmpty, !name.contains("/") else {
            throw .unnamedNode(inside: parent)
        }
        return parent.isEmpty ? name : parent + "/" + name
    }

    /// The children of one Plate: two names that would make one path, and a node labelled one
    /// kind while carrying the other's contents, are both refused here.
    static func nodes(
        _ wire: [AtlasNodeWire],
        inside parent: String,
    ) throws(AtlasMapError)
        -> [AtlasNode] {
        var seen: Set<String> = []
        var built: [AtlasNode] = []
        for child in wire {
            let path = try path(of: child.name, inside: parent)
            guard seen.insert(child.name).inserted else { throw .repeatedName(path) }
            switch child.kind {
            case .plot:
                // Dropping the subtree under a mislabelled node would take an arbitrary number of
                // measured files off the map with nothing anywhere saying one went missing.
                guard child.children == nil else { throw .contradictoryNode(path) }
                built.append(.plot(AtlasPlot(path: path, measures: child.measures ?? [:])))
            case .plate:
                guard child.measures == nil else { throw .contradictoryNode(path) }
                let grandchildren = try nodes(child.children ?? [], inside: path)
                built.append(.plate(AtlasPlate(path: path, children: grandchildren)))
            }
        }
        return built
    }

    /// The Map as the file spells it: names nested, no paths, and the version that wrote it.
    ///
    /// Every name is taken from the node's path AGAINST its Plate's, so a tree whose paths do not
    /// describe its own nesting is refused rather than written. Nothing stops a caller building
    /// one — `AtlasPlot(path:)` takes the path it is given — and a name cut off the end of a path
    /// alone would re-parent the whole subtree under it on the next read, silently.
    func wire() throws(AtlasMapError) -> AtlasMapWire {
        guard !root.path.contains("/") else { throw .misplacedNode(root.path) }
        var position: [String: Int] = [:]
        for (index, plot) in root.plots.enumerated() {
            position[plot.path] = index
        }
        return try AtlasMapWire(
            measuredAt: measuredAt,
            commit: commit,
            root: AtlasPlateWire(
                name: root.path,
                children: AtlasMap.wire(root.children, inside: root.path),
            ),
            couplings: AtlasMap.wire(couplings, at: position),
        )
    }

    /// The Couplings as the file spells them: two positions in the Map's own Plot order. A
    /// Coupling naming a path the Map holds no Plot at is refused rather than dropped, because it
    /// has no position to be written at and a file that quietly lost ties is one nothing can
    /// audit.
    static func wire(
        _ couplings: [AtlasCoupling],
        at position: [String: Int],
    ) throws(AtlasMapError)
        -> [AtlasCouplingWire] {
        var built: [AtlasCouplingWire] = []
        for coupling in couplings {
            try built.append(AtlasCouplingWire(
                first: place(of: coupling.first, in: position),
                second: place(of: coupling.second, in: position),
                strength: coupling.strength,
            ))
        }
        return built
    }

    /// Where one end of a Coupling sits in the Map's Plot order.
    static func place(
        of path: String,
        in position: [String: Int],
    ) throws(AtlasMapError)
        -> Int {
        guard let found = position[path] else { throw .couplingOutsideMap(path) }
        return found
    }

    static func wire(
        _ nodes: [AtlasNode],
        inside parent: String,
    ) throws(AtlasMapError)
        -> [AtlasNodeWire] {
        var built: [AtlasNodeWire] = []
        for node in nodes {
            let name = try name(of: node.path, inside: parent)
            switch node {
            case let .plot(plot):
                built.append(AtlasNodeWire(
                    kind: .plot,
                    name: name,
                    measures: plot.measures,
                    children: nil,
                ))
            case let .plate(plate):
                try built.append(AtlasNodeWire(
                    kind: .plate,
                    name: name,
                    measures: nil,
                    children: wire(plate.children, inside: plate.path),
                ))
            }
        }
        return built
    }

    /// What a node is called, given the Plate it stands on: the one component its path adds to
    /// its parent's, and a failure when the path adds anything else.
    static func name(of path: String, inside parent: String) throws(AtlasMapError) -> String {
        guard path.hasPrefix(parent + "/") else { throw .misplacedNode(path) }
        let name = String(path.dropFirst(parent.count + 1))
        guard !name.isEmpty, !name.contains("/") else { throw .misplacedNode(path) }
        return name
    }
}
