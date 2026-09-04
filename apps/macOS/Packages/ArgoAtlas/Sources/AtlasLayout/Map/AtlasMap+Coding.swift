import Foundation

/// Reading and writing the Map file. The one place a path is derived from the nesting, and the
/// one place a Map file is judged well-formed — everything above this line works on a tree that
/// has already been checked.
public extension AtlasMap {
    /// Reads a Map file. Every way the bytes can be wrong is an `AtlasMapError`, never a trap:
    /// this is app data written by an earlier run, so it may be old, half-written or not a Map.
    init(decoding data: Data) throws(AtlasMapError) {
        let wire: AtlasMapWire
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            wire = try decoder.decode(AtlasMapWire.self, from: data)
        } catch {
            throw .unreadable(String(describing: error))
        }
        guard wire.version == AtlasMap.version else {
            throw .unsupportedVersion(wire.version)
        }
        // The root's own name is its path, so the walk below has a parent to hang the first
        // child off. `inside: ""` is what an error at the root reads as.
        let path = try AtlasMap.path(of: wire.root.name, inside: "")
        let children = try AtlasMap.nodes(wire.root.children, inside: path)
        self.init(
            measuredAt: wire.measuredAt,
            commit: wire.commit,
            root: AtlasPlate(path: path, children: children),
        )
    }

    /// Writes the Map file. Keys are sorted so two runs over one Map produce one set of bytes.
    func encoded() throws(AtlasMapError) -> Data {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys]
        do {
            return try encoder.encode(wire)
        } catch {
            throw .unwritable(String(describing: error))
        }
    }
}

private extension AtlasMap {
    /// Where a node sits, given what it is called and where its Plate sits.
    static func path(of name: String, inside parent: String) throws(AtlasMapError) -> String {
        guard !name.isEmpty, !name.contains("/") else {
            throw .unnamedNode(inside: parent)
        }
        return parent.isEmpty ? name : parent + "/" + name
    }

    /// The children of one Plate, checked for the two names that would make one path.
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
                built.append(.plot(AtlasPlot(path: path, measures: child.measures ?? [:])))
            case .plate:
                let grandchildren = try nodes(child.children ?? [], inside: path)
                built.append(.plate(AtlasPlate(path: path, children: grandchildren)))
            }
        }
        return built
    }

    /// The Map as the file spells it: names nested, no paths, and the version that wrote it.
    var wire: AtlasMapWire {
        AtlasMapWire(
            version: AtlasMap.version,
            measuredAt: measuredAt,
            commit: commit,
            root: AtlasPlateWire(name: root.name, children: root.children.map(\.wire)),
        )
    }
}

private extension AtlasNode {
    var wire: AtlasNodeWire {
        switch self {
        case let .plot(plot):
            AtlasNodeWire(kind: .plot, name: plot.name, measures: plot.measures, children: nil)
        case let .plate(plate):
            AtlasNodeWire(
                kind: .plate,
                name: plate.name,
                measures: nil,
                children: plate.children.map(\.wire),
            )
        }
    }
}
